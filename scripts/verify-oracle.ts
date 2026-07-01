// Run the engine against a real export and print a ranked, tiered report plus an
// oracle scorecard — the TypeScript equivalent of the reference prototype.py run.
//
//   npm run verify-oracle -- path/to/export.json
//   (defaults to test-data/real-export.json)

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { analyze, parseExport } from "../src/engine/index.ts";
import { utcClock } from "../src/engine/__tests__/fixture.ts";

const path = resolve(process.cwd(), process.argv[2] ?? "test-data/real-export.json");
if (!existsSync(path)) {
  console.error(`No export at ${path}.\nPlace a ChatGPT/Claude export there, or pass a path:\n  npm run verify-oracle -- path/to/conversations.json`);
  process.exit(1);
}

const { conversations, format } = parseExport(JSON.parse(readFileSync(path, "utf-8")));
const result = analyze(conversations, { clock: utcClock });

console.log("=".repeat(66));
console.log(`PARSED ${result.meta.total} conversations (${format}) · ${result.meta.dateRange.start} → ${result.meta.dateRange.end}`);
console.log(`Per year: ${JSON.stringify(result.meta.perYear)} · ${result.meta.activeMonths} active months`);
console.log("=".repeat(66));
console.log("\nRANKED OBSERVATIONS (what the engine would surface)\n");
for (const o of [...result.observations].sort((a, b) => b.score - a.score)) {
  const tier = o.tier.toUpperCase().padEnd(10);
  console.log(`  [${o.score.toFixed(2)}] ${tier} ${o.id}`);
  console.log(`         ${o.title}`);
}

// ── Oracle scorecard ─────────────────────────────────────────────────────────
type Check = [label: string, pass: boolean];
const obs = (id: string) => result.observations.find((o) => o.id === id);
const surfaced = (id: string) => { const o = obs(id); return !!o && o.tier !== "demoted" && o.score >= 0.7; };
const demoted = (id: string) => obs(id)?.tier === "demoted";
const lowRanked = (id: string) => (obs(id)?.score ?? 1) < 0.5;

const checks: Check[] = [
  ["SURFACE  depth growth (C1)", surfaced("DEPTH_GROWTH")],
  ["SURFACE  depth is broad (C2)", surfaced("DEPTH_BROAD")],
  ["SURFACE  business volatile (D1)", surfaced("MOVE_BUSINESS_VOLATILE")],
  ["SURFACE  code surge (D2)", !!obs("MOVE_CODE_SURGE")],
  ["SURFACE  volume spike (B1)", surfaced("OVERVIEW_VOLUME")],
  ["SURFACE  decisions-are-deepest (G1)", surfaced("DECISIONS_ARE_DEEPEST")],
  ["SURFACE  'analysis' top word (H1)", surfaced("RECURRING_TITLE_WORDS")],
  ["DEMOTE   career-anchor (D6)", demoted("HELD_CAREER_DEMOTE")],
  ["DEMOTE   deeper-thinker (C6)", demoted("DEPTH_THINKER_DEMOTE")],
  ["DEMOTE   timing-stereotype (A5)", demoted("OVERVIEW_TIMING_STEREOTYPE")],
  ["RANK-LOW total count (A1)", lowRanked("OVERVIEW_COUNT")],
  ["RANK-LOW peak-hour timing (A3)", lowRanked("OVERVIEW_TIMING")],
];

console.log("\n" + "=".repeat(66));
console.log("ORACLE SCORECARD (engine vs golden_observations_full.md)\n");
let passed = 0;
for (const [label, ok] of checks) {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
  if (ok) passed++;
}
console.log(`\n  SCORE: ${passed}/${checks.length} oracle checks passed`);
process.exit(passed === checks.length ? 0 : 1);
