import { useSpeechBridge } from '../hooks/useSpeechBridge'

/** Invisible always-on host for mic capture (avoids background throttling of the Hub). */
export function CapturePage() {
  useSpeechBridge(true)
  return (
    <div
      style={{
        width: 1,
        height: 1,
        overflow: 'hidden',
        opacity: 0,
        pointerEvents: 'none',
      }}
    />
  )
}
