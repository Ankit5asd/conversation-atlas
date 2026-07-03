// The demo dataset must showcase every engine feature, deterministically —
// it's the first thing most visitors will ever see.

import { describe, it, expect } from "vitest";
import { analyze, buildDemoConversations } from "../index";
import { utcClock } from "./fixture";

const convos = buildDemoConversations();
const result = analyze(convos, { clock: utcClock });
const obs = (id: string) => result.observations.find((o) => o.id === id);

describe("demo dataset", () => {
  it("is deterministic — identical on every visit", () => {
    const again = buildDemoConversations();
    expect(again.length).toBe(convos.length);
    expect(again[0].title).toBe(convos[0].title);
    expect(again[again.length - 1].createTime).toBe(convos[convos.length - 1].createTime);
  });

  it("shows the volume spike as Surprising", () => {
    const o = obs("OVERVIEW_VOLUME")!;
    expect(o.tier).toBe("surprising");
  });

  it("shows monotonic depth growth (Solid) and broad depth", () => {
    const g = obs("DEPTH_GROWTH")!;
    expect(g.tier).toBe("solid");
    expect(g.survives).toBe(true);
    expect(obs("DEPTH_BROAD")!.tier).toBe("solid");
  });

  it("shows a volatile Business theme and a Code surge", () => {
    expect(obs("MOVE_BUSINESS_VOLATILE")).toBeTruthy();
    expect(obs("MOVE_CODE_SURGE")).toBeTruthy();
  });

  it("shows three surviving anchors AND the Career demotion (the signature refusal)", () => {
    const anchors = obs("HELD_ANCHORS")!;
    const solid = (anchors.data!.solid as { topic: string }[]).map((s) => s.topic);
    expect(solid).toEqual(expect.arrayContaining(["Learning", "Business", "Code"]));
    expect(solid).not.toContain("Career");
    expect(obs("HELD_CAREER_DEMOTE")!.tier).toBe("demoted");
  });

  it("shows the decision signature with the deep fictional threads", () => {
    const d = obs("DECISIONS_ARE_DEEPEST")!;
    const titles = (d.data!.decisions as { title: string }[]).map((x) => x.title.toLowerCase()).join("|");
    expect(titles).toMatch(/meal-prep|laptop|degree|earn/);
  });

  it("'budget' is the dominant recurring title word", () => {
    const r = obs("RECURRING_TITLE_WORDS")!;
    expect((r.data!.top as [string, number][])[0][0]).toBe("budget");
  });

  it("shows the rising-hedging language finding", () => {
    const h = obs("LANG_HEDGING")!;
    expect(h).toBeTruthy();
    const vals = Object.values(h.data!.hedgingByYear as Record<number, number>);
    expect(vals[vals.length - 1]).toBeGreaterThan(vals[0]);
  });

  it("contains no real user data markers", () => {
    // The fictional persona must never echo the developer's real history.
    const all = convos.map((c) => c.title).join(" ").toLowerCase();
    expect(all).not.toMatch(/iit|madras|neet|bseb|patna|truck/);
  });
});
