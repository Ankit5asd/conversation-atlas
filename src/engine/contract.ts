// ── The LOCKED CONTRACT ───────────────────────────────────────────────────────
// The fixed structure every finding lives inside. Extractors decide *what goes
// where*; they may never invent a category, promote a guess to a fact, or attach
// a personality label. This file is the constitution; extractors are debaters.

import type { ConfidenceType, Tier } from "./types";

/** The 9 categories. Every finding belongs to exactly one. */
export const CATEGORIES: Record<number, { key: string; title: string; intro: string }> = {
  1: { key: "overview", title: "When and how much", intro: "The plainly countable stuff. True, but rarely the interesting part — so it sets the scene rather than leading." },
  2: { key: "depth", title: "How deep you go", intro: "The strongest signal in your whole history — measured, and it survives every test we throw at it." },
  3: { key: "moved", title: "What moved", intro: "Where your interests swung the hardest year to year. Change is where the interesting story usually lives." },
  4: { key: "held", title: "What held steady", intro: "The durable spine — and any finding the engine deliberately refused, because it looked true but failed the test." },
  5: { key: "thinking", title: "How you think, in words", intro: "Signals from your actual phrasing. Real, but capped — words show behaviour, not the mind behind it. (Needs an API key.)" },
  6: { key: "decisions", title: "Your decision signature", intro: "What your very deepest conversations have in common — measured by turn count, ranked." },
  7: { key: "subjects", title: "What you keep coming back to", intro: "The specific subjects that recur across your conversation titles — the 'only in your data' fingerprints." },
  8: { key: "theories", title: "Theories worth testing", intro: "The bold reads. Guesses over real patterns — fenced off on purpose, each ending in a question only you can answer. (Needs an API key.)" },
  9: { key: "audit", title: "What this can — and can't — see", intro: "The engine judged by its own rules. Where it's confident, where it's guessing, and what it's blind to." },
};

/** Ceiling per confidence type — type sets the max, evidence sets the position. */
export const CONFIDENCE_CEILING: Record<ConfidenceType, number> = {
  count: 0.99,
  pattern: 0.95,
  language: 0.8,
  interpretation: 0.65,
};

/** Tier display metadata (colors matched to the reference design tokens). */
export const TIER_META: Record<Tier, { label: string; color: string }> = {
  solid: { label: "Solid finding", color: "var(--teal-d)" },
  surprising: { label: "Surprising", color: "var(--coral)" },
  context: { label: "Context", color: "var(--blue)" },
  demoted: { label: "Demoted", color: "var(--ink-mute)" },
  theory: { label: "Theory", color: "var(--violet)" },
};

// ── Topic ontology ────────────────────────────────────────────────────────────
// This is a CHOSEN RESOLUTION, not a fact about the user. It is exported so the
// UI can show it as inspectable/adjustable (guardrail 2: assumptions visible).
// Ported from the reference prototype and extended with the extra buckets the
// oracle references (Writing, Math, Health).
export const ONTOLOGY: Record<string, RegExp> = {
  Learning: /\b(explain|understand|concept|how does|why does|what is|difference between|learn|theory)\b/,
  Business: /\b(business|startup|money|income|profit|market|customer|revenue|sell|pricing|invest|leverage)\b/,
  Career: /\b(job|career|interview|resume|salary|offer|internship|placement|company|hire)\b/,
  Code: /\b(python|code|function|api|bug|debug|javascript|react|sql|algorithm|programming|script)\b/,
  Personal: /\b(feel|my life|anxious|stress|motivation|habit|why do i|overwhelm)\b/,
  Writing: /\b(write|essay|draft|email|letter|blog|article|paragraph|rewrite|grammar)\b/,
  Math: /\b(calculate|equation|solve|integral|derivative|probability|matrix|geometry|arithmetic)\b/,
  Health: /\b(health|diet|exercise|sleep|symptom|doctor|medicine|nutrition|calories)\b/,
};

/** Colors assigned to topics (stable, for consistent charts). */
export const TOPIC_COLOR: Record<string, string> = {
  Learning: "var(--blue)",
  Business: "var(--coral)",
  Career: "var(--violet)",
  Code: "var(--teal)",
  Personal: "var(--pink)",
  Writing: "var(--amber)",
  Math: "var(--blue-l)",
  Health: "var(--teal-l)",
};
