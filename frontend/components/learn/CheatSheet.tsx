"use client";

import { useMemo, useState } from "react";
import { Search, CornerDownLeft } from "lucide-react";
import { Expr } from "@/components/ui/Expr";
import { DSL_FUNCTIONS } from "@/lib/dsl";
import { emit, toast } from "@/lib/bus";

interface Info {
  plain: string;
  example: string;
  says: string;
}

const INFO: Record<string, Info> = {
  rank: { plain: "Ranks all stocks against each other each day, from -1 (lowest) to +1 (highest).", example: "rank(-returns)", says: "Yesterday's biggest losers rank highest." },
  zscore: { plain: "Rescales a signal across stocks to average 0 and spread 1.", example: "zscore(volume)", says: "How unusual each stock's volume is today." },
  demean: { plain: "Subtracts the across-stock average, so scores balance around zero.", example: "demean(returns)", says: "Each stock's return relative to the market's." },
  winsorize: { plain: "Clips the most extreme values at both ends so outliers can't dominate.", example: "winsorize(returns, 0.05)", says: "Caps the top and bottom 5% of returns." },
  ts_mean: { plain: "Average over the last d days, for each stock.", example: "ts_mean(returns, 5)", says: "The average daily return over a week." },
  ts_std: { plain: "How much a stock bounced around over the last d days (volatility).", example: "ts_std(returns, 20)", says: "How jumpy the stock was this month." },
  ts_sum: { plain: "Total over the last d days.", example: "ts_sum(returns, 5)", says: "Roughly the week's total return." },
  ts_max: { plain: "Highest value in the last d days.", example: "ts_max(close, 252)", says: "The 52-week high." },
  ts_min: { plain: "Lowest value in the last d days.", example: "ts_min(close, 252)", says: "The 52-week low." },
  ts_delta: { plain: "Today's value minus the value d days ago.", example: "ts_delta(close, 5)", says: "How much the price changed this week." },
  ts_delay: { plain: "The value from d days ago.", example: "ts_delay(close, 1)", says: "Yesterday's close." },
  ts_rank: { plain: "Where today's value sits within its own last d days, -1 to +1.", example: "ts_rank(close, 60)", says: "Is the price near its 60-day high or low?" },
  ts_corr: { plain: "How closely two things moved together over d days, -1 to +1.", example: "ts_corr(close, volume, 10)", says: "Did price and volume rise and fall together?" },
  ts_decay_linear: { plain: "A d-day average where recent days count more. Smooths a signal.", example: "ts_decay_linear(returns, 5)", says: "A smoothed recent return." },
  ts_autocorr: { plain: "Whether a series tends to repeat (+) or reverse (-) its last move.", example: "ts_autocorr(returns, 1, 20)", says: "Do returns follow through day to day?" },
  group_rank: { plain: "Ranks stocks only against others in the same group.", example: "group_rank(returns, sector)", says: "Best performer within each sector." },
  group_zscore: { plain: "Z-scores a signal within each group.", example: "group_zscore(volume, sector)", says: "Unusual volume for its own sector." },
  group_neutralize: { plain: "Subtracts each group's average, removing sector bets.", example: "group_neutralize(rank(-returns), sector)", says: "Reversal that is not just a sector call." },
  log: { plain: "Natural log. Shrinks big values; good for skewed data like volume.", example: "log(volume)", says: "Volume on a gentler scale." },
  abs: { plain: "Drops the sign, keeping only the size.", example: "abs(returns)", says: "How big the move was, up or down." },
  sign: { plain: "Reduces a number to +1, -1 or 0: just its direction.", example: "sign(returns)", says: "Did it go up or down?" },
  sqrt: { plain: "Square root of the size. Dampens big values.", example: "sqrt(volume)", says: "A flatter version of volume." },
  power: { plain: "Raises a number to a power.", example: "power(returns, 2)", says: "Squared returns (a volatility proxy)." },
  clamp: { plain: "Limits a value to a range.", example: "clamp(returns, -0.05, 0.05)", says: "Ignore moves bigger than 5%." },
  max: { plain: "The larger of two values, stock by stock. Put the data first.", example: "max(returns, 0)", says: "Keep gains, treat losses as zero." },
  min: { plain: "The smaller of two values, stock by stock. Put the data first.", example: "min(returns, 0)", says: "Keep losses, treat gains as zero." },
};

const GROUPS: { title: string; blurb: string; color: string; cat: string }[] = [
  { title: "Over time, per stock", blurb: "Look back at a single stock's own history. The window d is a whole number of trading days.", color: "#ffb36b", cat: "Time-series" },
  { title: "Across stocks, each day", blurb: "Compare stocks to each other on the same day.", color: "#c4a7ff", cat: "Cross-sectional" },
  { title: "Within a group", blurb: "Compare only inside a sector. The group input is almost always sector.", color: "#5eead4", cat: "Group" },
  { title: "Math on single values", blurb: "Reshape numbers.", color: "#a1a1aa", cat: "Element-wise" },
];

const PATTERNS = [
  ["Bet against a move", "rank(-ts_delta(close, 5))", "A minus sign flips the bet. A leading - is how you go from momentum to reversal."],
  ["Blend two ideas", "rank(-returns) + rank(-ts_std(returns, 20))", "Rank each part first so they share a scale, then add."],
  ["Act only when both agree", "rank(-returns) * rank(-ts_std(returns, 20))", "A product is large only when both parts are."],
  ["Remove sector bets", "group_neutralize(rank(-returns), sector)", "Wrap the final score."],
  ["Trade less", "ts_decay_linear(-returns, 5)", "Smoothing slows the signal and cuts turnover."],
  ["Percent change", "ts_delta(close, 5) / ts_delay(close, 5)", "Divide the change by where it started."],
  ["Relative to own history", "volume / ts_mean(volume, 60)", "Is today's volume high for this stock?"],
];

