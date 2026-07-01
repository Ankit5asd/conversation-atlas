// ── AI enrichment orchestration ───────────────────────────────────────────────
// Build the digest prompt → call the chosen provider → sanitize → merge into the
// deterministic result. The deterministic findings are never overwritten; the AI
// only ADDS fenced findings (cat 5/8) and transparent critique notes.

import type { AtlasResult, Observation } from "../types";
import { rank } from "../ranking";
import { callModel, type ProviderConfig } from "./providers";
import { SYSTEM_CONTRACT, buildUserPrompt } from "./prompt";
import { sanitizeEnrichment, type Enrichment } from "./sanitize";

export async function enrichWithAI(result: AtlasResult, cfg: ProviderConfig): Promise<Enrichment> {
  const raw = await callModel(cfg, SYSTEM_CONTRACT, buildUserPrompt(result));
  if (!raw.trim()) throw new Error("The model returned an empty response.");
  const existing = new Set(result.observations.map((o) => o.id));
  const demoted = new Set(result.observations.filter((o) => o.tier === "demoted").map((o) => o.id));
  return sanitizeEnrichment(raw, existing, demoted);
}

/** Returns a NEW result with AI findings + critiques merged in (pure, immutable). */
export function applyEnrichment(result: AtlasResult, e: Enrichment): AtlasResult {
  const critiqueBy = new Map(e.critiques.map((c) => [c.findingId, c]));
  const merged: Observation[] = result.observations.map((o) => {
    const c = critiqueBy.get(o.id);
    return c ? { ...o, aiNote: c.note, aiSuggestedTier: c.suggestedTier } : { ...o };
  });
  merged.push(...e.observations);
  rank(merged);

  const byCategory: Record<number, Observation[]> = {};
  for (const o of merged) (byCategory[o.category] ??= []).push(o);
  for (const k of Object.keys(byCategory)) byCategory[+k].sort((a, b) => b.score - a.score);

  return { ...result, observations: merged, byCategory };
}
