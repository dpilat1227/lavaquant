"use client";

import { useEffect, useRef, useState } from "react";
import { CornerDownRight, Loader2, Play, Send } from "lucide-react";
import { Expr } from "@/components/ui/Expr";
import { askCoach, fetchCoachStatus } from "@/lib/api";
import type { CoachReply, CoachRequest } from "@/lib/api";
import type { BacktestMetrics } from "@/lib/types";
import { emit, toast } from "@/lib/bus";
import { localCoach } from "@/lib/coachLocal";

type Mode = CoachRequest["mode"];

const ACTIONS: { mode: Exclude<Mode, "ask">; label: string; label2: string }[] = [
  { mode: "explain", label: "Why does this make sense?", label2: "Explain the idea" },
  { mode: "next", label: "What should I try next?", label2: "Suggest experiments" },
  { mode: "review", label: "Read my result", label2: "Teach me the numbers" },
];

interface Props {
  expression: string;
  forward: number;
  /** Metrics from the most recent run, only if it was for the expression currently in the editor */
  metrics: BacktestMetrics | null;
}

/** AI coach. Built to teach: explains the idea, proposes single-change experiments, and reads results. Never replaces the learner's own thinking. */
export function CoachCard({ expression, forward, metrics }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [busy, setBusy] = useState<Mode | null>(null);
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState<CoachReply | null>(null);
  const [asked, setAsked] = useState("");
  const [error, setError] = useState("");
  const history = useRef<{ role: "user" | "assistant"; content: string }[]>([]);

  useEffect(() => {
    fetchCoachStatus()
      .then((s) => {
        setEnabled(s.enabled);
        setRemaining(s.remaining);
      })
      .catch(() => {});
  }, []);

  async function go(mode: Mode, label: string) {
    if (busy) return;
    if (mode === "ask" && !question.trim()) return;
    setBusy(mode);
    setError("");
    setAsked(mode === "ask" ? question.trim() : label);
    if (!enabled) {
      // offline coach: instant, free, rule-based
      setReply(localCoach(mode, expression, question.trim(), metrics));
      if (mode === "ask") setQuestion("");
      setBusy(null);
      return;
    }
    try {
      const body: CoachRequest = {
        mode,
        expression,
        question: mode === "ask" ? question.trim() : "",
        forward_days: forward,
        history: history.current.slice(-6),
        metrics: metrics
          ? {
              sharpe: metrics.sharpe,
              ic_mean: metrics.ic_mean,
              ic_ir: metrics.ic_ir,
              annual_return: metrics.annual_return,
              max_drawdown: metrics.max_drawdown,
              hit_rate: metrics.hit_rate,
              avg_daily_turnover: metrics.avg_daily_turnover,
            }
          : undefined,
      };
      const r = await askCoach(body);
      setReply(r);
      setRemaining(r.remaining);
      history.current = [
        ...history.current,
        { role: "user" as const, content: mode === "ask" ? question.trim() : label },
        { role: "assistant" as const, content: r.reply },
      ].slice(-6);
      if (mode === "ask") setQuestion("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The coach didn't answer.");
    } finally {
      setBusy(null);
    }
  }

  const hasExpr = expression.trim().length > 0;

  return (
    <section className="space-y-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="eyebrow">Coach</span>
          <span className="rounded-full bg-lava-500/15 px-2 py-0.5 text-[10px] font-medium text-lava-300">{enabled ? "AI" : "Offline"}</span>
        </div>
        {enabled && remaining !== null && <span className="flex-shrink-0 font-mono text-[10px] text-gray-600">{remaining} left today</span>}
      </div>

      {(

        <div className="space-y-3.5">
          <p className="text-[12px] leading-relaxed text-gray-500">
            Here to teach, not to hand you answers. It explains why a formula might work, suggests one change at a time, and helps you read the numbers.{!enabled && " This one runs on rules, not AI: free and instant, but it only knows a fixed set of ideas."}
          </p>

          <div className="flex flex-wrap gap-1.5">
            {ACTIONS.map((a) => {
              const disabled = !!busy || !hasExpr || (a.mode === "review" && !metrics);
              return (
                <button
                  key={a.mode}
                  onClick={() => void go(a.mode, a.label)}
                  disabled={disabled}
                  title={a.mode === "review" && !metrics ? "Run a backtest on this expression first" : a.label2}
                  className="chip flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-medium disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy === a.mode && <Loader2 className="h-3 w-3 animate-spin" />}
                  {a.label}
                </button>
              );
            })}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void go("ask", "");
            }}
            className="flex gap-2"
          >
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={500}
              placeholder={enabled ? "Ask anything: why rank? how do I use volume?" : "Ask about rank, turnover, IC, window size…"}
              className="field !h-9 flex-1 !text-[12.5px]"
            />
            <button
              type="submit"
              disabled={!!busy || !question.trim()}
              aria-label="Ask the coach"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.04] text-gray-300 transition-colors hover:bg-white/[0.09] hover:text-white disabled:opacity-40"
            >
              {busy === "ask" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </button>
          </form>

          {error && <p className="rounded-lg border border-down/25 bg-down/10 px-3 py-2 text-[12px] text-red-200">{error}</p>}

          {reply && !error && (
            <div className="animate-fade-in space-y-3.5">
              {asked && <div className="text-[11.5px] italic text-gray-600">{asked}</div>}

              <div className="space-y-2.5 text-[13px] leading-relaxed text-gray-300">
                {reply.reply.split(/\n\n+/).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>

              {reply.check && (
                <div className="rounded-lg border border-lava-500/25 bg-lava-500/[0.05] px-3 py-2.5">
                  <div className="eyebrow !text-lava-300">Before you run anything</div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-gray-300">{reply.check}</p>
                </div>
              )}

              {reply.experiments.length > 0 && (
                <div className="space-y-2">
                  <div className="eyebrow">Experiments</div>
                  {reply.experiments.map((x) => (
                    <div key={x.expression} className="rounded-lg border border-white/[0.07] bg-black/20 px-3 py-2.5">
                      <div className="text-[12.5px] font-semibold text-gray-200">{x.title}</div>
                      <div className="mt-1.5 overflow-x-auto whitespace-nowrap text-[12px]">
                        <Expr code={x.expression} />
                      </div>
                      <p className="mt-1.5 text-[12px] leading-relaxed text-gray-400">{x.why}</p>
                      {x.predict && (
                        <p className="mt-1 text-[12px] leading-relaxed text-gray-500">
                          <span className="text-gray-400">Expect:</span> {x.predict}
                        </p>
                      )}
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => {
                            emit("load-expression", x.expression);
                            window.setTimeout(() => emit("run"), 250);
                          }}
                          className="flex h-7 items-center gap-1.5 rounded-md bg-lava-solid px-2.5 text-[11.5px] font-semibold text-white hover:brightness-110"
                        >
                          <Play className="h-3 w-3 fill-current" /> Run
                        </button>
                        <button
                          onClick={() => {
                            emit("load-expression", x.expression);
                            toast("Loaded into the editor");
                          }}
                          className="flex h-7 items-center gap-1 rounded-md border border-white/[0.12] bg-white/[0.04] px-2.5 text-[11.5px] font-medium text-gray-300 hover:bg-white/[0.09] hover:text-white"
                        >
                          Edit <CornerDownRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {reply.concept && (
                <div className="rounded-lg bg-white/[0.04] px-3 py-2.5">
                  <div className="eyebrow">Worth remembering</div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-gray-300">
                    <span className="font-semibold text-white">{reply.concept.term}.</span> {reply.concept.plain}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
