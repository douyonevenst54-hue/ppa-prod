/**
 * Pi A2U (App-to-User) payment helpers.
 *
 * Pi runs on a Stellar fork, so server-side A2U requires the Stellar SDK to
 * build, sign, and submit transactions. The Pi platform API orchestrates the
 * payment lifecycle (create -> txid submission -> complete).
 *
 * Flow for sending Pi from the app to a user:
 *   1. POST /v2/payments         -> Pi platform creates a Payment record
 *   2. Build Stellar tx          -> Payment operation: app wallet -> user wallet
 *   3. Sign with app's seed      -> Uses WALLET_PRIVATE_SEED
 *   4. Submit to Horizon         -> Returns a hash (txid)
 *   5. PATCH /v2/payments/:id/complete with the txid -> Pi marks settled
 *
 * Important: Pi blockchain enforces strict sequence numbers, so only ONE A2U
 * payment can be in-flight from a given wallet at a time. We serialize calls
 * via an in-process mutex. (In a multi-instance deployment, this should
 * become a DB-level lock or a single dedicated worker.)
 *
 * Required env vars:
 *   - PI_API_KEY              Pi platform API key for /v2/payments calls
 *   - WALLET_PRIVATE_SEED     App wallet's secret key (S... 56 chars)
 *   - PI_HORIZON_URL          e.g. https://api.testnet.minepi.com
 *   - PI_NETWORK_PASSPHRASE   e.g. "Pi Testnet" or "Pi Network"
 */

import {
  Keypair,
  Horizon,
  TransactionBuilder,
  BASE_FEE,
  Operation,
  Asset,
  Memo,
} from "@stellar/stellar-sdk";

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

export type PiA2UCreateInput = {
  /** Recipient Pi user identifier (the user's pi_uid, NOT their wallet address) */
  uid: string;
  /** Pi amount to send, e.g. 3.88 */
  amount: number;
  /** Memo shown in user's Pi wallet history */
  memo: string;
  /** Free-form metadata stored on the Pi payment record */
  metadata?: Record<string, unknown>;
};

export type PiA2UPayment = {
  identifier: string;
  user_uid: string;
  amount: number;
  memo: string;
  metadata: Record<string, unknown>;
  from_address: string;
  to_address: string;
  direction: "user_to_app" | "app_to_user";
  status: {
    developer_approved: boolean;
    transaction_verified: boolean;
    developer_completed: boolean;
    cancelled: boolean;
    user_cancelled: boolean;
  };
  network: "Pi Network" | "Pi Testnet";
  created_at: string;
};

// ──────────────────────────────────────────────────────────────────────────
// Pi platform API (REST)
// ──────────────────────────────────────────────────────────────────────────

function piApiHeaders() {
  const key = process.env.PI_API_KEY;
  if (!key) throw new Error("PI_API_KEY not set");
  return {
    Authorization: `Key ${key}`,
    "Content-Type": "application/json",
  };
}

/**
 * Step 1 of A2U: ask Pi to create the payment record. Returns the payment
 * with the assigned `to_address` (user's wallet) so we can build the
 * Stellar tx.
 */
