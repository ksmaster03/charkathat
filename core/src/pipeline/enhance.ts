/**
 * Deterministic prompt enhancement (the CLI/MCP-level layer).
 *
 * The smartest enhancement happens in the Skill, where Claude rewrites the
 * prompt using full context. But for direct CLI/MCP calls that bypass the
 * skill, this gives a useful, rule-based boost: it appends quality/clarity
 * boosters that the major image models respond well to — without inventing
 * subject matter the user didn't ask for.
 */

const QUALITY_BOOSTERS = [
  "highly detailed",
  "professional composition",
  "sharp focus",
  "high quality",
];

// Boosters we skip adding if the user already implied them, to avoid redundancy.
const ALREADY_IMPLIES = /\b(detailed|high quality|hd|4k|8k|professional|sharp|photoreal|realistic)\b/i;

/**
 * Enhance a prompt by appending quality boosters that aren't already present.
 * Idempotent-ish: re-running won't keep stacking the same words.
 */
export function enhancePrompt(prompt: string): string {
  const trimmed = prompt.trim();
  if (ALREADY_IMPLIES.test(trimmed)) {
    // The user already steered toward quality; add only a light nudge.
    return `${trimmed}, professional composition`;
  }
  const additions = QUALITY_BOOSTERS.filter(
    (b) => !trimmed.toLowerCase().includes(b),
  );
  if (additions.length === 0) return trimmed;
  return `${trimmed}, ${additions.join(", ")}`;
}

/**
 * Infer job characteristics from the prompt text so the registry can pick a
 * provider even when the caller didn't specify one. Cheap keyword heuristics —
 * the Skill layer can always be more precise.
 */
export function inferHints(prompt: string): {
  needsTypography: boolean;
  needsVector: boolean;
} {
  const p = prompt.toLowerCase();
  const needsTypography =
    /\b(logo|text|word|wordmark|typography|poster|banner with text|sign|label)\b/.test(
      p,
    );
  const needsVector =
    /\b(icon|vector|flat illustration|svg|line art|minimalist logo|app icon)\b/.test(
      p,
    );
  return { needsTypography, needsVector };
}
