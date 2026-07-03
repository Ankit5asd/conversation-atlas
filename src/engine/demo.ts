// ── Demo dataset ──────────────────────────────────────────────────────────────
// A FICTIONAL student's three years of AI chats, generated deterministically
// (seeded PRNG + per-year quotas) so the sample atlas is identical on every
// visit and exercises every engine feature: monotonic depth growth, a volatile
// theme, a code surge, three surviving anchors plus one demoted one, deep
// decision threads, and a dominant recurring title word. No real user data.

import type { Conversation } from "./types";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Pool {
  titles: string[];
  text: string;
}

// Text drives topic matching (ONTOLOGY runs on message text, not titles), so
// each pool's text hits exactly its own topic's keywords and no other's.
const POOLS: Record<string, Pool> = {
  Learning: {
    titles: [
      "How neural networks actually work",
      "Explain compound interest simply",
      "Recursion with real examples",
      "Why inflation happens",
      "RAM vs storage difference",
      "How the stock market works",
      "Probability basics refresher",
      "How HTTP requests travel",
      "What makes batteries degrade",
      "Photosynthesis in plain terms",
    ],
    text: "can you explain this i am trying to understand the concept and the theory behind how does it actually work",
  },
  Business: {
    titles: [
      "Side income ideas for students",
      "Pricing my design services",
      "Finding the first customers",
      "Market research for a food stall",
      "Monetizing a small audience",
      "Revenue plan for tutoring",
      "Selling study notes online",
      "Validating a startup idea fast",
    ],
    text: "i have a business idea and want to know the market what customers would pay the right pricing and how to sell it for steady income and revenue",
  },
  Code: {
    titles: [
      "Fix this python loop error",
      "React state not updating",
      "SQL join returns duplicates",
      "Debugging an async function",
      "Clean up a messy python script",
      "Regex for date parsing",
      "API pagination the right way",
      "Speeding up a slow algorithm",
    ],
    text: "help me debug this python code the function throws an error and the script fails also the api call in javascript needs fixing",
  },
  Career: {
    titles: ["Resume review for internships", "Common interview questions prep", "Reaching out to a recruiter", "Choosing between two offers"],
    text: "i am preparing for a job interview at a company and need help with my resume and salary expectations for the internship offer",
  },
  Personal: {
    titles: ["Feeling stuck this month", "Building a study habit", "Handling exam stress", "Sleep schedule reset"],
    text: "lately i feel a lot of stress and my motivation is low i want to build a better habit",
  },
  Neutral: {
    titles: [
      "Three day itinerary sketch",
      "Summarize this long text",
      "Translate a paragraph to spanish",
      "Gift options for a friend",
      "Home workout without a gym",
      "Dinner from five ingredients",
      "Speech for a college event",
      "Name suggestions for a puppy",
      "Packing list for two days",
      "Conversation openers for events",
      "Choosing a phone carrier",
      "Fixing a squeaky door hinge",
      "Plant care for beginners",
      "Board game rules clarified",
      "Cover songs to try",
      "Weekend picnic checklist",
    ],
    text: "give me a short practical answer with a few options and keep it simple please",
  },
};

// Language fingerprint per year — hedging rises as questions get deeper.
const LANG_BY_YEAR: Record<number, string> = {
  2023: " definitely this will work for sure i think",
  2024: " definitely the right way i think",
  2025: " i think maybe this could probably work definitely worth trying",
  2026: " i think maybe probably not sure it seems risky but worth it for sure",
};

// The fictional student's deepest threads: real decisions and builds.
const DEEP: { year: number; month: number; title: string; turns: number; text: string }[] = [
  { year: 2026, month: 3, title: "Sellable meal-prep delivery app plan", turns: 52, text: `${POOLS.Business.text} ${POOLS.Code.text}` },
  { year: 2026, month: 2, title: "Which laptop to buy for coding — full compare", turns: 44, text: `${POOLS.Neutral.text} ${POOLS.Code.text}` },
  { year: 2026, month: 1, title: "College degree vs coding bootcamp — which path", turns: 41, text: `${POOLS.Career.text} ${POOLS.Learning.text}` },
  { year: 2026, month: 4, title: "Ways to earn money online as a student", turns: 38, text: POOLS.Business.text },
  { year: 2026, month: 0, title: "Build a budget tracker app from scratch", turns: 35, text: POOLS.Code.text },
  { year: 2025, month: 9, title: "Freelancing profile setup and first clients", turns: 33, text: `${POOLS.Business.text} ${POOLS.Career.text}` },
  { year: 2026, month: 3, title: "Budget gaming PC vs laptop decision", turns: 29, text: POOLS.Neutral.text },
];

