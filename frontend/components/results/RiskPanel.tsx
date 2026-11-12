"use client";

import { useState } from "react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { InfoTip } from "@/components/ui/InfoTip";
import { VarBacktestChart } from "./VarBacktestChart";
import { longDate } from "@/lib/derive";
import type { RiskMethodRow, RiskReport, VarVerdict } from "@/lib/types";

const d = (i: number) => ({ ["--i" as string]: i });

/** A positive loss as "−2.10%" */
const loss = (v: number | undefined) => (v === undefined ? "—" : `−${(v * 100).toFixed(2)}%`);
/** A signed return to one decimal; a result that rounds to zero shows no sign. */
const signed = (v: number) => {
  const pct = Number((v * 100).toFixed(1));
  return pct === 0 ? "0.0%" : `${pct > 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)}%`;
};
const share = (c: number) => `${Math.round(c * 100)}%`;
const pValue = (p: number) => (p < 0.001 ? "<0.001" : p.toFixed(3));
const forConfidence = (rows: RiskMethodRow[], c: number) => rows.find((r) => r.confidence === c);

type MethodKey = "historical" | "gaussian" | "monte_carlo" | "bootstrap";

const DAILY_METHODS: { key: MethodKey; label: string }[] = [
  { key: "historical", label: "Historical" },
  { key: "gaussian", label: "Gaussian" },
  { key: "monte_carlo", label: "Monte Carlo" },
];

const HORIZON_METHODS: { key: MethodKey; label: string }[] = [
  { key: "bootstrap", label: "Resampled days" },
  { key: "gaussian", label: "Gaussian, √time" },
  { key: "monte_carlo", label: "Monte Carlo" },
];

const VERDICT: Record<VarVerdict, { label: string; tone: string; note: string }> = {
  pass: { label: "Calibrated", tone: "text-up", note: "Breaches came about as often as promised, and not in clumps." },
  too_many: { label: "Too many breaches", tone: "text-down", note: "VaR understated the risk: losses beat it more often than promised." },
  too_few: { label: "Too cautious", tone: "text-amber-400", note: "VaR overstated the risk: losses beat it less often than promised." },
  clustered: {
    label: "Breaches cluster",
    tone: "text-amber-400",
    note: "The count is about right, but breaches bunch together. That is volatility clustering, which a trailing window is slow to catch.",
  },
};

const stretchLabel = (days: number) => (days === 1 ? "1 day" : days === 5 ? "1 week" : days === 20 ? "1 month" : days === 60 ? "3 months" : `${days} days`);

/** Value at risk, stress tests and the VaR backtest, laid out to match the rest of the results page. */
export function RiskSection({ risk }: { risk: RiskReport }) {
  return (
    <>
      <div className="grid-2-1">
        <div className="reveal flex flex-col [&>*]:flex-1" style={d(11)}>
          <VarCard risk={risk} />
        </div>
        <div className="reveal flex flex-col [&>*]:flex-1" style={d(12)}>
          <StressCard risk={risk} />
        </div>
      </div>
      {risk.backtest.length > 0 && risk.series.length > 0 && (
        <div className="reveal" style={d(13)}>
          <BacktestCard risk={risk} />
        </div>
      )}
    </>
  );
}

function Kpi({ label, value, caption }: { label: string; value: number | undefined; caption: string }) {
  return (
    <div className="bg-[#0d0d10] px-5 py-3">
      <div className="eyebrow">{label}</div>
      <div className="mt-1 font-mono text-lg font-semibold tnum text-down">{loss(value)}</div>
      <div className="mt-0.5 text-[11px] text-gray-500">{caption}</div>
    </div>
  );
}

/** One plain-language sentence on how far the bell-curve estimate is from the real tail. */
function tailNote(risk: RiskReport, top: number): string {
  const row = forConfidence(risk.var, top);
  if (!row?.historical) return "";
  const gap = row.gaussian / row.historical - 1;
  const k = risk.distribution.excess_kurtosis.toFixed(1);
  if (gap <= -0.08) {
    return `A bell curve would understate the ${share(top)} loss by ${Math.round(-gap * 100)}%. These returns are fat-tailed (excess kurtosis ${k}), so extreme days arrive more often than a normal curve expects.`;
  }
  if (gap >= 0.08) return `A bell curve would overstate the ${share(top)} loss by ${Math.round(gap * 100)}% here (excess kurtosis ${k}).`;
  return `A bell curve lands within ${Math.max(1, Math.round(Math.abs(gap) * 100))}% of the historical ${share(top)} figure on this sample (excess kurtosis ${k}).`;
}

