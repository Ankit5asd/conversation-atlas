// ── Export parser ─────────────────────────────────────────────────────────────
// Accepts a ChatGPT `conversations.json` (array of nodes with a `mapping`) OR a
// Claude export (array of conversations with a `chat_messages` list). Everything
// runs in-memory; nothing is uploaded. Extracts, per conversation: title,
// create_time, the user messages, and a turn count.

import type { Conversation } from "./types";

type Json = any;

/** True if this looks like a ChatGPT export (mapping-of-nodes shape). */
function isChatGPT(sample: Json): boolean {
  return !!sample && typeof sample === "object" && !!sample.mapping;
}

/** True if this looks like a Claude export (chat_messages / messages list). */
function isClaude(sample: Json): boolean {
  return !!sample && typeof sample === "object" && (Array.isArray(sample.chat_messages) || Array.isArray(sample.messages));
}

/** Normalize a create_time that may be epoch-seconds, epoch-ms, or ISO string. */
function toEpochSeconds(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v > 1e12 ? v / 1000 : v; // ms → s
  if (typeof v === "string") {
    const asNum = Number(v);
    if (!Number.isNaN(asNum) && v.trim() !== "") return asNum > 1e12 ? asNum / 1000 : asNum;
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t / 1000;
  }
  return null;
}

/** Flatten ChatGPT content.parts (strings or {text} / {content_type} objects). */
function partsToText(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  const out: string[] = [];
  for (const p of parts) {
    if (typeof p === "string") out.push(p);
    else if (p && typeof p === "object" && typeof (p as any).text === "string") out.push((p as any).text);
  }
  return out.join(" ");
}

function parseChatGPT(data: Json[]): Conversation[] {
  const convos: Conversation[] = [];
  for (const conv of data) {
    const mapping = conv?.mapping ?? {};
    const userMessages: string[] = [];
    for (const nodeId of Object.keys(mapping)) {
      const m = mapping[nodeId]?.message;
      if (!m) continue;
      if (m.author?.role !== "user") continue;
      const text = partsToText(m.content?.parts);
      if (text && text.trim()) userMessages.push(text);
    }
    const createTime = toEpochSeconds(conv?.create_time);
    convos.push(makeConversation(String(conv?.conversation_id ?? conv?.id ?? convos.length), conv?.title ?? "", createTime, userMessages, "chatgpt"));
  }
  return convos;
}

function parseClaude(data: Json[]): Conversation[] {
  const convos: Conversation[] = [];
  for (const conv of data) {
    const msgs: Json[] = conv?.chat_messages ?? conv?.messages ?? [];
    const userMessages: string[] = [];
    for (const m of msgs) {
      const role = m?.sender ?? m?.role;
      if (role !== "human" && role !== "user") continue;
      // Claude stores text either as `text` or as an array of content blocks.
      let text = "";
      if (typeof m?.text === "string") text = m.text;
      else if (Array.isArray(m?.content)) {
        text = m.content.map((b: Json) => (typeof b === "string" ? b : b?.text ?? "")).join(" ");
      }
      if (text && text.trim()) userMessages.push(text);
    }
    const createTime = toEpochSeconds(conv?.created_at ?? conv?.create_time);
    convos.push(makeConversation(String(conv?.uuid ?? conv?.id ?? convos.length), conv?.name ?? conv?.title ?? "", createTime, userMessages, "claude"));
  }
  return convos;
}

function makeConversation(id: string, title: string, createTime: number | null, userMessages: string[], source: Conversation["source"]): Conversation {
  const year = createTime ? new Date(createTime * 1000).getUTCFullYear() : null;
  return {
    id,
    title: title || "",
    createTime,
    year,
    userMessages,
    turns: userMessages.length,
    text: userMessages.join(" ").toLowerCase(),
    source,
  };
}

/**
 * Parse a raw export (already JSON.parsed) into Conversations.
 * Detects the format from the first element. Returns conversations *with a year
 * only* is left to the caller — parse keeps everything, the pipeline filters.
 */
export function parseExport(data: Json): { conversations: Conversation[]; format: "chatgpt" | "claude" | "unknown" } {
  const arr: Json[] = Array.isArray(data) ? data : data?.conversations ?? [];
  if (!Array.isArray(arr) || arr.length === 0) return { conversations: [], format: "unknown" };
  const sample = arr[0];
  if (isChatGPT(sample)) return { conversations: parseChatGPT(arr), format: "chatgpt" };
  if (isClaude(sample)) return { conversations: parseClaude(arr), format: "claude" };
  return { conversations: [], format: "unknown" };
}

/** Convenience for the browser: parse a File's text content. */
export async function parseExportFile(file: File): Promise<{ conversations: Conversation[]; format: "chatgpt" | "claude" | "unknown" }> {
  const text = await file.text();
  return parseExport(JSON.parse(text));
}
