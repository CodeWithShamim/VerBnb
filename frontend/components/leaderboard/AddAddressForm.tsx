"use client";

import { useState, type FormEvent } from "react";
import { isValidAddress } from "@/lib/leaderboard";

/**
 * Small inline form to add any wallet address to the leaderboard candidate
 * set. Validates the 0x-40-hex shape and surfaces duplicate rejections.
 */
export default function AddAddressForm({
  onAdd,
}: {
  /** Returns false when the address was rejected (duplicate). */
  onAdd: (address: string) => boolean;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const addr = value.trim();
    if (!isValidAddress(addr)) {
      setError("Enter a valid address (0x + 40 hex characters).");
      return;
    }
    if (!onAdd(addr)) {
      setError("That address is already on the board.");
      return;
    }
    setValue("");
    setError(null);
  }

  return (
    <form onSubmit={submit} className="w-full sm:w-auto">
      <div className="flex items-stretch gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          placeholder="0x… add any wallet"
          spellCheck={false}
          autoComplete="off"
          aria-label="Wallet address to add"
          aria-invalid={!!error}
          className={`w-full min-w-0 rounded-xl border bg-white px-3.5 py-2 font-mono text-xs text-slate-700 outline-none transition-colors placeholder:font-sans placeholder:text-slate-400 focus:border-brand/50 sm:w-72 ${
            error ? "border-rose-300" : "border-surface-border"
          }`}
        />
        <button
          type="submit"
          className="btn-primary shrink-0 px-4 py-2 text-sm"
          disabled={!value.trim()}
        >
          Add
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-rose-500">{error}</p>}
    </form>
  );
}
