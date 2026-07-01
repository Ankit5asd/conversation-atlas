// Portable engine mechanics tests — committed, deterministic, no private data.
// Verifies the guardrail behaviors that make this product honest.

import { describe, it, expect } from "vitest";
import { analyze, parseExport } from "../index";
import { buildConversations, utcClock, chatgptSample, claudeSample } from "./fixture";

const result = analyze(buildConversations(), { clock: utcClock });
const obs = (id: string) => result.observations.find((o) => o.id === id);

describe("parser", () => {
  it("detects and parses a ChatGPT export, counting only user turns", () => {
    const { conversations, format } = parseExport(chatgptSample);
    expect(format).toBe("chatgpt");
    expect(conversations).toHaveLength(1);
    expect(conversations[0].turns).toBe(2); // two user messages
    expect(conversations[0].year).toBe(2024);
  });

  it("detects and parses a Claude export (text + content-block shapes)", () => {
    const { conversations, format } = parseExport(claudeSample);
    expect(format).toBe("claude");
    expect(conversations[0].turns).toBe(2);
    expect(conversations[0].text).toContain("refactor");
  });
});

describe("depth (category 2) — the flagship", () => {
  it("finds monotonic depth growth and marks it Solid + surfaced", () => {
    const o = obs("DEPTH_GROWTH")!;
    expect(o.tier).toBe("solid");
    expect(o.survives).toBe(true);
    expect(o.score).toBeGreaterThanOrEqual(0.7);
    const avgs = Object.values(o.data!.avgByYear as Record<number, number>);
    expect(avgs).toEqual([...avgs].sort((a, b) => a - b)); // strictly increasing
  });

  it("refuses to claim the user 'became a deeper thinker'", () => {
    const o = obs("DEPTH_THINKER_DEMOTE")!;
    expect(o.tier).toBe("demoted");
    expect(o.score).toBeLessThan(0.3);
  });
});

describe("movement (category 3)", () => {
  it("surfaces the most volatile theme as Surprising", () => {
    const volatile = result.observations.find((o) => o.category === 3 && o.tier === "surprising");
    expect(volatile).toBeTruthy();
    expect(volatile!.score).toBeGreaterThanOrEqual(0.7);
  });
});

describe("held steady (category 4) — the counterfactual demotion", () => {
  it("keeps genuine anchors as Solid", () => {
    const anchors = obs("HELD_ANCHORS")!;
    expect(anchors.tier).toBe("solid");
    const solid = (anchors.data!.solid as { topic: string }[]).map((s) => s.topic);
    expect(solid).toContain("Learning");
    expect(solid).toContain("Business");
    expect(solid).toContain("Code");
  });

  it("DEMOTES 'Career is an anchor' because it fails remove-biggest-year", () => {
    const demote = obs("HELD_CAREER_DEMOTE")!;
    expect(demote).toBeTruthy();
    expect(demote.tier).toBe("demoted");
    // and Career must NOT appear among the surfaced solid anchors
    const solid = (obs("HELD_ANCHORS")!.data!.solid as { topic: string }[]).map((s) => s.topic);
    expect(solid).not.toContain("Career");
  });
});

describe("decisions (category 6) & recurring (category 7)", () => {
  it("surfaces that the deepest threads are decisions", () => {
    const o = obs("DECISIONS_ARE_DEEPEST")!;
    expect(o.tier).toBe("solid");
    expect(o.score).toBeGreaterThanOrEqual(0.7);
    const titles = (o.data!.decisions as { title: string }[]).map((d) => d.title);
    expect(titles.some((t) => /laptop|sellable|degree|earn/i.test(t))).toBe(true);
  });

  it("finds the dominant recurring title word", () => {
    const o = obs("RECURRING_TITLE_WORDS")!;
    expect(o.tier).toBe("solid");
    expect((o.data!.top as [string, number][])[0][0]).toBe("analysis");
  });
});

describe("timing (category 1) — no stereotype", () => {
  it("reports timing as quiet Context, never a personality claim", () => {
    const timing = obs("OVERVIEW_TIMING")!;
    expect(timing.tier).toBe("context");
    expect(timing.score).toBeLessThan(0.5);
  });

  it("emits a refusal card for the timing stereotype", () => {
    const refusal = obs("OVERVIEW_TIMING_STEREOTYPE")!;
    expect(refusal.tier).toBe("demoted");
  });
});

describe("no hard-block violations leak through", () => {
  it("no observation asserts a personality/clinical label as a finding", () => {
    const banned = /\b(you are an?|you're an?)\s+(intj|entp|introvert|extrovert|adhd|anxious type|night owl)\b/i;
    for (const o of result.observations) {
      if (o.tier === "demoted") continue; // refusals may name the label they reject
      expect(`${o.title} ${o.description}`).not.toMatch(banned);
    }
  });

  it("no fake-precision percentage confidence anywhere", () => {
    for (const o of result.observations) {
      expect(`${o.title} ${o.description}`).not.toMatch(/\b\d{1,3}\.\d%\s*(confident|confidence)/i);
    }
  });
});
