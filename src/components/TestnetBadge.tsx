'use client';

/**
 * TESTNET badge.
 *
 * In the recording, a payment completed with 5.0 Test-Pi and nothing on screen
 * said so. A user who tops up with test currency and thinks they spent real Pi
 * has been misled, even accidentally. This sits next to the balance until
 * NEXT_PUBLIC_PI_NETWORK=mainnet, then disappears on its own.
 */

import { IS_TESTNET } from '@/lib/ppa/policy';

export default function TestnetBadge({ className = '' }: { className?: string }) {
  if (!IS_TESTNET) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300 ${className}`}
      title="This app is running on Pi Testnet. Payments use Test-Pi, which has no value."
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      Testnet
    </span>
  );
}
