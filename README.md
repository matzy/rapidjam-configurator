# RapidJAM Configurator

English | [日本語](#日本語)

A Windows desktop app for configuring a RapidJAM controller. It talks to the controller's WebConfig interface (`http://192.168.7.1`) over USB to read and write settings and to calibrate the magnetic (Hall-effect) switches.

## Features

- Button mapping: assign the 16 magnetic-switch channels (CH0–CH15) and GP0–GP5, and map HID keys in keyboard mode
- Input modes: XInput, Nintendo Switch, PS3 / PS4 / PS5, keyboard, the various mini consoles, and more. Button names follow the selected mode and the physical engravings on the controller are shown
- Magnetic switch tuning: actuation point, Rapid Trigger, and a live estimated-travel display
- Automatic calibration of all channels
- Standard / Expert mode, and a Japanese / English UI

The user guide ([docs/USER_GUIDE.ja.md](docs/USER_GUIDE.ja.md)) is currently available in Japanese only.

## Requirements

- Windows 10 / 11 (x64) with the Microsoft Edge WebView2 Runtime (normally included in Windows 11)
- RapidJAM firmware (GP2040-CE based) that runs in WebConfig/RNDIS mode

The desktop app needs neither an internet connection nor Node.js. It only talks to a fixed list of WebConfig endpoints on the controller.

## Build from source

You need Node.js / npm, Rust (stable, `x86_64-pc-windows-msvc`), and the Visual Studio C++ Build Tools.

```powershell
npm ci
npm run dev          # open the UI in a browser (uses a demo device by default)
npm run tauri:dev    # run the desktop app in development mode
npm run build        # type-check and production build
```

Run the tests with:

```powershell
npm run test:dev-config
npm run test:hall-travel
npm run test:button-labels
npm run test:hardware-labels
```

See [DISTRIBUTION.md](DISTRIBUTION.md) for building the release ZIP, how WebView2 is handled, and the development port settings.

## License and disclaimer

Released under the [MIT License](LICENSE), without warranty. Check your settings before writing them to the device.

Parts of this project were developed with the assistance of generative AI tools.

This is an unofficial community project, and all console, platform, and product names that appear in the tool or its documentation (such as Nintendo Switch, PlayStation, Xbox, and the various mini consoles) are trademarks of their respective owners and imply no affiliation with, or endorsement by, those owners.

---

# 日本語

RapidJAM コントローラーのボタン割り当て、入力モード、磁気スイッチ設定を確認・変更するためのコンフィギュレーターです。USB で接続した RapidJAM の WebConfig（`http://192.168.7.1`）と通信し、設定の読み書きと磁気スイッチの校正ができます。

## 主な機能

- ボタン割り当て: 磁気スイッチ 16 チャンネル（CH0〜CH15）と GP0〜GP5 の割り当て、キーボードモードでの HID キー割り当て
- 入力モード: XInput、Nintendo Switch、PS3 / PS4 / PS5、キーボード、各ミニ復刻機など。モードに応じたボタン表記と、本体の物理刻印の表示
- 磁気スイッチ調整: アクチュエーションポイントとラピッドトリガーの設定、推定ストロークのライブ表示
- 全チャンネルの自動校正
- 標準モード / Expert mode、日本語 / English の表示切り替え

使い方は [利用ガイド](docs/USER_GUIDE.ja.md) を参照してください。

## 必要なもの

- Windows 10 / 11（x64）と Microsoft Edge WebView2 Runtime（Windows 11 には通常入っています）
- WebConfig/RNDIS モードで動作する RapidJAM のファームウェア（GP2040-CE ベース）

デスクトップ版はインターネット接続も Node.js も不要で、WebConfig の特定のエンドポイントだけに通信します。

## ソースからビルドする

Node.js / npm、Rust（stable、`x86_64-pc-windows-msvc`）、Visual Studio C++ Build Tools が必要です。

```powershell
npm ci
npm run dev          # ブラウザで UI を開く（既定ではデモデバイスで動作）
npm run tauri:dev    # デスクトップ版を開発モードで起動
npm run build        # 型チェックと本番ビルド
```

テストは次のコマンドで実行できます。

```powershell
npm run test:dev-config
npm run test:hall-travel
npm run test:button-labels
npm run test:hardware-labels
```

配布用 ZIP の作り方、WebView2 の扱い、開発用ポートの設定などは [DISTRIBUTION.md](DISTRIBUTION.md) を参照してください。

## ライセンスと免責

[MIT License](LICENSE) で提供します。無保証です。設定をデバイスに書き込む前に、内容を確認してください。

本プロジェクトの一部は、生成 AI ツールの支援を受けて開発しています。

本プロジェクトは非公式のコミュニティ製ツールであり、画面や文書に登場するゲーム機・プラットフォーム・製品の名称（Nintendo Switch、PlayStation、Xbox、各ミニ復刻機など）はそれぞれの権利者の商標または登録商標で、権利者とは無関係であり、承認・提供・推奨を受けたものではありません。