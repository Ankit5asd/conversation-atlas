// Oracle regression test against a REAL export (the golden_observations_full.md
// answer key, made executable). Runs only if you have placed a real export at
// test-data/real-export.json (git-ignored — private data never leaves your disk).
// On any other machine it skips cleanly, so CI stays green without the data.

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { analyze, parseExport, type AtlasResult } from "../index";
import { utcClock } from "./fixture";

const DATA_PATH = resolve(process.cwd(), "test-data/real-export.json");
const hasData = existsSync(DATA_PATH);

const suite = hasData ? describe : describe.skip;

suite("ORACLE — real export scored against golden_observations_full.md", () => {
  let result: AtlasResult;
  const obs = (id: string) => result.observations.find((o) => o.id === id);

  // Load once. UTC clock to reproduce the reference numbers.
  const { conversations } = parseExport(JSON.parse(readFileSync(DATA_PATH, "utf-8")));
  result = analyze(conversations, { clock: utcClock });

  it("parses the documented volume: 17 / 120 / 329 / 127 across 2023–2026", () => {
    expect(result.meta.total).toBe(593);
    expect(result.meta.perYear).toMatchObject({ 2023: 17, 2024: 120, 2025: 329, 2026: 127 });
  });

  // ── MUST SURFACE (found + ranked prominently) ──────────────────────────────
  it("C1 depth growth — Solid, monotonic, surfaced", () => {
    const o = obs("DEPTH_GROWTH")!;
    expect(o.tier).toBe("solid");
    expect(o.survives).toBe(true);
    expect(o.score).toBeGreaterThanOrEqual(0.7);
    expect((o.data!.avgByYear as Record<number, number>)[2023]).toBeCloseTo(2.8, 1);
  });

  it("C2 depth is broad, not just coding — Solid, surfaced", () => {
    const o = obs("DEPTH_BROAD")!;
    expect(o.tier).toBe("solid");
    expect(o.score).toBeGreaterThanOrEqual(0.7);
  });

  it("D1 Business is the most volatile theme (~30pt swing) — Surprising, surfaced", () => {
    const o = obs("MOVE_BUSINESS_VOLATILE")!;
    expect(o).toBeTruthy();
    expect(o.tier).toBe("surprising");
    expect(o.score).toBeGreaterThanOrEqual(0.7);
    expect(o.data!.spread as number).toBeGreaterThanOrEqual(28);
  });

  it("D2 Code reawakened in the last year — surfaced surge", () => {
    expect(obs("MOVE_CODE_SURGE")).toBeTruthy();
  });

  it("B1 the volume spike is surfaced (Surprising)", () => {
    const o = obs("OVERVIEW_VOLUME")!;
    expect(o.tier).toBe("surprising");
    expect(o.score).toBeGreaterThanOrEqual(0.7);
  });

  it("G1 deepest threads are decisions — Solid, surfaced, lists the real threads", () => {
    const o = obs("DECISIONS_ARE_DEEPEST")!;
    expect(o.tier).toBe("solid");
    expect(o.score).toBeGreaterThanOrEqual(0.7);
    const titles = (o.data!.decisions as { title: string }[]).map((d) => d.title.toLowerCase()).join(" | ");
    expect(titles).toMatch(/truck|laptop|degree|madras|earn/);
  });

  it("H1 'analysis' is the single most recurring title word (35×) — Solid, surfaced", () => {
    const o = obs("RECURRING_TITLE_WORDS")!;
    expect(o.tier).toBe("solid");
    const top = (o.data!.top as [string, number][])[0];
    expect(top[0]).toBe("analysis");
    expect(top[1]).toBe(35);
  });

  it("C3 the deepest single thread ran 87 turns", () => {
    expect((obs("DEPTH_DEEPEST")!.data!.turns as number)).toBe(87);
  });

  // ── MUST DEMOTE (found but refused) ────────────────────────────────────────
  it("D6 'Career is an anchor' is DEMOTED (fails the counterfactual)", () => {
    expect(obs("HELD_CAREER_DEMOTE")!.tier).toBe("demoted");
    const solid = (obs("HELD_ANCHORS")!.data!.solid as { topic: string }[]).map((s) => s.topic);
    expect(solid).not.toContain("Career");
    expect(solid).toEqual(expect.arrayContaining(["Learning", "Business", "Code"]));
  });

  it("C6 'became a deeper thinker' is DEMOTED", () => {
    expect(obs("DEPTH_THINKER_DEMOTE")!.tier).toBe("demoted");
  });

  it("A5 a timing-personality stereotype is DEMOTED, not asserted", () => {
    expect(obs("OVERVIEW_TIMING_STEREOTYPE")!.tier).toBe("demoted");
  });

  // ── MUST RANK LOW (found but kept quiet) ───────────────────────────────────
  it("A1/A3 counting facts and timing are kept quiet (score < 0.5)", () => {
    expect(obs("OVERVIEW_COUNT")!.score).toBeLessThan(0.5);
    expect(obs("OVERVIEW_TIMING")!.score).toBeLessThan(0.5);
    expect(obs("OVERVIEW_WEEKDAY")!.score).toBeLessThan(0.5);
  });

  // ── MUST NOT FENCE-AS-FACT: no interpretation asserted outside a theory zone ─
  it("no interpretation is asserted as fact outside the fenced theory category", () => {
    for (const o of result.observations) {
      if (o.confidenceType === "interpretation" && o.category !== 8) {
        expect(o.tier).toBe("demoted"); // the only non-fenced interpretations allowed are refusals
      }
    }
  });
});
