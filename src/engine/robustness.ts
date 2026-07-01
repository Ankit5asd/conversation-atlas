// ── Robustness / counterfactual test ─────────────────────────────────────────
// The real math that separates a durable finding from a lucky one: remove each
// year one at a time and re-check. If a pattern collapses when its biggest
// contributor is removed, it FAILS and must be demoted — not surfaced.

import type { Conversation } from "./types";

/** Per-year count of conversations whose text matches a topic regex. */
export function topicCountsByYear(convos: Conversation[], years: number[], rx: RegExp): Record<number, number> {
  const out: Record<number, number> = {};
  for (const y of years) out[y] = convos.filter((c) => c.year === y && rx.test(c.text)).length;
  return out;
}

/**
 * A "persistent anchor" claim survives if, after removing the single biggest
 * year (by matching count), the topic is still present in at least 3 years.
 * Returns the survival fraction and a boolean verdict.
 */
export function survivesRemoveBiggestYear(counts: Record<number, number>, years: number[]): { robustness: number; survives: boolean } {
  const biggest = years.reduce((a, b) => (counts[b] > counts[a] ? b : a), years[0]);
  const remainingPresent = years.filter((y) => y !== biggest && counts[y] > 0);
  const denom = Math.max(years.length - 1, 1);
  return { robustness: remainingPresent.length / denom, survives: remainingPresent.length >= 3 };
}

/** A monotonic trend is maximally robust; a merely-net-positive one is weak. */
export function trendRobustness(sequence: number[]): { robustness: number; survives: boolean; monotonic: boolean } {
  const monotonic = sequence.every((v, i) => i === 0 || v > sequence[i - 1]);
  return { robustness: monotonic ? 1 : 0.4, survives: monotonic, monotonic };
}
