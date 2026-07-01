// ── Pipeline ──────────────────────────────────────────────────────────────────
// load → extract → rank → assemble. The single entry point the UI and tests use.

import type { AtlasResult, Conversation, Observation } from "./types";
import { buildCtx, localClock, type Clock, extractOverview, extractDepth, extractMovement, extractHeld, extractDecisions, extractRecurring, extractAudit } from "./extractors";
import { rank } from "./ranking";

export interface AnalyzeOptions {
  clock?: Clock; // inject a UTC clock in tests; browser uses local (user's tz)
}

export function analyze(conversations: Conversation[], opts: AnalyzeOptions = {}): AtlasResult {
  const clock = opts.clock ?? localClock;
  const droppedNoDate = conversations.filter((c) => c.year == null).length;
  const dated = conversations.filter((c) => c.year != null);

  const ctx = buildCtx(dated, clock);

  const observations: Observation[] = [
    ...extractOverview(ctx),
    ...extractDepth(ctx),
    ...extractMovement(ctx),
    ...extractHeld(ctx),
    ...extractDecisions(ctx),
    ...extractRecurring(ctx),
    ...extractAudit(),
  ];
  rank(observations); // mutates score in place

  const byCategory: Record<number, Observation[]> = {};
  for (const o of observations) (byCategory[o.category] ??= []).push(o);
  for (const k of Object.keys(byCategory)) byCategory[+k].sort((a, b) => b.score - a.score);

  const perYear: Record<number, number> = {};
  for (const y of ctx.years) perYear[y] = ctx.byYear[y].length;

  const times = dated.map((c) => c.createTime!).filter((t) => t != null).sort((a, b) => a - b);
  const fmt = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);
  const monthsSet = new Set(dated.filter((c) => c.createTime).map((c) => { const d = new Date(c.createTime! * 1000); return `${d.getUTCFullYear()}-${d.getUTCMonth()}`; }));
  const formats = new Set(dated.map((c) => c.source));

  return {
    meta: {
      total: dated.length,
      years: ctx.years,
      perYear,
      activeMonths: monthsSet.size,
      dateRange: { start: times.length ? fmt(times[0]) : "", end: times.length ? fmt(times[times.length - 1]) : "" },
      parsedFrom: formats.size > 1 ? "mixed" : [...formats][0] ?? "unknown",
      droppedNoDate,
    },
    observations,
    byCategory,
  };
}
