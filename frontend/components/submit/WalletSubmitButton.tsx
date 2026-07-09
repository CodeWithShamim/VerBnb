'use client';

import { useState } from 'react';
import { newDisputeId } from '@/lib/contracts';
import { useWalletDispute } from '@/lib/useWalletDispute';
import type { SubmitButtonProps } from '@/components/SubmitButton';

/**
 * Submits the dispute signed by the user's connected wallet (Privy → genlayer-js).
 * If no wallet is connected it prompts the Privy login first.
 */
export default function WalletSubmitButton({
  category,
  getValues,
  validate,
  onError,
  onSuccess,
  disabled,
}: SubmitButtonProps) {
  const { ready, connected, login, submit } = useWalletDispute();
  const [pending, setPending] = useState(false);

  async function handle() {
    const v = validate();
    if (v) {
      onError(v);
      return;
    }
    onError(null);

    if (!connected) {
      login();
      return;
    }

    setPending(true);
    const disputeId = newDisputeId(category);
    try {
      const res = await submit({ category, disputeId, ...(getValues() as any) });
      onSuccess(disputeId, res.specialistTx);
    } catch (e: any) {
      const msg = e?.message || 'Submission failed';
      onError(
        /user rejected|denied/i.test(msg) ? 'You rejected the transaction in your wallet.' : msg,
      );
      setPending(false);
    }
  }

  const label = !ready
    ? 'Loading wallet…'
    : !connected
      ? 'Connect wallet to submit'
      : pending
        ? 'Confirm in your wallet…'
        : 'Sign & submit dispute';

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="btn-primary w-full py-3.5 text-base"
        disabled={!ready || pending || disabled}
        onClick={handle}
      >
        {pending ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            {label}
          </>
        ) : (
          label
        )}
      </button>
      {connected && (
        <p className="text-center text-xs text-slate-400">
          You&apos;ll sign this dispute with your own wallet - no platform key.
        </p>
      )}
    </div>
  );
}
