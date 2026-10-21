'use client';

/**
 * TESTNET badge.
 *
 * In the original screen recording a payment completed with 5.0 Test-Pi and
 * nothing on screen said so. Someone who tops up with test currency and
 * believes they spent real Pi has been misled, even accidentally — and at a
 * showcase, where most people seeing the app have never seen it before, that
 * is the likeliest misunderstanding there is.
 *
 * It sits next to the balance until NEXT_PUBLIC_PI_NETWORK=mainnet, then
 * disappears on its own. Nothing to remember to remove.
 *
 * Written originally with Tailwind classes, which this codebase does not use
 * anywhere else — it styles with CSS custom properties and inline styles. A
 * badge that silently renders as unstyled text is worse than no badge, so it
 * now matches the rest of the app.
 */

import { IS_TESTNET } from '@/lib/ppa/policy';

export default function TestnetBadge({ style }: { style?: React.CSSProperties }) {
  if (!IS_TESTNET) return null;

  return (
    <span
      title="This app is running on Pi Testnet. Payments use Test-Pi, which has no value."
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 9px',
        borderRadius: 20,
        border: '1px solid #ffd70055',
        background: '#ffd70014',
        color: '#ffd700',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: '#ffd700',
          flexShrink: 0,
        }}
      />
      Test-Pi
    </span>
  );
}
