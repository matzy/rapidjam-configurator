use reqwest::{Client, Method, StatusCode};
use serde::Serialize;
use serde_json::Value;
use std::time::Duration;
use tauri::{State, WebviewWindow};

const DEVICE_ORIGIN: &str = "http://192.168.7.1";
const MAX_REQUEST_BYTES: usize = 256 * 1024;
const MAX_RESPONSE_BYTES: usize = 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DeviceResponse {
    status: u16,
    body: String,
}

fn is_trusted_window(window: &WebviewWindow) -> bool {
    if window.label() != "main" {
        return false;
    }

    let Ok(url) = window.url() else {
        return false;
    };

    #[cfg(debug_assertions)]
    {
        is_trusted_dev_origin(url.scheme(), url.host_str(), url.port())
    }

    #[cfg(not(debug_assertions))]
    {
        (url.scheme() == "http" && url.host_str() == Some("tauri.localhost"))
            || (url.scheme() == "tauri" && url.host_str() == Some("localhost"))
    }
}

#[cfg(debug_assertions)]
fn is_trusted_dev_origin(scheme: &str, host: Option<&str>, port: Option<u16>) -> bool {
    scheme == "http" && host == Some("127.0.0.1") && port == Some(5174)
}

fn allowed_method(path: &str, method: &str) -> Option<Method> {
    let allowed = matches!(
        (path, method),
        ("/api/getFirmwareVersion", "GET")
            | ("/api/reboot", "POST")
            | ("/api/getPinMappings", "GET")
            | ("/api/getHETriggerCalibrations", "GET")
            | ("/api/getGamepadOptions", "GET")
            | ("/api/getKeyMappings", "GET")
            | ("/api/setHETriggerOptions", "POST")
            | ("/api/getHETriggerVoltage", "POST")
            | ("/api/setPinMappings", "POST")
            | ("/api/setHETriggerCalibrations", "POST")
            | ("/api/setKeyMappings", "POST")
            | ("/api/setGamepadOptions", "POST")
    );

    if !allowed {
        return None;
    }

    match method {
        "GET" => Some(Method::GET),
        "POST" => Some(Method::POST),
        _ => None,
    }
}

fn encode_request_body(method: &Method, body: Option<Value>) -> Result<Option<Vec<u8>>, String> {
    match method {
        &Method::GET if body.is_some() => {
            return Err("GET requests cannot contain a body.".into());
        }
        &Method::POST if !matches!(body, Some(Value::Object(_))) => {
            return Err("POST requests require a JSON object body.".into());
        }
        _ => {}
    }

    let body_bytes = body
        .as_ref()
        .map(serde_json::to_vec)
        .transpose()
        .map_err(|error| format!("Unable to encode device request: {error}"))?;

    if body_bytes
        .as_ref()
        .is_some_and(|bytes| bytes.len() > MAX_REQUEST_BYTES)
    {
        return Err("RapidJAM request body exceeds the size limit.".into());
    }

    Ok(body_bytes)
}

#[tauri::command]
async fn device_request(
    window: WebviewWindow,
    client: State<'_, Client>,
    path: String,
    method: String,
    body: Option<Value>,
) -> Result<DeviceResponse, String> {
    if !is_trusted_window(&window) {
        return Err("Device API access is only available to the configurator window.".into());
    }

    let http_method = allowed_method(&path, &method)
        .ok_or_else(|| format!("Unsupported RapidJAM API request: {method} {path}"))?;

    let body_bytes = encode_request_body(&http_method, body)?;

    let url = format!("{DEVICE_ORIGIN}{path}");
    let mut request = client
        .request(http_method, &url)
        .header(reqwest::header::ACCEPT, "application/json")
        .header(reqwest::header::CONTENT_TYPE, "application/json");
    if let Some(bytes) = body_bytes {
        request = request.body(bytes);
    }

    let mut response = request.send().await.map_err(|error| {
        format!(
            "Cannot reach {url}. {error}. Check WebConfig/RNDIS mode and the 192.168.7.1 route."
        )
    })?;

    let status: StatusCode = response.status();
    if response
        .content_length()
        .is_some_and(|length| length > MAX_RESPONSE_BYTES as u64)
    {
        return Err("RapidJAM response exceeds the size limit.".into());
    }

    let mut response_bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| format!("Failed to read RapidJAM response from {url}: {error}"))?
    {
        if response_bytes.len() + chunk.len() > MAX_RESPONSE_BYTES {
            return Err("RapidJAM response exceeds the size limit.".into());
        }
        response_bytes.extend_from_slice(&chunk);
    }

    let body = String::from_utf8(response_bytes)
        .map_err(|error| format!("RapidJAM returned a non-UTF-8 response from {url}: {error}"))?;

    Ok(DeviceResponse {
        status: status.as_u16(),
        body,
    })
}

