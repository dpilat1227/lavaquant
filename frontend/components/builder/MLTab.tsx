"use client";

import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Segmented } from "@/components/ui/Segmented";
import { InfoTip } from "@/components/ui/InfoTip";
import { BacktestControls } from "./BacktestControls";
import { RunButton, StickyFooter } from "./RunBar";
import { runMLBacktest, fetchFeatures } from "@/lib/api";
import { useBus } from "@/lib/bus";
import { useModKey } from "@/lib/useModKey";
import { groupBy } from "@/lib/utils";
import type { BacktestResponse, Feature, ModelType, Universe } from "@/lib/types";

interface MLTabProps {
  onResult: (r: BacktestResponse) => void;
  onError: (msg: string) => void;
  onLoading: (b: boolean, label?: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  momentum: "text-violet-400",
  reversal: "text-amber-400",
  volatility: "text-sky-400",
  value: "text-emerald-400",
  quality: "text-pink-400",
  technical: "text-orange-400",
  macro: "text-cyan-400",
  default: "text-gray-400",
};

function getCategoryColor(cat: string) {
  return CATEGORY_COLORS[cat.toLowerCase()] ?? CATEGORY_COLORS.default;
}

function FieldLabel({ label, tip }: { label: string; tip: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <span className="eyebrow">{label}</span>
      <InfoTip text={tip} />
    </div>
  );
}

export function MLTab({ onResult, onError, onLoading }: MLTabProps) {
  const mod = useModKey();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set());
  const [modelType, setModelType] = useState<ModelType>("lightgbm");
  const [universe, setUniverse] = useState<Universe>("sp500");
  const [startDate, setStartDate] = useState("2020-01-01");
  const [endDate, setEndDate] = useState("2024-12-31");
  const [forwardDays, setForwardDays] = useState(5);
  const [nFolds, setNFolds] = useState(5);
  const [embargoDays, setEmbargoDays] = useState(21);
  const [loading, setLoading] = useState(false);
  const [featuresError, setFeaturesError] = useState(false);

  useEffect(() => {
    fetchFeatures()
      .then((f) => {
        setFeatures(f);
        setSelectedFeatures(new Set(f.slice(0, 5).map((x) => x.name)));
      })
      .catch(() => setFeaturesError(true));
  }, []);

  function toggleFeature(name: string) {
    setSelectedFeatures((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function handleRun() {
    if (selectedFeatures.size === 0 || loading) return;
    setLoading(true);
    onLoading(true, "Training model");
    onError("");
    try {
      const result = await runMLBacktest({
        features: Array.from(selectedFeatures),
        model_type: modelType,
        universe,
        start_date: startDate,
        end_date: endDate,
        forward_days: forwardDays,
        n_folds: nFolds,
        embargo_days: embargoDays,
      });
      onResult(result);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
      onLoading(false);
    }
  }

  useBus("run", () => void handleRun());

  const grouped = groupBy(features, (f) => f.category);
  const categories = Object.keys(grouped).sort();

  return (
    <div className="space-y-5">
      <section>
        <FieldLabel
          label="Model"
          tip="LightGBM: gradient-boosted trees that capture non-linear interactions between features, the workhorse of most Numerai top performers. Linear: ridge regression, more interpretable and less prone to overfit on small universes. Start with LightGBM; switch to Linear with fewer than ~50 assets."
        />
        <Segmented
          value={modelType}
          onChange={setModelType}
          options={[
            { value: "lightgbm", label: "LightGBM" },
            { value: "linear", label: "Linear (ridge)" },
          ]}
        />
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <span className="eyebrow">
            Features <span className="ml-1 font-mono normal-case tracking-normal text-lava-400">{selectedFeatures.size}</span>
          </span>
          <button onClick={() => setSelectedFeatures(new Set())} className="text-[11px] text-gray-600 transition-colors hover:text-gray-300">
            Clear all
          </button>
        </div>

        {featuresError ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm text-gray-500">Could not load features. Check the API connection.</div>
        ) : features.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="shimmer h-9 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="max-h-72 space-y-4 overflow-y-auto rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
            {categories.map((cat) => (
              <div key={cat}>
                <div className={`mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${getCategoryColor(cat)}`}>{cat}</div>
                <div className="space-y-0.5">
                  {grouped[cat].map((f) => (
                    <label key={f.name} className="group flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]">
                      <Checkbox checked={selectedFeatures.has(f.name)} onCheckedChange={() => toggleFeature(f.name)} className="mt-0.5" />
                      <div className="min-w-0">
                        <div className="font-mono text-[12.5px] text-gray-300 transition-colors group-hover:text-white">{f.name}</div>
                        {f.description && <div className="truncate text-[11px] text-gray-600">{f.description}</div>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel
            label="CV folds"
            tip="Sequential time splits: train on earlier folds, test on later ones, never the reverse. More folds give a better performance estimate but train slower. 5 is standard for a 3 to 5 year dataset (López de Prado, 2018)."
          />
          <input type="number" value={nFolds} min={2} max={10} onChange={(e) => setNFolds(Number(e.target.value))} className="field" />
        </div>
        <div>
          <FieldLabel
            label="Embargo days"
            tip="A gap between train and test that stops information leaking through overlapping labels. Daily returns are autocorrelated, so without a gap the model can peek at test-period data. 21 days is the Numerai convention; López de Prado calls the sample removal 'purging'."
          />
          <input type="number" value={embargoDays} min={0} max={63} onChange={(e) => setEmbargoDays(Number(e.target.value))} className="field" />
        </div>
      </section>

      <section className="border-t border-white/[0.07] pt-5">
        <BacktestControls
          universe={universe}
          onUniverseChange={setUniverse}
          startDate={startDate}
          onStartDateChange={setStartDate}
          endDate={endDate}
          onEndDateChange={setEndDate}
          forwardDays={forwardDays}
          onForwardDaysChange={setForwardDays}
        />
      </section>

      <StickyFooter>
        <RunButton
          loading={loading}
          disabled={selectedFeatures.size === 0}
          label="Train and backtest"
          loadingLabel="Training model…"
          hint={`${mod}↵`}
          onClick={() => void handleRun()}
        />
      </StickyFooter>
    </div>
  );
}
