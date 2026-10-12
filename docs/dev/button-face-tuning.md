# Tuning the controller face (dev)

The controller is drawn from a single SVG, [`design/button-face.svg`](../../design/button-face.svg). It holds:

- the controller body (`body` layer: outline and brand text)
- each button shape (`chN-shape`: circle, rect, or ellipse, including the elongated LB / LT capsules)
- each engraved mark (`chN-engraving`: B / LB / arrows, etc.)
- each function-label anchor (`chN-label-anchor`)

Function labels are HTML text overlaid on the SVG. They are positioned at the anchor's center plus an offset from [`src/config/buttonFaceTuning.json`](../../src/config/buttonFaceTuning.json).

## How the values combine

| Field                     | Source                                       | Meaning                                                             |
| ------------------------- | -------------------------------------------- | ------------------------------------------------------------------- |
| Shape and mark geometry   | SVG                                          | Position, size, and rotation as drawn in Inkscape.                  |
| Mark position             | SVG + `engraving.offsetX/offsetY`            | SVG position, moved by the JSON delta (px, SVG user units).         |
| Mark size                 | SVG + `engraving.scale`                      | SVG size, multiplied by the JSON scale (1 = unchanged).             |
| Mark opacity / shadow     | JSON                                         | Absolute values.                                                    |
| Label position            | SVG `chN-label-anchor` + `label.offsetX/offsetY` | Anchor center, moved by the JSON delta (px, SVG user units).   |
| Label font size / opacity | JSON                                         | Absolute values.                                                    |
| Button state colors       | CSS (`--key-fill`, `--key-stroke`, `--key-text`) | Selected / active / changed / calibration states.               |

JSON defaults are neutral (offset 0, scale 1), so the app looks like the SVG until you change a value. `perChannel` overrides apply to one channel. Offsets are limited to ±150 and scale to 0.2–3.

## Tuning in the browser (panel)

1. Run `npm run dev` (set the port with `npm run dev:setup -- --base-port N` if needed).
2. Open `http://127.0.0.1:<devPort>/?tuner`. The **Button face tuner** panel appears on the right. It is only loaded in dev mode.
3. Choose 全体 to change the defaults, or a channel (ch0–ch15) to set an override for that button. Overridden fields are marked with ●. 上書き解除 clears one field, and "上書きを全部消す" clears a channel.
4. 保存 writes `src/config/buttonFaceTuning.json` through the dev server (POST `/__button-face-tuning`). The page then reloads. Values are range-checked on both the client and the server.
5. Commit the JSON when the look is right.

The panel also offers JSON copy and 読み込み時に戻す (reset to the values loaded when the page opened).

## Editing the artwork in Inkscape

1. Install [Inkscape](https://inkscape.org/) (1.x) and open `design/button-face.svg`.
2. Keep the file's default units and document size. The runtime uses the SVG's own `viewBox`.
3. Edit the shapes, marks, and label anchors, then save. Vite HMR updates the browser without a reload.

### ID convention

| ID / label           | Where         | Meaning                                                                                                    |
| -------------------- | ------------- | ---------------------------------------------------------------------------------------------------------- |
| `body` layer         | Top level     | Controller body rect and brand text. Drawn behind all buttons. Paint comes from CSS.                       |
| `chN` layer          | Top level     | Art for channel N (0–15, the same channel numbers used by `ControllerDisplay`).                            |
| `chN-shape`          | `chN`         | The button shape. Must be a `rect`, `circle`, or `ellipse`. Rotation on the element or its layer is kept. The fill and stroke come from CSS. |
| `chN-engraving`      | `chN`         | The engraved mark (text or path). Drawn with `currentColor` so the color comes from CSS. Optional.          |
| `chN-label-anchor`   | `chN`         | Where the function-name label goes. Its center is used. Must be a `rect`, `circle`, `ellipse`, or `text`.  |

Notes:

- `ch13` (Start) has no engraving, so it has no `chN-engraving`. Its shape and label anchor still exist.
- Lookup is by `id` first, then by Inkscape label (`inkscape:label`). Layer and part names must match exactly.
- The runtime removes Inkscape metadata, `id`s, and classes from engravings. Only geometry, transforms, and opacity are kept.
- Shapes and engravings may be grouped or placed in any layer inside `chN`. Transforms are accumulated through the parent groups. Only `translate`, `scale`, `rotate`, and `matrix` are supported. Skew throws an error.
- If a channel is missing a required part, the error is logged in the console and that button is skipped.

### Converting text to paths (recommended)

Browser fonts differ from Inkscape's, so text can be placed differently in the app. Before you finish a mark, select it and choose **Path > Object to Path** (`Shift+Ctrl+C`). Keep the `chN-engraving` ID on the result. Unconverted text still works, but its placement may differ by about a pixel.

## Tests

```powershell
npm run test:button-face
npm run test:button-face-svg
```

`test:button-face` covers the JSON resolve and the validator. `test:button-face-svg` covers the transform math, the SVG-to-art conversion in `src/config/buttonFaceSvg.ts`, and a check of the real `design/button-face.svg`.

## Notes

- The writer is registered only with `vite serve`, so production builds contain neither the panel nor the endpoint.
- The validation rules live in `src/config/buttonFaceTuningValidation.ts`.
- The panel is fixed to the right edge, so it can cover part of the controller on narrow windows.
- The SVG has a fixed `viewBox`, so the whole controller scales with the window width. Label font size is in SVG units and scales with it.
