"use client";

import { useState } from "react";
import { X, Lock, ExternalLink, ShieldCheck } from "lucide-react";
import type { WQCredentials } from "@/lib/types";

const WQ_CREDS_KEY = "wq_credentials";

// Session storage only: credentials are forgotten when the tab closes.
export function loadWQCredentials(): WQCredentials | null {
  if (typeof window === "undefined") return null;
  try {
    // Earlier versions persisted the password in localStorage; purge it.
    localStorage.removeItem(WQ_CREDS_KEY);
    const raw = sessionStorage.getItem(WQ_CREDS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveWQCredentials(creds: WQCredentials) {
  sessionStorage.setItem(WQ_CREDS_KEY, JSON.stringify(creds));
}

export function clearWQCredentials() {
  sessionStorage.removeItem(WQ_CREDS_KEY);
  localStorage.removeItem(WQ_CREDS_KEY);
}

interface WQConnectModalProps {
  open: boolean;
  onClose: () => void;
  onConnect: (creds: WQCredentials) => void;
}

export function WQConnectModal({ open, onClose, onConnect }: WQConnectModalProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Email and password are required");
      return;
    }
    const creds: WQCredentials = { username: username.trim(), password };
    saveWQCredentials(creds);
    onConnect(creds);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center">
      <div className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="panel animate-pop-in relative mx-4 w-full max-w-sm !rounded-2xl shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lava-500/70 to-transparent" />
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 pb-4 pt-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-lava-500/30 bg-lava-500/10">
              <Lock className="h-4 w-4 text-lava-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-100">Connect WorldQuant BRAIN</h2>
              <p className="text-xs text-gray-500">Score alphas on their production data</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-600 transition-colors hover:text-gray-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className="eyebrow mb-1.5 block">BRAIN email</label>
            <input
              type="email"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError("");
              }}
              placeholder="you@example.com"
              autoComplete="username"
              className="field"
              autoFocus
            />
          </div>

          <div>
            <label className="eyebrow mb-1.5 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              placeholder="••••••••"
              autoComplete="current-password"
              className="field"
            />
          </div>

          {error && <p className="text-xs text-down">{error}</p>}

          <div className="flex gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-up" />
            <p className="text-[11.5px] leading-relaxed text-gray-500">
              Your login is relayed through this site&apos;s API to WorldQuant for each simulation only. The server doesn&apos;t store or log it, and this browser tab keeps it in
              session storage, so closing the tab forgets it.
            </p>
          </div>

          <button
            type="submit"
            className="h-10 w-full rounded-xl bg-lava-gradient text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_30px_-8px_rgba(255,106,61,0.6)] transition-all hover:brightness-110 active:scale-[0.985]"
          >
            Connect and simulate
          </button>

          <a
            href="https://platform.worldquantbrain.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-xs text-gray-600 transition-colors hover:text-gray-300"
          >
            <ExternalLink className="h-3 w-3" />
            No account? Sign up at WorldQuant BRAIN
          </a>
        </form>
      </div>
    </div>
  );
}
