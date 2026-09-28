use std::{env, fs, path::Path};

fn make_icon(path: &Path) {
    const WIDTH: u32 = 16;
    const HEIGHT: u32 = 16;
    const PIXEL_BYTES: u32 = WIDTH * HEIGHT * 4;
    const MASK_BYTES: u32 = HEIGHT * 4;
    const IMAGE_BYTES: u32 = 40 + PIXEL_BYTES + MASK_BYTES;

    let mut icon = Vec::with_capacity((22 + IMAGE_BYTES) as usize);
    icon.extend_from_slice(&0_u16.to_le_bytes());
    icon.extend_from_slice(&1_u16.to_le_bytes());
    icon.extend_from_slice(&1_u16.to_le_bytes());
    icon.extend_from_slice(&[WIDTH as u8, HEIGHT as u8, 0, 0]);
    icon.extend_from_slice(&1_u16.to_le_bytes());
    icon.extend_from_slice(&32_u16.to_le_bytes());
    icon.extend_from_slice(&IMAGE_BYTES.to_le_bytes());
    icon.extend_from_slice(&22_u32.to_le_bytes());

    icon.extend_from_slice(&40_u32.to_le_bytes());
    icon.extend_from_slice(&(WIDTH as i32).to_le_bytes());
    icon.extend_from_slice(&((HEIGHT * 2) as i32).to_le_bytes());
    icon.extend_from_slice(&1_u16.to_le_bytes());
    icon.extend_from_slice(&32_u16.to_le_bytes());
    icon.extend_from_slice(&0_u32.to_le_bytes());
    icon.extend_from_slice(&PIXEL_BYTES.to_le_bytes());
    icon.extend_from_slice(&0_i32.to_le_bytes());
    icon.extend_from_slice(&0_i32.to_le_bytes());
    icon.extend_from_slice(&0_u32.to_le_bytes());
    icon.extend_from_slice(&0_u32.to_le_bytes());

    let glyph = ["1101110", "1010001", "1100001", "1011101", "1011010"];
    for y in (0..HEIGHT).rev() {
        for x in 0..WIDTH {
            let border = x == 0 || y == 0 || x == WIDTH - 1 || y == HEIGHT - 1;
            let in_mark = (3..13).contains(&x) && (3..13).contains(&y);
            let text_x = x.checked_sub(4).filter(|value| *value < 7);
            let text_y = y.checked_sub(5).filter(|value| *value < 5);
            let is_text = text_x.zip(text_y).is_some_and(|(text_x, text_y)| {
                glyph[text_y as usize].as_bytes()[text_x as usize] == b'1'
            });

            let (blue, green, red) = if border || (in_mark && is_text) {
                (0x26, 0x23, 0x1a)
            } else if in_mark {
                (0x4b, 0xf2, 0xb7)
            } else {
                (0x1b, 0x18, 0x12)
            };
            icon.extend_from_slice(&[blue, green, red, 0xff]);
        }
    }
    icon.resize(icon.len() + MASK_BYTES as usize, 0);
    fs::write(path, icon).expect("failed to generate the Windows application icon");
}

fn main() {
    println!("cargo:rerun-if-changed=../.env.local");
    println!("cargo:rerun-if-env-changed=RAPIDJAM_DEV_PORT");
    println!("cargo:rustc-env=RAPIDJAM_DEV_PORT={}", dev_port());

    let mut attributes = tauri_build::Attributes::new();
    if env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        let icon_path = Path::new(&env::var_os("OUT_DIR").expect("OUT_DIR is missing"))
            .join("rapidjam-configurator.ico");
        make_icon(&icon_path);
        attributes = attributes
            .windows_attributes(tauri_build::WindowsAttributes::new().window_icon_path(icon_path));
    }
    tauri_build::try_build(attributes).expect("failed to run Tauri build script");
}

fn dev_port() -> u16 {
    if let Ok(value) = env::var("RAPIDJAM_DEV_PORT") {
        return value
            .parse::<u16>()
            .ok()
            .filter(|port| *port != 0)
            .expect("RAPIDJAM_DEV_PORT must be an integer between 1 and 65535");
    }

    let config_path =
        Path::new(&env::var_os("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is missing"))
            .join("..")
            .join(".env.local");
    let Ok(contents) = fs::read_to_string(config_path) else {
        return 5173;
    };

    let Some(value) = contents.lines().find_map(|line| {
        let (key, value) = line.split_once('=')?;
        (key.trim() == "RAPIDJAM_DEV_PORT").then(|| value.trim())
    }) else {
        return 5173;
    };

    value
        .parse::<u16>()
        .ok()
        .filter(|port| *port != 0)
        .expect("RAPIDJAM_DEV_PORT in .env.local must be an integer between 1 and 65535")
}
