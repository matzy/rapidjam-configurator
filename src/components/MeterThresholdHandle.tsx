import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import { meterClientXToMillimeters, POSITION_STEP_MM } from '../utils/calibrationMath'

interface MeterThresholdHandleProps {
  trackRef: RefObject<HTMLDivElement | null>
  sessionKey: string
  strokeMm: number
  value: number
  displayValue: number
  label: string
  className: string
  style: CSSProperties
  max?: number
  onPreview: (value: number | null) => void
  onCommit: (value: number) => void
}

export function MeterThresholdHandle({ trackRef, sessionKey, strokeMm, value, displayValue, label, className, style, max = strokeMm, onPreview, onCommit }: MeterThresholdHandleProps) {
  const dragging = useRef<number | null>(null)
  const startValue = useRef(value)
  const pendingValue = useRef(value)
  const sessionKeyRef = useRef(sessionKey)
  const onPreviewRef = useRef(onPreview)

  useEffect(() => { onPreviewRef.current = onPreview }, [onPreview])

  useEffect(() => {
    const cancelOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || dragging.current === null) return
      event.preventDefault()
      dragging.current = null
      pendingValue.current = startValue.current
      onPreviewRef.current(null)
    }
    window.addEventListener('keydown', cancelOnEscape)
    return () => window.removeEventListener('keydown', cancelOnEscape)
  }, [])

  useEffect(() => {
    if (sessionKeyRef.current === sessionKey) return
    sessionKeyRef.current = sessionKey
    dragging.current = null
    onPreview(null)
  }, [sessionKey, onPreview])

  function valueAt(clientX: number): number | null {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return null
    const nextValue = meterClientXToMillimeters(clientX, rect.left, rect.width, strokeMm)
    return nextValue === null ? null : Math.min(max, nextValue)
  }

  function previewAt(clientX: number) {
    const nextValue = valueAt(clientX)
    if (nextValue === null) return
    pendingValue.current = nextValue
    onPreview(nextValue)
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    dragging.current = event.pointerId
    startValue.current = value
    pendingValue.current = value
    event.currentTarget.setPointerCapture(event.pointerId)
    previewAt(event.clientX)
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (dragging.current !== event.pointerId) return
    previewAt(event.clientX)
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (dragging.current !== event.pointerId) return
    previewAt(event.clientX)
    const committedValue = pendingValue.current
    dragging.current = null
    onPreview(null)
    if (committedValue !== startValue.current) onCommit(committedValue)
  }

  function cancelPointer(event: PointerEvent<HTMLButtonElement>) {
    if (dragging.current !== event.pointerId) return
    dragging.current = null
    pendingValue.current = startValue.current
    onPreview(null)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    let nextValue: number | null = null
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') nextValue = Math.max(POSITION_STEP_MM, value - POSITION_STEP_MM)
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') nextValue = Math.min(max, value + POSITION_STEP_MM)
    else if (event.key === 'Home') nextValue = POSITION_STEP_MM
    else if (event.key === 'End') nextValue = max
    else if (event.key === 'Escape' && dragging.current !== null) {
      event.preventDefault()
      dragging.current = null
      onPreview(null)
      return
    }
    if (nextValue === null) return
    event.preventDefault()
    const snapped = Number(Math.max(0.05, Math.min(max, nextValue)).toFixed(2))
    if (snapped !== value) onCommit(snapped)
  }

  return <button
    type="button"
    className={`meter-marker ${className}`}
    style={{ ...style, '--marker-offset': className === 'threshold' ? '7px' : '-7px' } as CSSProperties}
    role="slider"
    aria-label={label}
    aria-valuemin={0.05}
    aria-valuemax={max}
    aria-valuenow={displayValue}
    aria-orientation="horizontal"
    aria-valuetext={`${displayValue.toFixed(2)} mm`}
    onPointerDown={handlePointerDown}
    onPointerMove={handlePointerMove}
    onPointerUp={handlePointerUp}
    onPointerCancel={cancelPointer}
    onLostPointerCapture={cancelPointer}
    onKeyDown={handleKeyDown}
  />
}