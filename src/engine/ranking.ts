// ── Ranking ───────────────────────────────────────────────────────────────────
// Importance + novelty proxy so cards arrive ranked and boring ones sink. Change
// is interesting; counts are quiet; demoted items are pinned low (shown as
// refusals, never surfaced as findings).

import type { Observation } from "./types";

/** Base novelty by tier — how much a finding of this kind "earns attention". */
const TIER_NOVELTY: Record<string, number> = {
  solid: 0.85,
  surprising: 1.0, // change/surprise is the most interesting
  context: 0.5,
  theory: 0.6,
  demoted: 0.15, // found, but refused — must not lead
};

/** Counting facts are inherently low-novelty regardless of tier. */
function noveltyFor(o: Observation): number {
  let n = TIER_NOVELTY[o.tier] ?? 0.5;
  if (o.confidenceType === "count" && o.tier === "context") n = Math.min(n, 0.4);
  return n;
}

export function rank(observations: Observation[]): Observation[] {
  for (const o of observations) {
    const novelty = noveltyFor(o);
    const rob = o.robustness ?? (o.survives ? 0.7 : 0.3);
    o.score = Math.round(novelty * (0.5 + 0.5 * rob) * 100) / 100;
    if (o.tier === "demoted") o.score = Math.min(o.score, 0.2);
  }
  // Global order for any flat list; the UI mostly renders by category, but the
  // oracle checks these scores directly.
  return [...observations].sort((a, b) => b.score - a.score);
}
