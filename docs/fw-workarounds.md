# FW 不具合に対する configurator 側 workaround (引き継ぎ資料)

FW を更新しない現行バージョン (v0.7.12-50 / `goppa-dev`) に残っている不具合を、configurator 側だけで回避・軽減するための対策の一覧と、**FW 修正後に戻す手順**をまとめる。

- 対象の FW 修正: `GP2040-CE_RapidJAM` の `worktree-adc29-unstable` ブランチ
  - `2c3244cc` Seed HE calibration pins from stored config on first voltage read
  - `f9bba46a` Fix corrupted web API responses and HE voltage channel bleed
- 方針: どの対策も、修正済み FW 上で無害になるように作っている (FW バージョンでの分岐はしない)。そのため FW を更新しても、すぐには戻さなくてよい。
- 注意: `v0.7.12` 時点で ADC29 の上限チェックのバグ (PLAN.md「Firmware prerequisite discovered」) は既に直っている。ここでの対象外。

## 不具合と対策の対応表

| WA | FW 側の現象と原因 | configurator 側の対策 | フラグ (`FW_WORKAROUNDS`) | コミット | 主な変更箇所 |
|----|------------------|----------------------|--------------------------|----------|-------------|
| WA-1 | `/api` の応答が壊れる。`fs_close_custom()` が応答文字列を解放した後も、RNDIS の未送信セグメントがそのメモリを参照する (use-after-free)。並行リクエストでヒープが再利用されると本文が壊れる | `/api` リクエストを 1 本ずつ送り、各リクエストの後に 30ms 空ける (`RequestGate`)。`readRawSnapshot` の `Promise.all` も自動的に直列になる | `serializeRequests` | `d45fda6` | `src/transport/fwWorkarounds.ts` の `RequestGate` / `FW_REQUEST_GAP_MS`、`src/device.ts` の `HttpTransport.request` / `performRequest` |
| WA-2 | WA-1 と同じ原因で、live 表示の読み取りが 1 回壊れるだけで失敗する | `getHETriggerVoltage` に限り、応答が信用できないとき (Invalid JSON、範囲外の値、`targetId` 不一致) だけ最大 3 回まで再試行。FW が返したエラーとタイムアウトは再試行しない | `retryCorruptLiveReads` | `e13a0d6` | `fwWorkarounds.ts` の `readLiveWithRecovery` / `LIVE_READ_MAX_ATTEMPTS`、`device.ts` の `readHallVoltageLive` |
| WA-3 | 起動後に `setHETriggerOptions` を POST するまで `getHETriggerVoltage` が `mux channels incorrect` を返し、live 表示が失敗し続ける | そのエラーを受けたときだけ (RapidJAM の `boardConfig` に限る) `setHETriggerOptions` を 1 回 POST して読み直す | `reseedMuxOnError` | `3997736` | `fwWorkarounds.ts` の `MUX_UNINITIALIZED_ERROR` / `readLiveWithRecovery`、`device.ts` の `sendMuxOptions` / `isRapidJam` |
| WA-4 | smoothing の EMA 状態 (`smoothingRead`) が全チャネルで共有され、直前に読んだチャネルの値が混ざる (factor 5 で約 7.7%)。切り捨てで低めに偏る | チャネルが変わった最初の読み取りの前に 1 回読み捨てる (残りは約 0.6%)。baseline はチャネルごとにまとめて取り、読み捨ての回数を増やさない | `discardFirstReadOnChannelSwitch` | `d1ef56f` | `fwWorkarounds.ts` の `ChannelSwitchTracker`、`device.ts` の `settleChannel`、`src/hooks/useHallCalibration.ts` の baseline ループ |

### 修正後も残す堅牢化 (FW と無関係に価値があるので戻さない)

| コミット | 内容 |
|----------|------|
| `9ef2be6` | Hall 電圧応答の検証 (`parseHallVoltageResponse`: 0〜4095 の整数、`targetId` のエコーがあれば一致を必須にする)。`targetId` 欠落時に黙って ch0 を返す FW の挙動への予防として、channel 引数が 0〜15 の整数かを確認するガード。定数 `CALIBRATION_VOLTAGE_*` の利用 |
| `59f9e5e` | `commitConfig` を `commitConfigSnapshot` (2 回読み取りの一致確認 + グループごとの readback) に切り替え。`saveHallCalibration` も二重読み取りと readback を必須にする。書き込み POST の応答が読めないときは失敗扱いにせず readback で判定する (`tolerateUnreadableWriteResponse`)。POST は再送しない |

`targetId` のエコー一致の検証は、修正済み FW では「必ず返ってくる値」になるので、**修正後も残す**。

## 戻す手順 (FW 修正版を取り込んだとき)

