import type { BacktestResponse } from "./types";

export interface GalleryStats {
  sharpe: number;
  ic_ir: number;
  annual_return: number;
}

export interface GalleryAlpha {
  id: string;
  name: string;
  family: string;
  /** One-line hypothesis in plain English */
  idea: string;
  expression: string;
  /** Normalized equity curve (starts at 1), downsampled for the card sparkline */
  spark: number[];
  /** Share of the sparkline (0..1) where the holdout period begins */
  sparkSplit: number;
  /** Stats from the selection period */
  picked: GalleryStats;
  /** Stats from the holdout period the selection never saw */
  holdout: GalleryStats;
}

export interface GalleryIndex {
  generatedAt: string;
  universe: string;
  candidatesTested: number;
  selectedOn: string;
  holdoutLabel: string;
  holdoutFrom: string;
  fullPeriod: string;
  alphas: GalleryAlpha[];
}

export async function loadGalleryIndex(): Promise<GalleryIndex> {
  const res = await fetch("/gallery/index.json");
  if (!res.ok) throw new Error("Couldn't load the gallery");
  return res.json();
}

export async function loadGalleryResult(id: string): Promise<BacktestResponse> {
  const res = await fetch(`/gallery/${id}.json`);
  if (!res.ok) throw new Error("Couldn't load that saved result");
  return res.json();
}
