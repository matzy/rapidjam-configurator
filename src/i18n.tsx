import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { LocalizationContext, type Locale, type LocalizationValue, type TranslationValues } from './i18nContext'

const STORAGE_KEY = 'rapidjam.locale'

// Product names, protocol identifiers, physical button labels, and API values are
// deliberately kept as entered in English; only user-facing prose is translated.
const japanese: Record<string, string> = {
  'CONTROL CENTER': 'コントロールセンター',
  'CONFIGURATION': '設定',
  'INPUT LAYOUT': '入力レイアウト',
  'MAGNETIC INPUT': '磁気入力',
  'Tune every input for the way you play.': 'プレイスタイルに合わせて入力を設定します。',
  'Shape the exact moment each button responds.': '各ボタンが反応する位置を調整します。',
  'No device connected': 'デバイスが接続されていません',
  'Connect a controller to begin': 'コントローラーを接続してください',
  'Help': 'ヘルプ',
  'RapidJAM connected': 'RapidJAM 接続中',
  'Looking for device': 'デバイスを検索中',
  'WebConfig HTTP via desktop app': 'デスクトップアプリ経由で WebConfig に接続',
  'WebConfig HTTP via local proxy': 'ローカルプロキシ経由で WebConfig に接続',
  'Mock transport': 'デモ接続',
  'Connect RapidJAM by USB': 'RapidJAM を USB で接続してください',
  'Connecting...': '接続中…',
  'Reconnect device': 'デバイスに再接続',
  'Restart in gamepad mode': 'ゲームパッドモードで再起動',
  'Connection diagnostic': '接続診断情報',
  'RapidJAM is restarting in gamepad mode': 'RapidJAM をゲームパッドモードで再起動しています',
  'The configurator connection will close while RapidJAM returns to normal gamepad operation.': 'RapidJAM が通常のゲームパッド動作に戻ると、設定アプリとの接続は切断されます。',
  'Cannot connect to RapidJAM': 'RapidJAM に接続できません',
  'Check the USB connection and press Retry. Other controls are unavailable until the connection is restored.': 'USB 接続を確認して「再試行」を押してください。接続が復旧するまで、ほかの操作はできません。',
  'Retry': '再試行',
  'INPUT MODE': '入力モード',
  'Button mapping': 'ボタン割り当て',
  'Magnetic switches': '磁気スイッチ調整',
  'Unsaved changes': '未保存の変更があります',
  'All changes saved': 'すべての変更を保存済みです',
  'Demo device': 'デモデバイス',
  'RapidJAM': 'RapidJAM',
  'Discard': '変更を破棄',
  'Save to device': 'デバイスに保存',
  'Saving...': '保存中…',
  'English': 'English',
  '日本語': '日本語',
  'Select language': '表示言語',

  'Controller mapping': 'コントローラーの割り当て',
  'Keyboard mapping': 'キーボードの割り当て',
  'Assign HID keys to the existing Gamepad actions.': '既存のゲームパッド操作に HID キーを割り当てます。',
  'Choose the protocol used after the next restart.': '次回の再起動後に使用するプロトコルを選択します。',
  'Current Input Mode': '現在の入力モード',
  'Advanced input mode settings': '入力モードの詳細設定',
  'Controller type': 'コントローラーの種類',
  'Authentication': '認証方式',
  'None': 'なし',
  'Keys': 'キー',
  'USB host': 'USB ホスト',
  'I2C': 'I2C',
  'Swap Share and Touchpad labels': 'Share と Touchpad の表記を入れ替える',
  'Controller identification': 'コントローラー識別方式',
  'Default': '既定',
  'Board identity': 'ボード識別情報',
  'Override USB descriptor': 'USB デバイス情報を上書き',
  'Product': '製品名',
  'Manufacturer': '製造元',
  'Version': 'バージョン',
  'Override Vendor/Product ID': 'Vendor ID / Product ID を上書き',
  'Vendor ID': 'Vendor ID',
  'Product ID': 'Product ID',
  'LIVE PREVIEW · HALL CH 0–15': 'ライブプレビュー · Hall CH 0–15',
  'Connected': '接続済み',
  'Keys follow each input’s existing Gamepad action': '各キーは対応するゲームパッド操作に従います',
  'Select a channel to edit its assignment': 'チャンネルを選択して割り当てを編集します',
  'SELECTED CHANNEL': '選択中のチャンネル',
  'Existing Gamepad action': '現在のゲームパッド操作',
  'Gamepad action': 'ゲームパッド操作',
  'HID key for {{action}}': '{{action}} に割り当てる HID キー',
  'This action has no Keyboard HID mapping.': 'この操作にはキーボード HID の割り当てがありません。',
  'No Keyboard HID mapping': 'キーボード HID の割り当てなし',
  'NONE': '未割り当て', 'UP': '上', 'DOWN': '下', 'LEFT': '左', 'RIGHT': '右',
  'Up': '上', 'Down': '下', 'Left': '左', 'Right': '右',
  'Disabled': '無効',
  'Physical Hall channel': 'Hall チャンネル',
  'ADC29 · 16-channel multiplexer · Select pins 13 / 14 / 15 / 26': 'ADC29 · 16 チャンネルMUX · 選択ピン 13 / 14 / 15 / 26',
  'GPIO ASSIGNMENTS · GP0–GP5': 'GPIO 割り当て · GP0–GP5',
  'GP13–GP15, GP25–GP26 and GP29 are reserved for add-ons and are hidden.': 'GP13–GP15、GP25–GP26、GP29 はアドオン用に予約されているため表示していません。',
  'Unassigned': '未割り当て',
  'Turbo · B1': 'Turbo · B1', 'Turbo · B2': 'Turbo · B2', 'Turbo · B3': 'Turbo · B3', 'Turbo · B4': 'Turbo · B4',
  'Macro 1': 'マクロ 1', 'Macro 2': 'マクロ 2', 'Macro 3': 'マクロ 3', 'Macro 4': 'マクロ 4',
  'Accelerator': 'アクセル', 'Brake': 'ブレーキ', 'Home': 'Home',
  'Menu Down': 'メニュー 下', 'Menu Select': 'メニュー 決定', 'Menu Back': 'メニュー 戻る', 'Function (Fn)': 'ファンクション (Fn)',
  'PC / current': 'PC / 現行', 'console': 'ゲーム機',
  'XInput': 'XInput', 'Nintendo Switch': 'Nintendo Switch', 'PS3': 'PS3', 'Keyboard': 'キーボード', 'PS4': 'PS4', 'Xbox One': 'Xbox One', 'Original Xbox': '初代 Xbox', 'PS5': 'PS5', 'Generic HID': '汎用 HID', 'Nintendo Switch Pro': 'Nintendo Switch Pro', 'P5 General': 'P5 General', 'SInput': 'SInput',
  'Gamepad': 'ゲームパッド', 'Wheel': 'ハンドルコントローラー', 'HOTAS': 'HOTAS', 'Guitar': 'ギター', 'Drums': 'ドラム', 'Arcade stick': 'アーケードスティック',
  'Enter': '改行', 'Escape': 'ESC', 'Backspace': 'BS(Backspace)', 'Tab': 'Tab', 'Space': 'スペース(Space)', 'Minus': 'マイナス(-)', 'Equal': 'イコール(=)', 'Bracket Left': '左角括弧([)', 'Bracket Right': '右角括弧(])', 'Backslash': '￥/バックスラッシュ(\\)', 'Intl Hash': '国際キー #', 'Semicolon': 'セミコロン(;)', 'Quote': '引用符(\')', 'Backquote': 'バッククォート(`)', 'Comma': 'カンマ(,)', 'Period': 'ピリオド(.)', 'Slash': 'スラッシュ(/)', 'CapsLock': 'Caps Lock', 'Print Screen': 'Print Screen', 'Scroll Lock': 'Scroll Lock', 'Pause': 'Pause', 'Insert': 'Ins(Insert)', 'Page Up': 'Page Up', 'Delete': 'Del(Delete)', 'End': 'End', 'Page Down': 'Page Down', 'Arrow Right': '右矢印(→)', 'Arrow Left': '左矢印(←)', 'Arrow Down': '下矢印(↓)', 'Arrow Up': '上矢印(↑)', 'NumLock': 'Num Lock', 'Numpad Slash': 'テンキー /', 'Numpad Asterisk': 'テンキー *', 'Numpad Minus': 'テンキー -', 'Numpad Plus': 'テンキー +', 'Numpad Enter': 'テンキー Enter', 'Numpad Period': 'テンキー .', 'Intl Backslash': '国際キー バックスラッシュ', 'Numpad Equals': 'テンキー =', 'Control Left': '左 Ctrl', 'Shift Left': '左 Shift', 'Alt Left': '左 Alt', 'Meta Left': '左 Meta', 'Control Right': '右 Ctrl', 'Shift Right': '右 Shift', 'Alt Right': '右 Alt', 'Meta Right': '右 Meta', 'Next Track': '次のトラック', 'Prev Track': '前のトラック', 'Stop': '停止', 'Play/Pause': '再生 / 一時停止', 'Mute': 'ミュート', 'Volume Up': '音量を上げる', 'Volume Down': '音量を下げる',
  'Unknown (0x{{code}})': '不明 (0x{{code}})',

  'KEY SELECTOR · ADC29': 'キー選択 · ADC29', 'Live signal': '接続済み', 'Select all': 'すべて選択', '{{count}} selected': '{{count}} 個選択中',
  '{{channel}} · {{label}} travel': '{{channel}} · {{label}} のストローク',
  'EDITING': '編集中', '· {{count}} CHANNELS': '· {{count}} チャンネル',
  'Actuation point': 'アクチュエーションポイント', 'Release point': 'リリースポイント', 'Rapid Trigger Threshold': 'ラピッドトリガーの有効範囲 (しきい値)',
  'Rapid Trigger Noise Filter': 'ラピッドトリガーの許容範囲 (ノイズフィルター)', 'Rapid Trigger': 'ラピッドトリガー',
  'Reset as soon as the key moves upward': 'キーが戻り始めるとすぐにリセットします',
  'Calibrate all Hall buttons': 'すべての磁気スイッチを校正',
  'Live calibration is disabled until firmware supports ADC29 voltage reads.': 'ファームウェアが ADC29 の電圧読み取りに対応するまで、ライブ校正は利用できません。',

  'MAGNETIC INPUT / CALIBRATION': '磁気入力 / 校正',
  'Measuring idle position': '未押下時の位置を測定中',
  'Press each button once · {{complete}}/16 complete': '各ボタンを一度押してください · {{complete}}/16 完了',
  'Review calibration results': '校正結果の確認', 'Calibration error': '校正エラー',
  'Leave all buttons untouched while every channel is measured.': 'すべてのチャンネルを測定します。測定中はボタンに触れないでください。',
  'Yellow buttons need a press. Click yellow to skip or green to remeasure.': '黄色のボタンを押してください。黄色をクリックするとスキップ、緑色をクリックすると再測定します。',
  'Review the measured values before applying them to the draft.': '測定値を設定に反映する前に確認してください。',
  'Cancel': 'キャンセル', 'Preparing...': '準備中…', 'CH{{channel}} · {{label}}': 'CH{{channel}} · {{label}}',
  'Attempt {{attempt}} / 30': '試行 {{attempt}} / 30', 'Attempt {{attempt}}/30': '試行 {{attempt}}/30', '{{count}} samples': '{{count}} サンプル', '{{successful}} / {{total}} complete': '{{total}} チャンネル中 {{successful}} 完了',
  'PHYSICAL PROGRESS · CH IDs': '物理ボタンの進捗 · CH番号', 'CHANNEL STATUS': 'チャンネルの状態',
  '{{failed}} failed': '{{failed}} 件失敗', 'Blue = reading now · Yellow = skip · Green = complete': '青 = 読み取り中 · 黄 = スキップ · 緑 = 完了',
  'Finish capture and review': '測定を終了して結果を確認', 'Apply and save calibration': '校正結果を反映して保存',
  'Raw calibration results': '校正結果の詳細', 'Calibration results': '校正結果', 'CH': 'CH', 'Button': 'ボタン', 'Idle': '未押下', 'Pressed': '押下', 'Span': '変化量', 'Samples': 'サンプル数', 'Latest': '最新値', 'Status': '状態', 'Polarity': '極性',
  'preparing': '準備中', 'waiting': '待機中', 'pressing': '押下中', 'complete': '完了', 'skipped': 'スキップ', 'unstable': '不安定', 'error': 'エラー',
  'AUTOMATIC CALIBRATION': '自動校正', 'Leave all Hall buttons untouched. The configurator is sampling every channel automatically.': '磁気スイッチに触れないでください。設定アプリが各チャンネルを自動測定しています。',
  'Press each button fully once, in any order. Completed buttons turn green.': '順番は自由です。各ボタンを一度、最後まで押してください。完了したボタンは緑色になります。',
  'Calibration results saved to RapidJAM': '校正結果を RapidJAM に保存しました',
  'No completed calibration results to apply': '反映できる校正結果がありません', 'Calibration failed': '校正に失敗しました', 'Calibration save failed': '校正結果を保存できませんでした', 'Calibration cancelled': '校正をキャンセルしました',
  'RapidJAM is ready for re-measurement': 'RapidJAM は再測定の準備ができました',
  'Preparing device': 'デバイスを準備中', 'Press phase ready': '押下測定の準備完了', 'Checking for button press': 'ボタンの押下を確認中', 'Reading pressed channel': '押下チャンネルを読み取り中', 'Button captured': 'ボタンを測定しました', 'Ready to re-measure channel': 'チャンネルの再測定準備完了',
  'Baseline sample {{round}} / {{total}}': '未押下値を測定中 {{round}} / {{total}}',
  'All Hall channels are complete. Review the results before applying them.': 'すべてのチャンネルの測定が完了しました。反映する前に結果を確認してください。',
  'Leave all Hall buttons untouched while measuring idle values': '未押下値の測定中は磁気スイッチに触れないでください',
  'Press each Hall button fully, in any order': '順番は自由です。各磁気スイッチを最後まで押してください',
  'Live Hall calibration is disabled: the current firmware cannot read RapidJAM ADC29': '現在のファームウェアは RapidJAM の ADC29 を読み取れないため、ライブ校正を利用できません',
  'Voltage read failed': '電圧を読み取れませんでした', 'Fewer than three successful baseline samples': '未押下値を3回以上取得できませんでした', 'Button released before three samples': '3回のサンプル取得前にボタンが離されました', 'Skipped by user': 'ユーザーがスキップしました',

  'Ready to configure': '設定できます', 'Unable to connect': '接続できませんでした', 'Unable to restart RapidJAM': 'RapidJAM を再起動できませんでした',
  'Preview active on device': 'プレビューを表示中', 'Preview failed': 'プレビューに失敗しました', 'Saved to RapidJAM': 'RapidJAM に保存しました',
  'Save failed': '保存に失敗しました', 'Changes discarded': '変更を破棄しました',
  'Calibration results applied to draft': '校正結果を設定に反映しました',
  'Failed to save configuration. Your changes are still available to retry.': '設定を保存できませんでした。変更内容は保持されています。再試行できます。',
  'Failed to connect to RapidJAM. Check the USB cable and WebConfig/RNDIS mode.': 'RapidJAM に接続できませんでした。USB ケーブルと WebConfig/RNDIS モードを確認してください。',
  'Failed to reconnect after saving. Reconnect and read back the device settings before trying again.': '保存後に再接続できませんでした。再接続してデバイスの設定を読み直してから、もう一度お試しください。',
  'Failed to restart RapidJAM.': 'RapidJAM を再起動できませんでした。',
  'The device is not reachable. Check the USB connection and WebConfig/RNDIS mode.': 'デバイスに接続できません。USB 接続と WebConfig/RNDIS モードを確認してください。',
  'No voltage returned for CH{{channel}}': 'CH{{channel}} の電圧を取得できませんでした',
  'CH{{channel}} voltage read failed after 30 attempts': 'CH{{channel}} の電圧を30回試行しても取得できませんでした',
  'Unsupported GP2040 GPIO action: {{value}}': '未対応の GP2040 GPIO 操作です: {{value}}',
  '{{assignment}} is not supported by the GP2040 GPIO API': '{{assignment}} は GP2040 GPIO API でサポートされていません',
}

