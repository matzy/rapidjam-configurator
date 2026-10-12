# RapidJAM Configurator User Guide

Japanese version: [USER_GUIDE.ja.md](USER_GUIDE.ja.md)

Target version: 0.6.0 (Windows x64 desktop app)

RapidJAM Configurator is an app for checking and changing the button mapping, input mode, and Hall sensor (magnetic switch) settings of a RapidJAM controller over a USB connection. It is an unofficial community tool, provided under the MIT License ([LICENSE](../LICENSE)). It comes with no warranty. Check the settings carefully before writing them to the device.

## 1. What you need

- A PC running Windows 10 or 11 (x64)
- Microsoft Edge WebView2 Runtime (Evergreen). It is usually installed on Windows 11. If the app does not start, install the WebView2 Runtime.
- The RapidJAM controller and a USB cable
- Firmware that runs in WebConfig/RNDIS mode. The controller must respond at `http://192.168.7.1`. Follow the firmware instructions to switch modes.

The app only communicates with this address. It does not need an internet connection or Node.js.

## 2. Starting and connecting

1. Extract the ZIP to any folder and start `rapidjam-configurator.exe`. Administrator rights are not required.
2. Put RapidJAM in WebConfig/RNDIS mode and connect it to the PC with USB.
3. The RapidJAM product name and firmware information appear at the top of the screen. If "RapidJAM connected" appears at the bottom left, the connection is working.
4. If the connection fails, the screen shows "Cannot connect to RapidJAM". Check the USB connection and make sure RapidJAM is in WebConfig/RNDIS mode, then press "Retry".

After connecting, press "Reconnect device" at the bottom left to read the settings again.

## 3. Screen layout

| Area | Contents |
| --- | --- |
| Top | Product name and firmware, the Expert mode button, and the display language selector |
| Left | Switch between "Button mapping" and "Magnetic switches", connection status, "Reconnect device", "Restart in gamepad mode", and "Connection diagnostic" |
| Center | The content of the selected screen |
| Bottom | Save status ("Unsaved changes" / "All changes saved"), "Discard", and "Save to device" |

### Display language

On first launch, the app follows the OS language: Japanese on Japanese systems, English otherwise. You can switch languages at any time from the language menu at the top. The language you choose is kept for later launches. Product names, GPIO and CH numbers, and HID key names may stay in English so they match the hardware.

## 4. Saving changes

Changes made on screen are not written to the device until you press "Save to device", with two exceptions:

