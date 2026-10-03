"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Segmented } from "@/components/ui/Segmented";
import { InfoTip } from "@/components/ui/InfoTip";
import type { Universe } from "@/lib/types";

interface BacktestControlsProps {
  universe: Universe;
  onUniverseChange: (v: Universe) => void;
  startDate: string;
  onStartDateChange: (v: string) => void;
  endDate: string;
  onEndDateChange: (v: string) => void;
  forwardDays: number;
  onForwardDaysChange: (v: number) => void;
  sectorNeutral?: boolean;
  onSectorNeutralChange?: (v: boolean) => void;
  showSectorNeutral?: boolean;
}

const UNIVERSES: { value: Universe; label: string; description: string }[] = [
  { value: "sp500", label: "US Equities", description: "~100 large-cap stocks (S&P 500 constituents)" },
  { value: "etfs", label: "Sector ETFs", description: "20 sector and factor ETFs: XLE, XLF, XLK, VNQ, TLT…" },
  { value: "forex", label: "Forex", description: "10 major currency pairs: EUR/USD, GBP/USD, USD/JPY…" },
  { value: "commodities", label: "Commodities", description: "Futures and ETFs: gold, oil, nat gas, corn, soybeans" },
];

const FORWARD_DAYS = [1, 3, 5, 10, 21];

function Label({ children, tip }: { children: React.ReactNode; tip?: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <label className="eyebrow">{children}</label>
      {tip && <InfoTip text={tip} />}
    </div>
  );
}

export function BacktestControls({
  universe,
  onUniverseChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  forwardDays,
  onForwardDaysChange,
  sectorNeutral,
  onSectorNeutralChange,
  showSectorNeutral = false,
}: BacktestControlsProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label>Universe</Label>
        <Select value={universe} onValueChange={(v) => onUniverseChange(v as Universe)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UNIVERSES.map((u) => (
              <SelectItem key={u.value} value={u.value} description={u.description}>
                {u.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Start</Label>
          <input type="date" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} className="field" />
        </div>
        <div>
          <Label>End</Label>
          <input type="date" value={endDate} onChange={(e) => onEndDateChange(e.target.value)} className="field" />
        </div>
      </div>

      <div>
        <Label tip="How many trading days ahead the score is checked against. It changes IC and IC-IR only. Sharpe, return and drawdown always come from rebalancing daily, so they don't move. Short horizons suit fast signals like reversal; longer ones suit slow ones like value or momentum.">
          Prediction horizon
        </Label>
        <Segmented
          size="sm"
          value={forwardDays}
          onChange={onForwardDaysChange}
          options={FORWARD_DAYS.map((d) => ({ value: d, label: `${d}d` }))}
        />
      </div>

      {showSectorNeutral && onSectorNeutralChange && (
        <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
          <div>
            <div className="flex items-center gap-1.5 text-[13px] font-medium text-gray-200">
              Sector neutral
              <InfoTip text="Removes sector bets from the local backtest. The local engine only has sector codes, so sector is the only neutralization it offers. WorldQuant BRAIN has a full set (subindustry, industry, sector, market) in the BRAIN settings below, which apply only when you submit to BRAIN." />
            </div>
            <div className="text-[11px] text-gray-500">Local backtest only · BRAIN options below</div>
          </div>
          <Switch checked={sectorNeutral} onCheckedChange={onSectorNeutralChange} />
        </div>
      )}
    </div>
  );
}
