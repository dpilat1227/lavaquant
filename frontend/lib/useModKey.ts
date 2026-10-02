"use client";

import { useEffect, useState } from "react";

/** "⌘" on Apple platforms, "Ctrl" elsewhere. Defaults to ⌘ for SSR consistency. */
export function useModKey(): string {
  const [mod, setMod] = useState("⌘");
  useEffect(() => {
    if (!/Mac|iPhone|iPad/i.test(navigator.platform)) setMod("Ctrl");
  }, []);
  return mod;
}
