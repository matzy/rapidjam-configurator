/**
 * Workarounds for known firmware bugs in RapidJAM firmware builds that predate
 * GP2040-CE_RapidJAM `worktree-adc29-unstable` (commits 2c3244cc, f9bba46a).
 *
 * Everything here is removable once a firmware containing those fixes is the
 * supported baseline. Each workaround is behind a flag in FW_WORKAROUNDS and its
 * call sites are tagged `FW-WORKAROUND(WA-n)`. See docs/fw-workarounds.md for the
 * removal procedure.
 */

export interface FwWorkaroundFlags {
  /** WA-1: one /api request at a time, with a short gap (firmware use-after-free on response strings). */
  serializeRequests: boolean
  /** WA-2: retry a live Hall read when the response body arrives corrupted. */
  retryCorruptLiveReads: boolean
  /** WA-3: re-send setHETriggerOptions when the firmware reports "mux channels incorrect" after boot. */
  reseedMuxOnError: boolean
  /** WA-4: discard the first reading after switching channels (firmware EMA state is shared by all channels). */
  discardFirstReadOnChannelSwitch: boolean
}

export const FW_WORKAROUNDS: FwWorkaroundFlags = {
  serializeRequests: true,
  retryCorruptLiveReads: true,
  reseedMuxOnError: true,
  discardFirstReadOnChannelSwitch: true,
}