- "Discard" returns the unsaved edits to the last state that was read from the device.
- "Apply and save calibration" writes to the device immediately (see [section 7](#7-automatic-calibration-of-all-channels)).

Do not unplug the USB cable or close the app while saving. When saving finishes, the app reads the settings from the device again and shows a confirmation message.

## 5. Button mapping

Select "Button mapping" on the left.

### Input mode

Use "Input mode" to choose the protocol that the controller presents to the PC or console. The available modes are:

- For PC: XInput, Keyboard, Generic HID
- For consoles: Nintendo Switch, Nintendo Switch Pro, PS3, PS4, PS5, P5 General, Xbox One, Original Xbox, Mega Drive / Genesis Mini, NEOGEO mini, PC Engine mini, Egret II mini, Astro City mini, PlayStation Classic

A mode change takes effect after you save and then restart the controller in gamepad mode. The button labels on screen change as soon as you select the mode.

"Advanced input mode settings" shows the following items, depending on the mode. Do not change items you do not understand.

- Controller type (Gamepad, Wheel, HOTAS, Guitar, Drums, Arcade stick; the choices depend on the mode)
- Authentication method (None, Keys, USB host, I2C)
- On PS4 / PS5 / P5 General, whether to swap the Share/Create and Touchpad labels
- On PS4 / PS5, the controller identification method
- On XInput and Generic HID, overriding the USB device information (product name, manufacturer, version) or the Vendor ID / Product ID. An incorrect value can prevent the PC or console from recognizing the controller.

### Button labels

Button names follow the input mode. For example, the same physical button assignment is labeled differently:

| Assignment | XInput | Nintendo Switch | PS4 / PS5 |
| --- | --- | --- | --- |
| B1 / B2 / B3 / B4 | A / B / X / Y | B / A / Y / X | ✕ / ○ / □ / △ |
| L2 / R2 | LT / RT | ZL / ZR | L2 / R2 |
| S1 / S2 | Back / Start | − / + | Share (Create on PS5) / Options |
| A1 / A2 | Guide / (unused) | Home / Capture | PS / Touchpad |

Buttons that the current mode does not use are labeled "(unused)". Keyboard, Generic HID, and modes not listed above use the XInput labels.

### Channel assignment

The controller diagram shows 16 magnetic switches (CH0 to CH15). The faint text on each button is the engraving or arrow printed on the physical button. It does not change when you change the input mode or the assignment. The prominent text is the function assigned in the current settings.

1. Select a button in the diagram. The channel number and engraving appear on the right, for example "CH14 · A".
2. Under "Gamepad action", choose the action to assign to that channel. Choose "Unassigned" to disable the button.
3. Buttons you have changed but not saved are marked in the diagram and the list.

### Keyboard mode

When the input mode is Keyboard, the assignment screen changes to "Keyboard mapping". You cannot change the current gamepad action of each channel. Instead, you choose the HID key to send for that action. Actions that have no keyboard equivalent show "No Keyboard HID mapping".

### GPIO assignment

At the bottom of the screen, you can choose the action for GP0 to GP5. Besides gamepad actions, you can also assign Turbo, macros, Accelerator, Brake, Home, menu actions, and Function (Fn). GP13 to GP15, GP25 to GP26, and GP29 are reserved for add-ons and are not shown.

## 6. Magnetic switch tuning

Select "Magnetic switches" on the left. Here you adjust the actuation point (where a button registers) and Rapid Trigger.

### Channel selection

- Click a button in the diagram to select only that channel.
- Hold Shift or Ctrl while clicking to add or remove channels from the selection. "Select all" selects every channel.
- While several channels are selected, changes apply the same value to all of them. Check the targets carefully.
- The stroke bar shows only the one active channel.

### Stroke bar

For the selected channel, the stroke bar shows a live estimate of the current travel in mm, calculated from the ADC29 voltage.

- The blue marker is the actuation point. When Rapid Trigger is on, the red marker is the Rapid Trigger threshold.
- You can drag the markers. While dragging, you see a preview. When you release the pointer (mouse button), the value is applied to the settings being edited. Nothing is written to the device until you save.
- You can set the same values with the number fields or sliders. Values in mm are converted to ADC values using the calibration range when you save.
- The ON/OFF shown for "Key input estimate" is calculated from the ADC value read and the settings being edited. It is not actual gamepad input, and unsaved changes are not active on the controller.
- The display is updated by periodic HTTP requests, so it can lag behind the real switch movement. If a reading temporarily fails, the last value received is shown.
- Travel cannot be shown for a channel that has not been calibrated or whose calibration is invalid.

### Settings you can change

- **Actuation point**: the position where the button starts to register.
- **Rapid Trigger**: when on, the key resets as soon as it starts to return. When on, you can set the Rapid Trigger threshold (the range in which it operates) and the noise filter (tolerance, 0 to 4095). When off, this firmware decides both on and off using the actuation point, so the release point field and marker are hidden. Turning Rapid Trigger back on shows the values that were kept.

Changing these values can change the feel of the controller a lot. After saving, check the behavior safely, for example in a game.

### Standard mode and Expert mode

Switch with the "Expert mode" button at the top. The app starts in Standard mode.

| | Standard mode | Expert mode |
| --- | --- | --- |
| Actuation point | 0.05 to 1.30 mm (the range deeper than 1.30 mm is shown hatched on the bar) | 0.05 mm to the full stroke length |
| Rapid Trigger threshold | Up to the full stroke length | Up to the full stroke length |
| Full stroke length setting | Hidden (RapidJAM uses 1.5 mm) | Set from 0.5 to 4.0 mm in 0.1 mm steps |

Switching to Expert mode shows a confirmation that you are about to enable settings that are not recommended. The selected mode is saved in the app on this PC and kept at the next launch.

If the device already stores an actuation point above 1.30 mm, switching to Standard mode does not change that value by itself. If you adjust it in Standard mode, it is limited to 1.30 mm or less.

The full stroke length is saved in the app on this PC for each model. Changing it only changes how travel is converted to mm on screen. It does not change the device's ADC thresholds or unsaved state. "Use device preset" returns it to the preset. For models other than RapidJAM, or when the model cannot be identified, Standard mode shows "This device is not supported in Standard mode. Please use Expert mode." and treats the device as 1.5 mm.

## 7. Automatic calibration of all channels

Calibration re-measures the idle position and the pressed position of each switch. The firmware must support voltage readings from ADC29. If it does not, the button is disabled.

1. Select "Calibrate all Hall buttons".
2. The idle-position measurement starts. Do not touch the controller's buttons while it runs.
3. When the pressed-position measurement starts, press each button fully as you normally would, then release it. The order does not matter. When asked, press it again. This repeats about three times. The measured values are taken from these presses.
   - If the presses do not agree closely, the configurator asks for up to five presses in total. A channel whose presses still disagree is marked "unstable" (orange). Check its result and measure it again if needed.
   - The animation at the left of the status bar shows the current motion: a downward arrow means press, an upward arrow means release, and a cross means do not touch the button.
   - If you release a button before it is fully pressed, only that press is repeated.
   - Completed buttons turn green. Press a yellow button to skip it. Press a green button to measure it again.
   - A channel whose measurement failed can be selected from the status list and measured again.
4. When all channels are done, select "Finish capture and review". Skipped channels are not calibrated.
5. Review the results. Look for unusual values in the idle value, pressed value, span, and status. If something is wrong, press "Cancel" without applying.
6. If the results look right, select "Apply and save calibration". This writes to the device. After saving, the actuation point and release point are converted to the new calibration range while keeping their percentages of the range.

Pressing buttons or unplugging USB during calibration can make the measurement fail. If you see abnormal values, do not apply them. Check the connection and firmware support instead.

## 8. Returning to gamepad mode

Select "Restart in gamepad mode" on the left to return RapidJAM to normal gamepad operation. It is expected that the connection to the configurator is lost at this point. To configure the device again, switch back to WebConfig/RNDIS mode and reconnect.

## 9. Troubleshooting

| Symptom | What to check |
| --- | --- |
| The app does not start | Check that the WebView2 Runtime is installed. |
| Cannot connect | Check the USB cable, WebConfig/RNDIS mode, and whether `192.168.7.1` responds. Try "Retry" or "Reconnect device". |
| An error appears when saving | Some settings may have been written partially. Reconnect before retrying, then read the settings from the device to confirm the actual state. |
| Calibration does not start | Check that the firmware supports ADC29. If a live reading timed out, reconnect to the device first. |
| Stroke is not shown | Check whether the channel is calibrated. If the live reading fails, "ADC29 reading unavailable" is shown. |
| The configurator cannot recover the device | Use the recovery procedure in the GP2040-CE WebConfig documentation. Initialization or reset can erase saved settings, so read the procedure before you start. |

Technical information for troubleshooting may be shown when you open "Connection diagnostic" on the left. When reporting a problem, include this diagnostic information, the app version, and the firmware version.

## 10. What the app stores on your PC

The language, Standard / Expert mode, and the full stroke length for each model are stored in the WebView2 data folder. The location is `%LOCALAPPDATA%\Goppa\rapidjam.configurator\EBWebView`, not next to the EXE. To reset the app's stored data, close the app and delete this folder. This clears the language, mode, and full stroke length settings. The settings stored on the device are not affected.

## 11. Disclaimer and trademarks

- This software is provided without warranty. The display does not guarantee that a setting was written to the device or that it works correctly on every machine. After making changes, check the inputs in the environment where you use them.
- This is an unofficial project. The names of game consoles, platforms, and products that appear in the documentation and screens (such as Nintendo Switch, PlayStation, Xbox, and the mini retro consoles) are trademarks or registered trademarks of their respective owners. This project is not affiliated with those owners and is not endorsed, sponsored, or recommended by them.
