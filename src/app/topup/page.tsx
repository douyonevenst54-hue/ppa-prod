/**
 * /topup — replaces /exchange.
 *
 * Add a redirect for the old path in next.config.js:
 *   { source: '/exchange', destination: '/topup', permanent: false }
 *
 * ADAPT: getSessionUser + your layout wrapper.
 */

'use client';

import { useEffect, useState } from 'react';
import TopUpPanel from '@/components/TopUpPanel';
import LegalFooter from '@/components/LegalFooter';

export default function TopUpPage() {
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((d) => setBalance(d.ppaBalance ?? 0))
      .catch(() => setBalance(0));
  }, []);

  return (
    <main className="min-h-dvh bg-[#0A0A11]">
      <TopUpPanel balance={balance} onBalanceChange={setBalance} />
      <LegalFooter />
    </main>
  );
}