export async function createA2UPayment(
  input: PiA2UCreateInput,
): Promise<PiA2UPayment> {
  const res = await fetch("https://api.minepi.com/v2/payments", {
    method: "POST",
    headers: piApiHeaders(),
    body: JSON.stringify({
      payment: {
        amount: input.amount,
        memo: input.memo,
        metadata: input.metadata ?? {},
        uid: input.uid,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pi createA2UPayment failed (${res.status}): ${text}`);
  }
  return res.json();
}

/**
 * Step 5 of A2U: tell Pi the txid so it marks the payment fully settled.
 */
export async function completeA2UPayment(
  paymentId: string,
  txid: string,
): Promise<PiA2UPayment> {
  const res = await fetch(
    `https://api.minepi.com/v2/payments/${paymentId}/complete`,
    {
      method: "POST",
      headers: piApiHeaders(),
      body: JSON.stringify({ txid }),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pi completeA2UPayment failed (${res.status}): ${text}`);
  }
  return res.json();
}

/**
 * Optional rollback helper: tell Pi to cancel a payment we couldn't settle.
 * Pi only allows cancellation in narrow windows (before submission to chain).
 */
export async function cancelA2UPayment(
  paymentId: string,
): Promise<PiA2UPayment | null> {
  try {
    const res = await fetch(
      `https://api.minepi.com/v2/payments/${paymentId}/cancel`,
      {
        method: "POST",
        headers: piApiHeaders(),
      },
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Stellar tx: build, sign, submit
// ──────────────────────────────────────────────────────────────────────────

type SubmitResult = {
  txid: string;
  ledger: number;
};

/**
 * Steps 2-4 of A2U: build a payment operation, sign with the app wallet's
 * secret, and submit to Pi's Horizon. Returns the resulting txid.
 */
export async function signAndSubmitA2U(
  payment: PiA2UPayment,
): Promise<SubmitResult> {
  const seed = process.env.WALLET_PRIVATE_SEED;
  const horizonUrl = process.env.PI_HORIZON_URL;
  const networkPassphrase = process.env.PI_NETWORK_PASSPHRASE;

  if (!seed) throw new Error("WALLET_PRIVATE_SEED not set");
  if (!horizonUrl) throw new Error("PI_HORIZON_URL not set");
  if (!networkPassphrase) throw new Error("PI_NETWORK_PASSPHRASE not set");

  const keypair = Keypair.fromSecret(seed);

  // Sanity: the keypair's public key MUST match the from_address Pi assigned.
  if (keypair.publicKey() !== payment.from_address) {
    throw new Error(
      `Wallet mismatch: app seed produces ${keypair.publicKey()} but Pi assigned from_address ${payment.from_address}`,
    );
  }

  const server = new Horizon.Server(horizonUrl);
  const sourceAccount = await server.loadAccount(keypair.publicKey());

  // Pi memo: include the Pi paymentId so the chain has a back-reference.
  const memoText = `pi:${payment.identifier}`.slice(0, 28);
  const memo = Memo.text(memoText);

  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      Operation.payment({
        destination: payment.to_address,
        asset: Asset.native(),
        amount: payment.amount.toFixed(7),
      }),
    )
    .addMemo(memo)
    .setTimeout(180)
    .build();

  tx.sign(keypair);

  const result = await server.submitTransaction(tx);
  return {
    txid: (result as { hash: string }).hash,
    ledger: Number((result as { ledger?: number }).ledger ?? 0),
  };
}

// ──────────────────────────────────────────────────────────────────────────
// High-level: orchestrate the full A2U flow with safe error reporting.
// Serialized via in-process mutex due to Pi's sequence number constraint.
// ──────────────────────────────────────────────────────────────────────────

export type A2UResult = {
  paymentId: string;
  txid: string;
  amount: number;
};

// Simple promise chain — newest call waits for previous to settle, so
// concurrent A2U requests serialize one after another.
let a2uLock: Promise<unknown> = Promise.resolve();

/**
 * Run the full create -> sign -> submit -> complete pipeline.
 *
 * Throws if any step fails. The caller should:
 *   - hold a DB transaction open while debiting the user
 *   - call this function inside the transaction or with idempotency tracking
 *   - on any throw, NOT credit the user with Pi (they didn't receive it)
 *   - on any throw, decide whether to refund PPA or queue retry
 */
export async function sendA2UPayment(
  input: PiA2UCreateInput,
): Promise<A2UResult> {
  // Chain onto the current lock; whoever was last waiting now releases us.
  const previous = a2uLock;
  let release: () => void = () => {};
  a2uLock = new Promise<void>((resolve) => {
    release = resolve;
  });

  try {
    await previous.catch(() => undefined); // ignore previous errors
    const created = await createA2UPayment(input);
    const { txid } = await signAndSubmitA2U(created);
    await completeA2UPayment(created.identifier, txid);

    return {
      paymentId: created.identifier,
      txid,
      amount: input.amount,
    };
  } finally {
    release();
  }
}