1. **対象 FW を確認する**: 配布する FW に `2c3244cc` と `f9bba46a` の内容が入っていること。見分け方は次のとおり。
   - `getHETriggerVoltage` の応答に `targetId` が含まれる (`POST /api/getHETriggerVoltage` に `{"targetId": 0}` を送って確認する)。
   - 電源を入れ直した直後に、`setHETriggerOptions` を送らなくても `getHETriggerVoltage` が `mux channels incorrect` にならない。
   - FW の `version` 文字列 (`GET /api/getFirmwareVersion`) が修正を含むビルドを示す。現在は configurator にバージョン判定の仕組みが無い。
2. **まずフラグだけ OFF にして実機確認する** (`src/transport/fwWorkarounds.ts` の `FW_WORKAROUNDS` の 4 つを `false` にする)。コードを消す前に、下の「実機での確認」を修正済み FW で行う。
3. **コードを戻す**: `git revert d1ef56f 3997736 e13a0d6 d45fda6` (新しい順)。
   - `fwWorkarounds.ts` に残った骨組み (フラグ定義だけの状態) を消してよい。他の使い道が無ければファイルごと削除する。
   - `tests/fwWorkarounds.test.ts` と `package.json` の `test:fw-workarounds` から該当テストを外す (`deviceResponse.test.ts` は残す)。
   - この 4 つの revert は、コミット `ce1f6cd` の時点で試して衝突せずに適用でき、`npx tsc -b` と各テストが通ることを確認済み (使い捨てブランチで実施)。`device.ts` の import ブロックは、WA ごとの行が恒久的な修正の行と隣り合わないように並べてあるので、順番を変えずに戻すこと。
   - 戻した後も `fwWorkarounds.ts` のヘッダーコメントだけは `FW-WORKAROUND` の文字列として残る。他に使い道が無ければファイルごと削除してよい。
   - `performAttempts` の「`InvalidDeviceResponseError` の型を保ったまま投げ直す」処理 (`9ef2be6`) は恒久的な修正として残る。`tolerateUnreadableWriteResponse` が動くために必要なので消さないこと。
   - revert が衝突したら、`grep -rn "FW-WORKAROUND" src` で残っている箇所を洗い出して手で消す。
4. **残りが無いことを確認する**: `grep -rn "FW-WORKAROUND" src tests` が 0 件になること。`npx tsc -b` と各テスト (`npm run test:fw-workarounds` `test:hall-travel` `test:settings-backup`) が通ること。
5. **この資料を更新する**: 戻したコミットの SHA と日付を追記するか、資料ごと `docs/release-notes` などにアーカイブする。PLAN.md の「Firmware prerequisite」節のリンクも更新する。

目印の探し方: workaround のコードには `FW-WORKAROUND(WA-n)` のコメントがある。

```
grep -rn "FW-WORKAROUND" src
```

## 実機での確認

現行 FW でも、修正済み FW でも、次の結果になること。

| 確認 | 手順 | 期待する結果 |
|------|------|-------------|
| 起動直後の live 表示 (WA-3) | 本体の電源を入れ直し、キャリブレーションをせずに live 表示を開く | 数秒以内に値が表示される (現行 FW でもエラーが出続けない) |
| チャネル間の混入 (WA-4) | 1 つのボタンを押したままキャリブレーションの baseline を取る | 隣のチャネルの値が混ざらない (押したボタン以外のチャネルの idle がほぼ一定) |
| 応答破損 (WA-1, WA-2) | 保存・バックアップ・復元を繰り返し、DevTools の Console で `Invalid JSON` の頻度を見る | 現行 FW で WA 導入前より減る。破損したときは再試行または安全に失敗する |
| 保存の整合 | 設定を変えて保存し、再接続して値を比較する | 保存した値がそのまま読み戻される。破損時は保存が失敗として表示され、壊れた値は書き込まれない |

## 未解決・注意事項

- **根本原因は直らない**: WA-1 / WA-2 は破損の確率を下げ、検出して安全に失敗させるもの。use-after-free 自体は FW を直さない限り残る。
- **間隔 30ms は仮の値**: `FW_REQUEST_GAP_MS` は実機で調整していない。実機で `Invalid JSON` の頻度とキャリブレーションの所要時間を見て決める。
- **実機で未検証**: この変更は、node:test と型チェックまで確認している。実機での確認は上の表のとおり未実施。特に `commitConfig` の切り替え (`59f9e5e`) は、FW が読み戻しで値を正規化する場合に保存が失敗扱いになる可能性があるので、最初に確認する。
- **WA-4 の限界**: 読み捨てでチャネル間の混入は約 0.6% まで下がるが、ゼロにはならない。実行時の FW の EMA (チャネルごとの状態) とは別物なので、ON/OFF の推定は近似のまま (PLAN.md 参照)。
- **WA-3 のピン設定**: `sendMuxOptions` は RapidJAM のピン配置を固定値で持つ。`isRapidJam` は `/api/getFirmwareVersion` の `boardConfig` から判定している。別の基板に対応するときは、この判定とピン設定を見直す。
- 変更していない既存の挙動: `supportsLiveHallCalibration()` は常に `true` を返す (`device.ts`)。「ADC29 を読めない FW」向けのガードは動いていない。
