/**
 * OpenAI image provider (gpt-image-1 / DALL·E).
 *
 * Implemented over plain `fetch` (no SDK) to keep the bundle small. gpt-image-1
 * returns base64 directly. Strong at text rendering and general-purpose images,
 * and supports edits, so it's a useful fallback for Gemini.
 */

import { withTimeout, type Provider } from "./base.js";
import type {
  AspectRatio,
  Capabilities,
  EditRequest,
  GenerateRequest,
  GenResult,
} from "../types.js";

const CAPS: Capabilities = {
  textToImage: true,
  edit: true,
  referenceImages: true,
  maxReferenceImages: 4,
  aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "4:5", "5:4", "21:9"],
  strengths: ["typography", "art", "photoreal"],
  speed: "medium",
  costTier: 2,
};

/** gpt-image-1 supports a small fixed set of sizes; map ratios onto them. */
function sizeFor(ratio: AspectRatio | undefined): string {
  switch (ratio) {
    case "9:16":
    case "3:4":
    case "2:3":
    case "4:5":
      return "1024x1536"; // portrait
    case "16:9":
    case "4:3":
    case "3:2":
    case "5:4":
    case "21:9":
      return "1536x1024"; // landscape
    default:
      return "1024x1024"; // square
  }
}

export class OpenAIProvider implements Provider {
  readonly id = "openai";
  readonly displayName = "OpenAI";
  readonly capabilities = CAPS;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly defaultModel: string,
    private readonly defaultTimeoutMs: number,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async generate(req: GenerateRequest): Promise<GenResult> {
    const model = req.model || this.defaultModel;
    return withTimeout(req.timeoutMs ?? this.defaultTimeoutMs, async (signal) => {
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          prompt: req.prompt,
          n: 1,
          size: sizeFor(req.aspectRatio),
        }),
      });
      return this.parse(res, model);
    });
  }

  async edit(req: EditRequest): Promise<GenResult> {
    const model = req.model || this.defaultModel;
    return withTimeout(req.timeoutMs ?? this.defaultTimeoutMs, async (signal) => {
      const form = new FormData();
      form.append("model", model);
      form.append("prompt", req.prompt);
      form.append("size", sizeFor(req.aspectRatio));
      // Base image + references are all passed as image[] inputs.
      const images = [req.baseImage, ...(req.references ?? [])].slice(
        0,
        CAPS.maxReferenceImages + 1,
      );
      for (const img of images) {
        const blob = new Blob([Buffer.from(img.base64, "base64")], {
          type: img.mimeType || "image/png",
        });
        form.append("image[]", blob, "image.png");
      }
      const res = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        signal,
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: form,
      });
      return this.parse(res, model);
    });
  }

  private async parse(res: Response, model: string): Promise<GenResult> {
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        success: false,
        errorCode: `OPENAI_HTTP_${res.status}`,
        error: `OpenAI error ${res.status}: ${text.slice(0, 300)}`,
      };
    }
    const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) {
      return { success: false, errorCode: "NO_IMAGE", error: "OpenAI returned no image data" };
    }
    return { success: true, base64Data: b64, mimeType: "image/png", model };
  }
}
