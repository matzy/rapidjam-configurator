import assert from 'node:assert/strict'
import test from 'node:test'
import { recordLiveReadingFailure, recordLiveReadingSuccess } from '../src/utils/liveReadingState.ts'

test('一時的な失敗では前回値を保ち、連続6回目だけエラーにする', () => {
  const success = recordLiveReadingSuccess(1234)
  const firstFailure = recordLiveReadingFailure(success.state)
  assert.equal(firstFailure.outcome, 'stale')
  assert.equal(firstFailure.state.voltage, 1234)

  const secondFailure = recordLiveReadingFailure(firstFailure.state)
  assert.equal(secondFailure.outcome, 'stale')
  assert.equal(secondFailure.state.voltage, 1234)

  let latestFailure = secondFailure
  for (let failure = 3; failure <= 5; failure++) {
    latestFailure = recordLiveReadingFailure(latestFailure.state)
    assert.equal(latestFailure.outcome, 'stale')
    assert.equal(latestFailure.state.voltage, 1234)
  }

  const sixthFailure = recordLiveReadingFailure(latestFailure.state)
  assert.equal(sixthFailure.outcome, 'error')
  assert.equal(sixthFailure.state.voltage, null)
})

test('成功すると連続失敗数がリセットされ、次の失敗は再び一時扱いになる', () => {
  const firstFailure = recordLiveReadingFailure(recordLiveReadingSuccess(1000).state)
  const recovered = recordLiveReadingSuccess(1100)
  assert.equal(recovered.state.consecutiveFailures, 0)
  assert.equal(recordLiveReadingFailure(recovered.state).outcome, 'stale')
  assert.equal(firstFailure.state.consecutiveFailures, 1)
})

test('最初の読み取り前は失敗2回まで読み取り中とし、タイムアウトは即エラーにする', () => {
  const initial = { consecutiveFailures: 0, voltage: null }
  const firstFailure = recordLiveReadingFailure(initial)
  assert.equal(firstFailure.outcome, 'reading')
  assert.equal(recordLiveReadingFailure(firstFailure.state).outcome, 'reading')
  assert.equal(recordLiveReadingFailure(initial, true).outcome, 'error')
})