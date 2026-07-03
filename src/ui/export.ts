// ── Download / view the outcome ───────────────────────────────────────────────
// Everything stays on the user's device — same privacy promise as the app.
// Android-friendly: a downloaded local .html often has no default app to open it,
// so the primary action OPENS the report in a browser tab (renders instantly on
// mobile). "Save" uses the native share sheet on mobile, a file download on
// desktop. JSON is for raw data portability.

import type { AtlasResult } from "../engine";

const today = () => new Date().toISOString().slice(0, 10);

function triggerDownload(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Pull every readable stylesheet rule so the report is self-contained.
 *  Cross-origin sheets (Google Fonts) throw on cssRules — skipped; the font
 *  <link> is re-added to the export head so they still load when online. */
function collectCss(): string {
  let css = "";
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) css += rule.cssText + "\n";
    } catch {
      /* cross-origin sheet — skip */
    }
  }
  return css;
}

/** Build the self-contained report HTML from the live, rendered dashboard. */
function buildReportHTML(result: AtlasResult): string {
  const shell = document.querySelector(".shell");
  if (!shell) return "";
  const clone = shell.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("[data-noexport]").forEach((n) => n.remove()); // strip interactive controls
  // Below-fold cards may not have scroll-revealed yet — force them visible.
  clone.querySelectorAll(".reveal").forEach((n) => n.classList.add("in"));

  const css = collectCss();
  const stamp = `${result.meta.total} conversations · ${result.meta.dateRange.start} → ${result.meta.dateRange.end} · exported ${today()}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;1,400;1,500&family=Inter:wght@400;500&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<title>Conversation Atlas — my report</title>
<style>${css}</style>
</head>
<body>
<!-- ${stamp} -->
${clone.outerHTML}
</body>
</html>`;
}

const REPORT_NAME = () => `conversation-atlas-report-${today()}.html`;

/** True on devices that can share files (mobile). */
function canShareFiles(file: File): boolean {
  return typeof navigator !== "undefined" && !!navigator.canShare && navigator.canShare({ files: [file] });
}

/** PRIMARY — open the report in a new browser tab. Works everywhere, and on
 *  Android it renders immediately instead of downloading an un-openable file. */
export function viewReport(result: AtlasResult) {
  const html = buildReportHTML(result);
  if (!html) return;
  const w = window.open("", "_blank");
  if (!w) {
    // Popup blocked → fall back to a data-URL navigation, then a file download.
    try {
      window.location.href = "data:text/html;charset=utf-8," + encodeURIComponent(html);
    } catch {
      triggerDownload(REPORT_NAME(), html, "text/html");
    }
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/** SAVE AS PDF — the only format that reliably opens on Android when transferred
 *  from another device. Uses the browser's print pipeline (Save as PDF), which
 *  needs no library and keeps text selectable. Print CSS (@media print) hides the
 *  interactive chrome and forces a clean light layout. */
export function printReport() {
  window.print();
}

/** Raw findings — portable, re-importable. Shares on mobile, downloads on desktop.
 *  The user's theory verdicts ride along: disagreement is evidence, so it's kept. */
export async function exportJSON(result: AtlasResult, userFeedback?: Record<string, string>) {
  const name = `conversation-atlas-${today()}.json`;
  const payload = userFeedback && Object.keys(userFeedback).length ? { ...result, userFeedback } : result;
  const json = JSON.stringify(payload, null, 2);
  const file = new File([json], name, { type: "application/json" });
  if (canShareFiles(file)) {
    try {
      await navigator.share({ files: [file], title: "Conversation Atlas data" });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  triggerDownload(name, json, "application/json");
}
