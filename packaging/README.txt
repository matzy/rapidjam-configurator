RapidJAM Configurator
=====================

[English]

RapidJAM Configurator is a Windows desktop app for reading and changing the
settings of a RapidJAM controller.

How to start
  1. Extract this folder to any local folder.
  2. Connect the RapidJAM controller by USB in WebConfig (RNDIS) mode.
  3. Run rapidjam-configurator.exe.

Requirements
  - Windows 10 or Windows 11, 64-bit
  - Microsoft Edge WebView2 Runtime (usually already installed on Windows 11
    and most Windows 10 PCs)
  - RapidJAM controller reachable at http://192.168.7.1
  - No Node.js, npm, or web browser is needed.

Notes
  - The app is not code-signed, so Windows SmartScreen may show a warning.
    Choose "More info" and then "Run anyway" only if you trust this copy.
  - Keep rapidjam-configurator.exe and WebView2Loader.dll in the same folder.
  - WebView2 profile data is stored in
    %LOCALAPPDATA%\Goppa\rapidjam.configurator\EBWebView, not in this folder.
    To reset it, close the app and delete that folder.

Files
  - USER_GUIDE.en.md / USER_GUIDE.ja.md : user guides (English / Japanese)
  - LICENSE.txt : license of RapidJAM Configurator (MIT)
  - THIRD-PARTY-NOTICES.txt : licenses of third-party components

Source code: https://github.com/matzy/rapidjam-configurator


[日本語]

RapidJAM Configurator は、RapidJAM コントローラーの設定を読み書きする
Windows 用デスクトップアプリです。

起動方法
  1. このフォルダを任意のローカルフォルダに展開します。
  2. RapidJAM コントローラーを WebConfig（RNDIS）モードで USB 接続します。
  3. rapidjam-configurator.exe を実行します。

動作要件
  - Windows 10 または Windows 11（64 ビット）
  - Microsoft Edge WebView2 Runtime（Windows 11 と多くの Windows 10 PC には
    通常インストール済みです）
  - http://192.168.7.1 で RapidJAM コントローラーに接続できること
  - Node.js、npm、Web ブラウザは不要です。

注意
  - このアプリはコード署名されていないため、Windows SmartScreen の警告が
    表示される場合があります。信頼できるコピーである場合のみ、
    「詳細情報」→「実行」を選んでください。
  - rapidjam-configurator.exe と WebView2Loader.dll は同じフォルダに置いて
    ください。
  - WebView2 のプロファイルデータは、このフォルダではなく
    %LOCALAPPDATA%\Goppa\rapidjam.configurator\EBWebView に保存されます。
    リセットするには、アプリを終了してそのフォルダを削除してください。

同梱ファイル
  - USER_GUIDE.en.md / USER_GUIDE.ja.md : 利用ガイド（英語 / 日本語）
  - LICENSE.txt : RapidJAM Configurator のライセンス（MIT）
  - THIRD-PARTY-NOTICES.txt : サードパーティ製コンポーネントのライセンス

ソースコード: https://github.com/matzy/rapidjam-configurator
