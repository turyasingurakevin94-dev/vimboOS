/**
 * The gap between the switch deciding and the design arriving.
 *
 * Deliberately not a spinner and not a skeleton: both are device-specific
 * furniture, and at this point we have not committed to a device yet. A
 * calm empty canvas for ~100ms reads as the app opening. A spinner for
 * ~100ms reads as the app being slow.
 */
export function Booting(): React.ReactElement {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ minHeight: '100dvh', background: 'var(--ow-color-canvas)' }}
    >
      <span className="ow-sr-only">Loading Omni-Ware</span>
    </div>
  );
}