function VarCard({ risk }: { risk: RiskReport }) {
  const confs = risk.var.map((r) => r.confidence);
  const top = Math.max(...confs);
  const note = tailNote(risk, top);

  return (
    <Panel className="flex flex-col overflow-hidden">
      <PanelHeader
        title="Value at risk"
        hint={`A bad day, sized. At ${share(top)}, a loss this big or bigger should come about 1 day in ${Math.round(1 / (1 - top))}.`}
        right={
          <InfoTip
            text="VaR is the daily loss the portfolio should not exceed with a stated confidence. CVaR is the average loss on the days that do exceed it."
            focus="VaR"
          />
        }
      />
      <div className="grid grid-cols-3 gap-px border-y border-white/[0.07] bg-white/[0.07]">
        <Kpi label={`1-day VaR · ${share(top)}`} value={forConfidence(risk.var, top)?.historical} caption="historical" />
        <Kpi label={`1-day CVaR · ${share(top)}`} value={forConfidence(risk.cvar, top)?.historical} caption={`average of the worst ${share(1 - top)} of days`} />
        <Kpi label={`${risk.horizon.days}-day VaR · ${share(top)}`} value={forConfidence(risk.horizon.var, top)?.bootstrap} caption="resampled days" />
      </div>

      <MethodTable label="1 day" methods={DAILY_METHODS} varRows={risk.var} cvarRows={risk.cvar} />
      <MethodTable label={`${risk.horizon.days} days`} methods={HORIZON_METHODS} varRows={risk.horizon.var} cvarRows={risk.horizon.cvar} />
      <p className="px-5 pb-3 pt-1 text-[11px] leading-relaxed text-gray-500">
        Historical reads the actual days. Gaussian assumes a bell curve. Monte Carlo simulates days from a fat-tailed Student-t fitted to these returns ({risk.distribution.t_df.toFixed(1)} degrees of freedom).
        Resampled days draw from the backtest with replacement. Multi-day figures treat each day as independent.
      </p>

      <div className="mt-auto">
        <div className="grid grid-cols-4 gap-px border-t border-white/[0.07] bg-white/[0.07]">
          <Stat label="Annual volatility" value={`${(risk.distribution.annual_vol * 100).toFixed(1)}%`} />
          <Stat label="Skew" value={risk.distribution.skew.toFixed(2)} />
          <Stat label="Excess kurtosis" value={risk.distribution.excess_kurtosis.toFixed(1)} />
          <Stat label="Worst day" value={loss(Math.abs(risk.distribution.worst_day))} />
        </div>
        {note && <div className="border-t border-white/[0.07] px-5 py-3 text-xs leading-relaxed text-gray-400">{note}</div>}
      </div>
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0d0d10] px-5 py-3">
      <div className="eyebrow">{label}</div>
      <div className="mt-1 font-mono text-sm font-semibold tnum text-white">{value}</div>
    </div>
  );
}

