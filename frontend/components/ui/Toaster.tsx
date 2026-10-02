"use client";

import { useCallback, useState } from "react";
import { Check, AlertCircle } from "lucide-react";
import { useBus } from "@/lib/bus";

interface ToastItem {
  id: number;
  message: string;
  tone: "ok" | "error";
}

let nextId = 1;

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((d: { message: string; tone?: "ok" | "error" }) => {
    const id = nextId++;
    setItems((prev) => [...prev.slice(-2), { id, message: d.message, tone: d.tone ?? "ok" }]);
    window.setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 2600);
  }, []);

  useBus("toast", push);

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[200] flex -translate-x-1/2 flex-col items-center gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className="animate-pop-in flex items-center gap-2 rounded-full border border-white/10 bg-[#131316]/95 py-2 pl-3 pr-4 text-xs text-gray-200 shadow-2xl backdrop-blur-md"
        >
          {t.tone === "ok" ? (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-up/15 text-up">
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
          ) : (
            <AlertCircle className="h-4 w-4 text-down" />
          )}
          {t.message}
        </div>
      ))}
    </div>
  );
}
