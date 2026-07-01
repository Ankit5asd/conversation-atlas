// Synthetic fixture that reproduces the *shape* of a real export so the engine's
// rules can be tested deterministically and committed safely (no private data).
// It is engineered to trigger: monotonic depth growth, a volatile theme, a code
// surge, three surviving anchors + one anchor that fails the counterfactual,
// deep decision threads, and a dominant recurring title word.

import type { Conversation, Clock } from "../index";

/** A UTC clock so hour-of-day is deterministic in tests (browser uses local). */
export const utcClock: Clock = {
  hour: (e) => new Date(e * 1000).getUTCHours(),
  dow: (e) => new Date(e * 1000).getUTCDay(),
};

const LEARN = "explain how does this concept work, help me understand the theory";
const BUS = "startup business idea to make money income revenue and how to sell";
const CODE = "python code function debug the api script in javascript react";
const CAREER = "job career interview resume for placement at a company salary offer";
const BUSCODE = "startup business python app to make money, build the code and sell it";
const NEUTRAL = "tell me a short story about the open sky and clouds";

let idc = 0;
function C(year: number, turns: number, title: string, text: string, hour = 12): Conversation {
  const createTime = Date.UTC(year, 0, 15, hour, 0, 0) / 1000;
  const msgs = Array.from({ length: Math.max(turns, 1) }, (_, i) => (i === 0 ? text : `follow up ${i}`));
  return { id: String(idc++), title, createTime, year, userMessages: msgs, turns, text: msgs.join(" ").toLowerCase(), source: "chatgpt" };
}
function many(n: number, year: number, turns: number, titlePrefix: string, text: string): Conversation[] {
  return Array.from({ length: n }, (_, i) => C(year, turns, `${titlePrefix} ${i + 1}`, text));
}

export function buildConversations(): Conversation[] {
  idc = 0;
  const out: Conversation[] = [];

  // 2023 — 10 convos, avg ~2 turns. Business 40%, Code 10%, Learning 30%.
  out.push(...many(4, 2023, 2, "Market analysis", BUS));
  out.push(...many(1, 2023, 2, "Script fix", CODE));
  out.push(...many(3, 2023, 2, "Concept analysis", LEARN));
  out.push(...many(2, 2023, 2, "Sky story", NEUTRAL));

  // 2024 — 20 convos, avg ~3. Business 5%, Code 5%, Career 10%, Learning 30%.
  out.push(...many(1, 2024, 3, "Business analysis", BUS));
  out.push(...many(1, 2024, 3, "Debug help", CODE));
  out.push(...many(2, 2024, 3, "Career question", CAREER));
  out.push(...many(6, 2024, 3, "Learning analysis", LEARN));
  out.push(...many(10, 2024, 3, "Random note", NEUTRAL));

  // 2025 — 40 convos (volume spike), avg ~5. Business 10%, Code 10%, Career 15%, Learning 30%.
  out.push(...many(4, 2025, 5, "Business analysis", BUS));
  out.push(...many(4, 2025, 5, "Coding analysis", CODE));
  out.push(...many(6, 2025, 5, "Career path", CAREER));
  out.push(...many(12, 2025, 5, "Study analysis", LEARN));
  out.push(...many(14, 2025, 5, "Misc note", NEUTRAL));

  // 2026 — 20 convos, avg ~8+. Business 45%, Code 40%, Career 25%, Learning 15%.
  out.push(...many(5, 2026, 8, "Build analysis", BUSCODE)); // business + code
  out.push(...many(4, 2026, 8, "Business plan", BUS));
  out.push(...many(3, 2026, 8, "Code refactor", CODE));
  out.push(...many(2, 2026, 8, "Learning note", LEARN));
  // Deep decision threads (deepest in the set) — drive Category 6.
  out.push(C(2026, 30, "Which laptop to buy comparison", "which laptop should i buy comparison of specs"));
  out.push(C(2026, 28, "Sellable truck booking system app", "build a sellable truck booking system app to sell"));
  out.push(C(2026, 26, "Career vs degree decision", "career vs degree which should i choose after college"));
  out.push(C(2026, 24, "Ways to earn online", "ways to earn online and make money on the internet"));

  return out;
}

/** Minimal raw exports to exercise the parser's format detection. */
export const chatgptSample = [
  {
    conversation_id: "cg1",
    title: "Pollen Viability",
    create_time: Date.UTC(2024, 4, 1, 10) / 1000,
    mapping: {
      a: { message: { author: { role: "system" }, content: { parts: [""] } } },
      b: { message: { author: { role: "user" }, content: { content_type: "text", parts: ["what is pollen viability"] } } },
      c: { message: { author: { role: "assistant" }, content: { parts: ["Pollen viability is…"] } } },
      d: { message: { author: { role: "user" }, content: { parts: ["explain the factors"] } } },
    },
  },
];

export const claudeSample = [
  {
    uuid: "cl1",
    name: "Refactor plan",
    created_at: "2025-03-10T08:00:00Z",
    chat_messages: [
      { sender: "human", text: "help me refactor this python code" },
      { sender: "assistant", text: "Sure…" },
      { sender: "human", content: [{ type: "text", text: "now add tests" }] },
    ],
  },
];