/** VaR and CVaR at each confidence level, one row per estimation method. */
function MethodTable({
  label,
  methods,
  varRows,
  cvarRows,
}: {
  label: string;
  methods: { key: MethodKey; label: string }[];
  varRows: RiskMethodRow[];
  cvarRows: RiskMethodRow[];
}) {
  const confs = varRows.map((r) => r.confidence);
  return (
    <div className="overflow-x-auto px-5 pb-1 pt-3">
      <table className="w-full min-w-[420px] text-right font-mono text-[12px] tnum">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.12em] text-gray-500">
            <th className="pb-2 text-left font-medium">{label}</th>
            {confs.map((c) => (
              <th key={`v${c}`} className="pb-2 font-medium">
                VaR {share(c)}
              </th>
            ))}
            {confs.map((c) => (
              <th key={`c${c}`} className="pb-2 font-medium">
                CVaR {share(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {methods.map((m) => (
            <tr key={m.key} className="border-t border-white/[0.06]">
              <td className="py-2 text-left text-gray-300">{m.label}</td>
              {confs.map((c) => (
                <td key={`v${c}`} className="py-2 text-gray-200">
                  {loss(forConfidence(varRows, c)?.[m.key])}
                </td>
              ))}
              {confs.map((c) => (
                <td key={`c${c}`} className="py-2 text-gray-200">
                  {loss(forConfidence(cvarRows, c)?.[m.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StressRow({ label, sub, value, tone = "text-down" }: { label: string; sub?: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <div className="text-[13px] text-gray-300">{label}</div>
        {sub && <div className="font-mono text-[10.5px] text-gray-600">{sub}</div>}
      </div>
      <div className={`flex-shrink-0 font-mono text-[13px] font-medium tnum ${tone}`}>{value}</div>
    </div>
  );
}

function StressGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow mb-1">{title}</div>
      <div className="divide-y divide-white/[0.06]">{children}</div>
    </div>
  );
}

function StressCard({ risk }: { risk: RiskReport }) {
  const { worst_stretches, windows, vol_shocks } = risk.stress;
  const shockConfidence = vol_shocks[0]?.confidence;

  return (
    <Panel>
      <PanelHeader title="Stress tests" hint="What this strategy actually went through, and what rougher markets would do." />
      <div className="space-y-5 px-5 pb-5">
        {worst_stretches.length > 0 && (
          <StressGroup title="Worst stretch">
            {worst_stretches.map((s) => (
              <StressRow
                key={s.days}
                label={stretchLabel(s.days)}
                sub={s.days === 1 ? longDate(s.end) : `${longDate(s.start)} to ${longDate(s.end)}`}
                value={signed(s.return)}
                tone={s.return < 0 ? "text-down" : "text-gray-200"}
              />
            ))}
          </StressGroup>
        )}

        <StressGroup title="Market stress windows">
          {windows.length > 0 ? (
            windows.map((w) => (
              <StressRow
                key={w.name}
                label={w.name}
                sub={`${longDate(w.start)} to ${longDate(w.end)}`}
                value={signed(w.return)}
                tone={w.return >= 0 ? "text-up" : "text-down"}
              />
            ))
          ) : (
            <p className="py-1.5 text-xs text-gray-500">None of the named stress windows fall inside this backtest period.</p>
          )}
        </StressGroup>

        {vol_shocks.length > 0 && shockConfidence !== undefined && (
          <StressGroup title={`If volatility rose · ${share(shockConfidence)} 1-day VaR`}>
            {vol_shocks.map((s) => (
              <StressRow key={s.multiple} label={`${s.multiple}× today's`} value={loss(s.var)} />
            ))}
          </StressGroup>
        )}
      </div>
    </Panel>
  );
}

function BacktestCard({ risk }: { risk: RiskReport }) {
  const confs = risk.backtest.map((r) => r.confidence);
  const [conf, setConf] = useState(Math.max(...confs));
  const selected = risk.backtest.find((r) => r.confidence === conf) ?? risk.backtest[0];
  const verdict = VERDICT[selected.verdict];

  return (
    <Panel>
      <PanelHeader
        title="VaR backtest"
        hint={`Each day's VaR is estimated from the ${selected.window} days before it, so a breach is a genuine miss. A dot marks a day that lost more.`}
        right={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1" role="group" aria-label="Confidence level">
              {confs.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={c === conf}
                  onClick={() => setConf(c)}
                  className={`rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                    c === conf ? "border-lava-500/50 bg-lava-500/10 text-lava-300" : "border-white/10 text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {share(c)}
                </button>
              ))}
            </div>
            <InfoTip
              text="The Kupiec test asks whether breaches happen as often as the confidence level promises. The Christoffersen test asks whether they come in clumps."
              focus="VaR backtest"
            />
          </div>
        }
      />
      <div className="px-3 pb-2">
        <VarBacktestChart series={risk.series} confidence={conf} />
      </div>

      <div className="overflow-x-auto px-5 pb-1 pt-2">
        <table className="w-full min-w-[560px] text-right font-mono text-[12px] tnum">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.12em] text-gray-500">
              {["Confidence", "Breaches", "Expected", "Rate", "Kupiec p", "Independence p", "Verdict"].map((h, i) => (
                <th key={h} className={`pb-2 font-medium ${i === 0 ? "text-left" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {risk.backtest.map((r) => {
              const v = VERDICT[r.verdict];
              return (
                <tr key={r.confidence} className={`border-t border-white/[0.06] ${r.confidence === conf ? "bg-white/[0.03]" : ""}`}>
                  <td className="py-2 text-left text-gray-300">{share(r.confidence)}</td>
                  <td className="py-2 text-gray-200">{r.exceptions}</td>
                  <td className="py-2 text-gray-400">{r.expected.toFixed(1)}</td>
                  <td className="py-2 text-gray-200">{(r.rate * 100).toFixed(2)}%</td>
                  <td className={`py-2 ${r.kupiec_p < 0.05 ? "text-down" : "text-gray-200"}`}>{pValue(r.kupiec_p)}</td>
                  <td className={`py-2 ${r.independence_p < 0.05 ? "text-amber-400" : "text-gray-200"}`}>{pValue(r.independence_p)}</td>
                  <td className={`py-2 font-medium ${v.tone}`}>{v.label}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-5 pb-4 pt-2 text-xs leading-relaxed text-gray-400">
        <span className={`font-medium ${verdict.tone}`}>{share(selected.confidence)}: </span>
        {verdict.note} Over {selected.observations.toLocaleString()} forecast days.
      </p>
    </Panel>
  );
}
