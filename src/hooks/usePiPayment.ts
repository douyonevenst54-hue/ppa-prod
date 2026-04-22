"use client";

interface PaymentOptions {
  amount: number;
  memo: string;
  metadata?: Record<string, unknown>;
  userId?: string;
  ppaReward?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
  onError?: (error: string) => void;
}

async function ensurePiReady(): Promise<boolean> {
  let attempts = 0;
  while (!window.Pi && attempts < 30) {
    await new Promise(r => setTimeout(r, 300));
    attempts++;
  }
  if (!window.Pi) return false;

  try {
    window.Pi.init({
      version: "2.0",
      sandbox: process.env.NEXT_PUBLIC_PI_SANDBOX === "true",
    });
    await new Promise(r => setTimeout(r, 500));
    return true;
  } catch {
    return false;
  }
}

export function usePiPayment() {
  async function createPayment(options: PaymentOptions) {
    const {
      amount,
      memo,
      metadata = {},
      userId,
      ppaReward,
      onSuccess,
      onCancel,
      onError,
    } = options;

    const ready = await ensurePiReady();

    if (!ready || !window.Pi) {
      onError?.("Pi SDK not available. Open in Pi Browser.");
      return;
    }

    try {
      window.Pi.createPayment(
        { amount, memo, metadata },
        {
          onReadyForServerApproval: async (paymentId: string) => {
            try {
              const res = await fetch("/api/payments/approve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paymentId }),
              });
              if (!res.ok) throw new Error("Approval failed");
            } catch (err) {
              console.error("Approval error:", err);
              onError?.("Payment approval failed");
            }
          },

          onReadyForServerCompletion: async (paymentId: string, txid: string) => {
            try {
              const res = await fetch("/api/payments/complete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paymentId, txid, userId, ppaReward }),
              });
              if (!res.ok) throw new Error("Completion failed");
              onSuccess?.();
            } catch (err) {
              console.error("Completion error:", err);
              onError?.("Payment completion failed");
            }
          },

          onCancel: (_paymentId: string) => {
            onCancel?.();
          },

          onError: (error: Error) => {
            console.error("Pi payment error:", error);
            onError?.(error.message);
          },
        }
      );
    } catch (err) {
      console.error("createPayment error:", err);
      onError?.("Failed to initiate payment");
    }
  }

  return { createPayment };
}