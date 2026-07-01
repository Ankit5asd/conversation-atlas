// AI-layer guardrail tests — no network. Proves the sanitizer enforces the hard
// blocks regardless of what a model returns (the model is a debater; the code is
// the bailiff).

import { describe, it, expect } from "vitest";
import { sanitizeEnrichment, parseModelJson, applyEnrichment } from "../ai";
import { analyze } from "../index";
import { buildConversations, utcClock } from "./fixture";

const existing = new Set(["DEPTH_GROWTH", "HELD_CAREER_DEMOTE"]);
const demoted = new Set(["HELD_CAREER_DEMOTE"]);

describe("parseModelJson", () => {
  it("strips markdown fences and extracts the JSON object", () => {
    expect(parseModelJson('```json\n{"theories":[]}\n```')).toEqual({ theories: [] });
    expect(parseModelJson('prose before {"language":[]} prose after')).toEqual({ language: [] });
  });
});

describe("sanitizeEnrichment — guardrails", () => {
  it("accepts a well-formed theory and forces it to end in a question", () => {
    const raw = JSON.stringify({ theories: [{ question: "You may learn by deciding", evidence: "Your deepest threads are choices", confidence: "a real possibility" }] });
    const { observations } = sanitizeEnrichment(raw, existing, demoted);
    const t = observations.find((o) => o.category === 8)!;
    expect(t.tier).toBe("theory");
    expect(t.title.endsWith("?")).toBe(true);
    expect(t.confidenceType).toBe("interpretation");
  });

  it("DROPS a theory that smuggles a clinical/personality label", () => {
    const raw = JSON.stringify({
      theories: [
        { question: "Are you an ADHD-style thinker?", evidence: "you jump around", confidence: "a hunch" },
        { question: "You are an introvert, right?", evidence: "x", confidence: "a hunch" },
        { question: "Do you learn by building?", evidence: "your deep threads are builds", confidence: "a hunch" },
      ],
    });
    const { observations } = sanitizeEnrichment(raw, existing, demoted);
    const theories = observations.filter((o) => o.category === 8);
    expect(theories).toHaveLength(1);
    expect(theories[0].title).toMatch(/building/i);
  });

  it("DROPS fake-precision confidence from language notes", () => {
    const raw = JSON.stringify({ language: [{ title: "Hedging", description: "You are 83.7% tentative" }] });
    const { observations } = sanitizeEnrichment(raw, existing, demoted);
    expect(observations.filter((o) => o.category === 5)).toHaveLength(0);
  });

  it("attaches a critique but REFUSES to revive a demoted finding", () => {
    const raw = JSON.stringify({
      critiques: [
        { findingId: "DEPTH_GROWTH", note: "could be model upgrades", suggestedTier: "context" },
        { findingId: "HELD_CAREER_DEMOTE", note: "I think career IS an anchor", suggestedTier: "solid" },
        { findingId: "NONEXISTENT", note: "ignore me" },
      ],
    });
    const { critiques } = sanitizeEnrichment(raw, existing, demoted);
    expect(critiques).toHaveLength(2); // NONEXISTENT dropped
    const revive = critiques.find((c) => c.findingId === "HELD_CAREER_DEMOTE")!;
    expect(revive.suggestedTier).toBeUndefined(); // cannot promote a demotion
    const ok = critiques.find((c) => c.findingId === "DEPTH_GROWTH")!;
    expect(ok.suggestedTier).toBe("context"); // legitimate re-tier allowed
  });
});

describe("applyEnrichment — merge is additive, never destructive", () => {
  it("adds AI findings + notes without overwriting deterministic tiers", () => {
    const result = analyze(buildConversations(), { clock: utcClock });
    const before = result.observations.find((o) => o.id === "DEPTH_GROWTH")!.tier;
    const raw = JSON.stringify({
      theories: [{ question: "Do you learn by deciding?", evidence: "deep threads are choices", confidence: "a hunch" }],
      critiques: [{ findingId: "DEPTH_GROWTH", note: "watch the model-upgrade confound", suggestedTier: "context" }],
    });
    const enrichment = sanitizeEnrichment(raw, new Set(result.observations.map((o) => o.id)), new Set(result.observations.filter((o) => o.tier === "demoted").map((o) => o.id)));
    const merged = applyEnrichment(result, enrichment);
    const growth = merged.observations.find((o) => o.id === "DEPTH_GROWTH")!;
    expect(growth.tier).toBe(before); // deterministic tier untouched
    expect(growth.aiNote).toMatch(/confound/);
    expect(growth.aiSuggestedTier).toBe("context"); // shown transparently, not merged
    expect(merged.byCategory[8].some((o) => o.fromAI)).toBe(true);
  });
});

describe("deterministic language layer (category 5)", () => {
  it("emits a hedging finding as capped LANGUAGE-tier context", () => {
    const result = analyze(buildConversations(), { clock: utcClock });
    const h = result.observations.find((o) => o.id === "LANG_HEDGING")!;
    expect(h.category).toBe(5);
    expect(h.confidenceType).toBe("language");
    expect(h.tier).toBe("context");
  });
});
