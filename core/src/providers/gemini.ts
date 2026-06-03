/**
 * Google Gemini provider — the flagship.
 *
 * Gemini's image models are multimodal: a single generateContent call can take
 * a text prompt plus one base image plus several reference images, which is how
 * we implement editing and style-consistency. Models are discovered dynamically
 * (the available image models change over time) and cached by the registry.
 */

import { GoogleGenAI } from "@google/genai";
import { withTimeout, type Provider } from "./base.js";
import type {
  Capabilities,
  EditRequest,
  GenerateRequest,
  GenResult,
  ImageInput,
} from "../types.js";

const CAPS: Capabilities = {
  textToImage: true,
  edit: true,
  referenceImages: true,
  maxReferenceImages: 13, // 13 references + 1 base = 14 images max
  aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4", "4:5", "5:4", "3:2", "2:3", "21:9"],
  strengths: ["photoreal", "art", "multimodal"],
  speed: "medium",
  costTier: 2,
};

export class GeminiProvider implements Provider {
  readonly id = "gemini";
  readonly displayName = "Google Gemini";
  readonly capabilities = CAPS;

  private ai: GoogleGenAI | null = null;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly defaultModel: string,
    private readonly defaultTimeoutMs: number,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private client(): GoogleGenAI {
    if (!this.ai) {
      if (!this.apiKey) throw new Error("GEMINI_API_KEY is not configured");
      this.ai = new GoogleGenAI({ apiKey: this.apiKey });
    }
    return this.ai;
  }

  async listModels(): Promise<string[]> {
    const pager = await this.client().models.list();
    const models = new Set<string>();
    for await (const model of pager) {
      if (
        model.name &&
        model.name.includes("image") &&
        model.supportedActions?.includes("generateContent")
      ) {
        models.add(model.name.replace(/^models\//, ""));
      }
    }
    return [...models].sort((a, b) => a.localeCompare(b));
  }

  async generate(req: GenerateRequest): Promise<GenResult> {
    const model = req.model || this.defaultModel;
    return withTimeout(req.timeoutMs ?? this.defaultTimeoutMs, async (signal) => {
      const config: Record<string, unknown> = {
        responseModalities: ["TEXT", "IMAGE"],
        abortSignal: signal,
      };
      if (req.aspectRatio) {
        config.imageConfig = { aspectRatio: req.aspectRatio };
      }
      const response = await this.client().models.generateContent({
        model,
        contents: req.prompt,
        config,
      });
      return this.extractImage(response, model);
    });
  }

  async edit(req: EditRequest): Promise<GenResult> {
    const model = req.model || this.defaultModel;
    return withTimeout(req.timeoutMs ?? this.defaultTimeoutMs, async (signal) => {
      // Multimodal contents: prompt first, then the base image, then references.
      const parts: unknown[] = [{ text: req.prompt }, toPart(req.baseImage)];
      for (const ref of (req.references ?? []).slice(0, CAPS.maxReferenceImages)) {
        parts.push(toPart(ref));
      }
      const config: Record<string, unknown> = {
        responseModalities: ["IMAGE", "TEXT"],
        abortSignal: signal,
      };
      if (req.aspectRatio) {
        config.imageConfig = { aspectRatio: req.aspectRatio };
      }
      const response = await this.client().models.generateContent({
        model,
        contents: [{ role: "user", parts }] as never,
        config,
      });
      return this.extractImage(response, model);
    });
  }

  private extractImage(response: unknown, model: string): GenResult {
    const candidates = (response as { candidates?: unknown[] }).candidates;
    if (!candidates || candidates.length === 0) {
      return { success: false, errorCode: "NO_CANDIDATES", error: "No candidates in response" };
    }
    const parts = (candidates[0] as { content?: { parts?: unknown[] } }).content?.parts;
    if (!parts) {
      return { success: false, errorCode: "NO_PARTS", error: "No content parts in response" };
    }
    for (const part of parts) {
      const inline = (part as { inlineData?: { data?: string; mimeType?: string } }).inlineData;
      if (inline?.data) {
        return {
          success: true,
          base64Data: inline.data,
          mimeType: inline.mimeType || "image/png",
          model,
        };
      }
    }
    return { success: false, errorCode: "NO_IMAGE", error: "No image data found in response" };
  }
}

function toPart(img: ImageInput) {
  return { inlineData: { mimeType: img.mimeType, data: img.base64 } };
}