const FIELD_ROWS: { name: string; plain: string }[] = [
  { name: "close", plain: "The closing price." },
  { name: "open", plain: "The opening price." },
  { name: "high", plain: "The day's highest price." },
  { name: "low", plain: "The day's lowest price." },
  { name: "volume", plain: "Shares traded." },
  { name: "returns", plain: "Daily return: today's close vs yesterday's." },
  { name: "vwap", plain: "Average trade price, approximated here as (high + low + close) / 3." },
  { name: "gap", plain: "Overnight gap: today's open vs yesterday's close." },
  { name: "range", plain: "Day's high-to-low range relative to yesterday's close." },
  { name: "volume_ratio", plain: "Volume relative to its own 20-day average." },
  { name: "cap", plain: "Dollar volume (price × volume). A rough stand-in for size, not true market cap." },
  { name: "sector", plain: "The sector. Only useful as the group input to group_ operators." },
];

function InsertButton({ text }: { text: string }) {
  return (
    <button
      onClick={() => {
        emit("insert-text", text);
        toast("Inserted into the editor");
      }}
      className="chip flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium"
    >
      <CornerDownLeft className="h-3 w-3" /> Insert
    </button>
  );
}

export function CheatSheet() {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const groups = useMemo(
    () =>
      GROUPS.map((g) => ({
        ...g,
        fns: DSL_FUNCTIONS.filter((f) => f.cat === g.cat).filter((f) => {
          if (!query) return true;
          const i = INFO[f.name];
          return `${f.name} ${f.sig} ${i?.plain ?? ""} ${i?.says ?? ""}`.toLowerCase().includes(query);
        }),
      })).filter((g) => g.fns.length),
    [query]
  );
  const fields = FIELD_ROWS.filter((f) => !query || `${f.name} ${f.plain}`.toLowerCase().includes(query));

  return (
    <div className="space-y-7">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-600" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search operators and fields…" className="field !pl-9" />
      </div>

      {fields.length > 0 && (
        <section className="space-y-2.5">
          <div className="flex items-baseline justify-between">
            <div className="eyebrow">Fields (your raw data)</div>
            <span className="text-[11px] text-gray-600">One number per stock per day</span>
          </div>
          <div className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.07]">
            {fields.map((f) => (
              <div key={f.name} className="flex items-center gap-3 px-3.5 py-2.5">
                <code className="w-[104px] flex-shrink-0 font-mono text-[12.5px] text-[#5eead4]">{f.name}</code>
                <span className="flex-1 text-[12.5px] leading-snug text-gray-400">{f.plain}</span>
                <InsertButton text={f.name} />
              </div>
            ))}
          </div>
        </section>
      )}

      {groups.map((g) => (
        <section key={g.title} className="space-y-2.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: g.color }} />
              <div className="eyebrow !text-gray-300">{g.title}</div>
            </div>
            <p className="mt-1 text-[12px] text-gray-500">{g.blurb}</p>
          </div>
          <div className="space-y-2">
            {g.fns.map((f) => {
              const i = INFO[f.name];
              return (
                <div key={f.name} className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <code className="font-mono text-[13px] font-semibold text-[#ffb36b]">{f.sig}</code>
                    <InsertButton text={f.snippet.replace(/\$\{\d+:([^}]*)\}/g, "$1")} />
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-gray-400">{i?.plain ?? f.doc}</p>
                  {i && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                      <span className="overflow-x-auto whitespace-nowrap rounded-md bg-black/30 px-2 py-1">
                        <Expr code={i.example} />
                      </span>
                      <span className="text-gray-500">{i.says}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {!query && (
        <section className="space-y-2.5">
          <div className="eyebrow">Math you can use</div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3 text-[12.5px] leading-relaxed text-gray-400">
            <code className="font-mono text-gray-200">+  -  *  /  **</code> and parentheses all work, plus plain numbers like <code className="font-mono text-gray-200">0.05</code>. A leading{" "}
            <code className="font-mono text-gray-200">-</code> flips a signal. Use parentheses whenever you&apos;re unsure about order:{" "}
            <code className="font-mono text-gray-200">(close - open) / (high - low)</code>.
          </div>
        </section>
      )}

      {!query && (
        <section className="space-y-2.5">
          <div className="eyebrow">Patterns you&apos;ll see everywhere</div>
          <div className="space-y-2">
            {PATTERNS.map(([title, code, body]) => (
              <div key={title} className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[13px] font-semibold text-gray-200">{title}</div>
                  <button
                    onClick={() => {
                      emit("load-expression", code);
                      toast("Loaded into the editor");
                    }}
                    className="chip rounded-md px-2 py-1 text-[11px] font-medium"
                  >
                    Try it
                  </button>
                </div>
                <div className="mt-1.5 overflow-x-auto whitespace-nowrap text-[12px]">
                  <Expr code={code} />
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-gray-500">{body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {query && groups.length === 0 && fields.length === 0 && <p className="py-8 text-center text-sm text-gray-500">Nothing matches &ldquo;{q}&rdquo;.</p>}
    </div>
  );
}
