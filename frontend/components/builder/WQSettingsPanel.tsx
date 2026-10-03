"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { InfoTip } from "@/components/ui/InfoTip";
import type { WQNeutralization, WQUniverse } from "@/lib/types";

export interface WQSettings {
  universe: WQUniverse;
  neutralization: WQNeutralization;
  delay: number;
  decay: number;
}

export const WQ_DEFAULT_SETTINGS: WQSettings = {
  universe: "TOP3000",
  neutralization: "SUBINDUSTRY",
  delay: 1,
  decay: 0,
};

interface WQSettingsPanelProps {
  settings: WQSettings;
  onChange: (s: WQSettings) => void;
}

function Label({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <span className="eyebrow">{label}</span>
      <InfoTip text={tooltip} />
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      data-active={active}
      className="chip h-7 rounded-lg px-2.5 font-mono text-[11px] font-medium"
    >
      {children}
    </button>
  );
}

export function WQSettingsPanel({ settings, onChange }: WQSettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const summary = `${settings.universe} · ${settings.neutralization} · D${settings.delay}${settings.decay > 0 ? ` · decay ${settings.decay}` : ""}`;

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors hover:bg-white/[0.03]">
        <div className="min-w-0">
          <div className="eyebrow">WorldQuant BRAIN settings</div>
          <div className="mt-1 truncate font-mono text-[11px] text-gray-500">{summary}</div>
        </div>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 text-gray-600 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="animate-fade-in space-y-4 border-t border-white/[0.06] px-3.5 pb-4 pt-4">
          <div>
            <Label
              label="Universe"
              tooltip="Stock universe by market-cap rank. TOP3000 is the standard for WorldQuant competitions and covers most US large and mid caps. TOP1000 is more liquid but harder to differentiate on."
            />
            <div className="flex flex-wrap gap-1.5">
              {(["TOP3000", "TOP1000", "TOP500", "TOP200"] as WQUniverse[]).map((u) => (
                <Chip key={u} active={settings.universe === u} onClick={() => onChange({ ...settings, universe: u })}>
                  {u}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <Label
              label="Neutralization"
              tooltip="Which benchmark bets are removed from the alpha. SUBINDUSTRY is the strictest, leaving pure stock selection. SECTOR is looser. NONE keeps every macro bet. BRAIN tends to reward SUBINDUSTRY alphas most consistently."
            />
            <div className="flex flex-wrap gap-1.5">
              {(["SUBINDUSTRY", "INDUSTRY", "SECTOR", "MARKET", "NONE"] as WQNeutralization[]).map((n) => (
                <Chip key={n} active={settings.neutralization === n} onClick={() => onChange({ ...settings, neutralization: n })}>
                  {n}
                </Chip>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label
                label="Delay"
                tooltip="When trades happen relative to the data. Delay 1 means you use data through yesterday and trade today, the standard for BRAIN submissions. Delay 0 lets the signal use today's data and trade today, which BRAIN allows for some datasets and which is harder to pass. This only applies to BRAIN. The local backtest always uses delay 1: score at today's close, earn tomorrow's return."
              />
              <div className="flex gap-1.5">
                {[0, 1].map((d) => (
                  <Chip key={d} active={settings.delay === d} onClick={() => onChange({ ...settings, delay: d })}>
                    D{d}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <Label
                label="Decay"
                tooltip="Smoothing applied to the signal before execution. 0 uses the raw signal. Higher values cut turnover and costs at the expense of gross returns. BRAIN applies it after your expression, so it stacks with any ts_decay_linear you add."
              />
              <input
                type="number"
                value={settings.decay}
                min={0}
                max={30}
                onChange={(e) => onChange({ ...settings, decay: Number(e.target.value) })}
                className="field !h-7 !px-2 font-mono !text-[11px]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
