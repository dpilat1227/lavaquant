"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui/Segmented";
import { useBus } from "@/lib/bus";
import { ExpressionTab } from "./ExpressionTab";
import { MLTab } from "./MLTab";
import type { BacktestResponse } from "@/lib/types";

export interface EditorCommand {
  type: "load" | "insert";
  text: string;
  nonce: number;
}

interface StrategyBuilderProps {
  onResult: (r: BacktestResponse) => void;
  onError: (msg: string) => void;
  onLoading: (b: boolean, label?: string) => void;
}

export function StrategyBuilder({ onResult, onError, onLoading }: StrategyBuilderProps) {
  const [mode, setMode] = useState<"expression" | "ml">("expression");
  const [command, setCommand] = useState<EditorCommand | null>(null);

  useBus("set-mode", setMode);
  useBus("load-expression", (text) => {
    setMode("expression");
    setCommand({ type: "load", text, nonce: Date.now() });
  });
  useBus("insert-text", (text) => {
    setMode("expression");
    setCommand({ type: "insert", text, nonce: Date.now() });
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex-shrink-0 px-5 pb-4 pt-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="eyebrow">Workbench</h2>
          <span className="text-[11px] text-gray-600">{mode === "expression" ? "Write a signal, test it in seconds" : "Train a model on engineered factors"}</span>
        </div>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "expression", label: "Expression alpha" },
            { value: "ml", label: "ML model" },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-5">
        {mode === "expression" ? (
          <ExpressionTab
            key="expression"
            onResult={onResult}
            onError={onError}
            onLoading={onLoading}
            command={command}
            onCommandHandled={() => setCommand(null)}
          />
        ) : (
          <MLTab key="ml" onResult={onResult} onError={onError} onLoading={onLoading} />
        )}
      </div>
    </div>
  );
}