function isLocale(value: string | null): value is Locale {
  return value === 'en' || value === 'ja'
}

function getInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isLocale(stored)) return stored
  } catch {
    // Storage may be unavailable in restricted browser contexts.
  }
  return navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en'
}

function replaceValues(text: string, values?: TranslationValues): string {
  if (!values) return text
  return text.replace(/{{\s*(\w+)\s*}}/g, (match, key: string) => String(values[key] ?? match))
}

function translateTemplate(text: string): string {
  const exact = japanese[text]
  if (exact) return exact
  for (const [template, translation] of Object.entries(japanese)) {
    if (!template.includes('{{')) continue
    const expression = new RegExp(`^${template.split(/({{\s*\w+\s*}})/g).map((part) => part.startsWith('{{') ? '(.+?)' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('')}$`)
    const match = text.match(expression)
    if (match) {
      let index = 1
      return translation.replace(/{{\s*\w+\s*}}/g, () => match[index++] ?? '')
    }
  }
  return text
}

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale)

  useEffect(() => {
    document.documentElement.lang = locale === 'ja' ? 'ja-JP' : 'en'
    try {
      localStorage.setItem(STORAGE_KEY, locale)
    } catch {
      // Language switching still works for this session if storage is unavailable.
    }
  }, [locale])

  const value = useMemo<LocalizationValue>(() => ({
    locale,
    setLocale: setLocaleState,
    t: (text, values) => replaceValues(locale === 'ja' ? translateTemplate(text) : text, values),
  }), [locale])

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>
}