// Recurring-subject fingerprints: "budget" dominates the titles (17×).
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SPECIAL_NEUTRAL: Record<number, string[]> = {
  2024: ["Budget for the new semester", "Budget for a used phone"], // 2
  2025: MONTH_NAMES.map((m) => `Budget for ${m}`), // 12
  2026: ["March budget check", "April budget check", "May budget check", "Budget trip for the semester break"], // 4
};

// Per-year recipe: volume, turn range, topic quotas (fractions of n).
const YEARS = [
  { year: 2023, n: 25, turns: [2, 4] as const, months: [2, 11] as const, mix: { Learning: 0.2, Business: 0.25, Code: 0.05, Career: 0, Personal: 0 } },
  { year: 2024, n: 70, turns: [2, 5] as const, months: [0, 11] as const, mix: { Learning: 0.18, Business: 0.04, Code: 0.03, Career: 0.03, Personal: 0.03 } },
  { year: 2025, n: 190, turns: [4, 8] as const, months: [0, 11] as const, mix: { Learning: 0.16, Business: 0.11, Code: 0.08, Career: 0.05, Personal: 0.04 } },
  { year: 2026, n: 90, turns: [6, 12] as const, months: [0, 4] as const, mix: { Learning: 0.15, Business: 0.3, Code: 0.24, Career: 0.12, Personal: 0.06 } },
];

// Daytime-leaning hour distribution (UTC), peaking mid-afternoon.
const HOURS = [9, 10, 11, 11, 13, 14, 15, 15, 16, 16, 16, 17, 18, 20, 22];

export function buildDemoConversations(): Conversation[] {
  const rnd = mulberry32(20260702);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)];
  const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
  const out: Conversation[] = [];
  let id = 0;
  const titleCursor: Record<string, number> = {};

  const make = (year: number, month: number, title: string, turns: number, baseText: string): Conversation => {
    const createTime = Date.UTC(year, month, int(1, 27), pick(HOURS), int(0, 59)) / 1000;
    let first = baseText + LANG_BY_YEAR[year];
    if (rnd() < 0.3) first += " i should finish this soon and i have to prepare";
    if (rnd() < 0.1) first += " i want to try this";
    const msgs = [first];
    for (let t = 1; t < turns; t++) msgs.push(`ok one more follow up on that point number ${t}`);
    return {
      id: `demo-${id++}`,
      title,
      createTime,
      year,
      userMessages: msgs,
      turns: msgs.length,
      text: msgs.join(" ").toLowerCase(),
      source: "chatgpt",
    };
  };

  const nextTitle = (topic: string, year: number): string => {
    if (topic === "Neutral") {
      const special = SPECIAL_NEUTRAL[year];
      if (special && special.length) return special.shift()!;
    }
    const pool = POOLS[topic].titles;
    const k = `${topic}`;
    titleCursor[k] = (titleCursor[k] ?? 0) + 1;
    return pool[(titleCursor[k] - 1) % pool.length];
  };

  for (const y of YEARS) {
    // deterministic quotas per topic; remainder goes to Neutral
    const quotas: [string, number][] = Object.entries(y.mix).map(([t, f]) => [t, Math.round(f * y.n)]);
    const used = quotas.reduce((s, [, q]) => s + q, 0);
    quotas.push(["Neutral", Math.max(y.n - used, 0)]);
    for (const [topic, q] of quotas) {
      for (let i = 0; i < q; i++) {
        let turns = int(y.turns[0], y.turns[1]);
        // early-years one-shots: quick single questions, then gone
        if (topic === "Neutral" && y.year < 2026 && rnd() < 0.18) turns = 1;
        out.push(make(y.year, int(y.months[0], y.months[1]), nextTitle(topic, y.year), turns, POOLS[topic].text));
      }
    }
  }

  for (const d of DEEP) out.push(make(d.year, d.month, d.title, d.turns, d.text));
  return out;
}