pub fn run() {
    let client = Client::builder()
        .connect_timeout(Duration::from_secs(3))
        .timeout(Duration::from_secs(8))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .expect("failed to initialize the RapidJAM HTTP client");

    tauri::Builder::default()
        .manage(client)
        .invoke_handler(tauri::generate_handler![device_request])
        .run(tauri::generate_context!())
        .expect("error while running RapidJAM Configurator");
}

#[cfg(test)]
mod tests {
    use super::{allowed_method, encode_request_body, is_trusted_dev_origin, MAX_REQUEST_BYTES};
    use reqwest::Method;
    use serde_json::json;

    #[test]
    fn trusts_only_the_configurator_dev_origin() {
        assert!(is_trusted_dev_origin("http", Some("127.0.0.1"), Some(5174)));
        assert!(!is_trusted_dev_origin(
            "http",
            Some("127.0.0.1"),
            Some(5173)
        ));
        assert!(!is_trusted_dev_origin(
            "http",
            Some("127.0.0.1"),
            Some(5175)
        ));
        assert!(!is_trusted_dev_origin(
            "http",
            Some("localhost"),
            Some(5174)
        ));
        assert!(!is_trusted_dev_origin(
            "https",
            Some("127.0.0.1"),
            Some(5174)
        ));
        assert!(!is_trusted_dev_origin(
            "http",
            Some("192.168.1.10"),
            Some(5174)
        ));
        assert!(!is_trusted_dev_origin("http", Some("127.0.0.1"), None));
    }

    #[test]
    fn allows_only_configured_device_api_method_pairs() {
        assert_eq!(
            allowed_method("/api/getFirmwareVersion", "GET"),
            Some(Method::GET)
        );
        assert_eq!(
            allowed_method("/api/getHETriggerVoltage", "POST"),
            Some(Method::POST)
        );
        assert_eq!(
            allowed_method("/api/setHETriggerCalibrations", "POST"),
            Some(Method::POST)
        );
    }

    #[test]
    fn rejects_unknown_paths_and_mismatched_methods() {
        assert_eq!(allowed_method("/api/getFirmwareVersion", "POST"), None);
        assert_eq!(allowed_method("/api/resetSettings", "GET"), None);
        assert_eq!(
            allowed_method("http://example.com/api/reboot", "POST"),
            None
        );
        assert_eq!(allowed_method("/api/reboot", "DELETE"), None);
    }

    #[test]
    fn validates_device_request_bodies() {
        assert_eq!(encode_request_body(&Method::GET, None).unwrap(), None);
        assert!(encode_request_body(&Method::GET, Some(json!({}))).is_err());
        assert!(encode_request_body(&Method::POST, None).is_err());
        assert!(encode_request_body(&Method::POST, Some(json!([]))).is_err());
        assert_eq!(
            encode_request_body(&Method::POST, Some(json!({"value": 1}))).unwrap(),
            Some(br#"{"value":1}"#.to_vec())
        );
    }

    #[test]
    fn rejects_oversized_device_request_bodies() {
        let body = json!({"value": "x".repeat(MAX_REQUEST_BYTES)});
        assert!(encode_request_body(&Method::POST, Some(body)).is_err());
    }
}
