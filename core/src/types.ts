/**
 * Shared type definitions for charkathat.
 *
 * These types are the contract between the provider layer, the pipeline
 * (orchestration), and the two entry points (CLI + MCP). Keeping them in one
 * place lets every module agree on the same shapes without circular imports.
 */

/** Aspect ratios understood by the pipeline. Providers map these to pixel sizes. */
export type AspectRatio =
  | "1:1"
  | "16:9"
  | "9:16"
  | "4:3"
  | "3:4"
  | "4:5"
  | "5:4"
  | "3:2"
  | "2:3"
  | "21:9";

export const ALL_ASPECT_RATIOS: AspectRatio[] = [
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "4:5",
  "5:4",
  "3:2",
  "2:3",
  "21:9",
];

/**
 * Tags describing what a provider is good at. The registry scores providers
 * against the hints of a job using these tags — see {@link Capabilities}.
 */
export type Strength =
  | "photoreal" // product shots, lifelike scenes
  | "typography" // text rendering / logos with words
  | "vector" // clean icon / logo / flat output
  | "art" // illustration, painterly, stylised
  | "multimodal" // edit + reference images
  | "fast" // low latency
  | "cheap"; // low cost per image

/** Declared abilities of a single provider, used for automatic selection. */
export interface Capabilities {
  /** Can create an image from a text prompt alone. */
  textToImage: boolean;
  /** Can take an input image + prompt and return a modified image. */
  edit: boolean;
  /** Can accept additional reference images to steer style/subject. */
  referenceImages: boolean;
  /** Max reference images accepted in a single call (0 if unsupported). */
  maxReferenceImages: number;
  /** Aspect ratios this provider can honour. */
  aspectRatios: AspectRatio[];
  /** What the provider is best at. */
  strengths: Strength[];
  /** Rough latency class. */
  speed: "fast" | "medium" | "slow";
  /** 0 = free tier available, 1 = cheap, 2 = standard, 3 = premium. */
  costTier: 0 | 1 | 2 | 3;
}

/** A decoded image plus its mime type, used for edit/reference inputs. */
export interface ImageInput {
  base64: string;
  mimeType: string;
}

/** A pure text-to-image request handed to a provider. */
export interface GenerateRequest {
  prompt: string;
  aspectRatio?: AspectRatio;
  /** Optional provider-specific model override. */
  model?: string;
  timeoutMs?: number;
}

/** An image-editing request: a base image + prompt, optional style references. */
export interface EditRequest {
  prompt: string;
  baseImage: ImageInput;
  references?: ImageInput[];
  aspectRatio?: AspectRatio;
  model?: string;
  timeoutMs?: number;
}

/** The raw result a provider returns (image bytes, not yet saved to disk). */
export interface GenResult {
  success: boolean;
  base64Data?: string;
  mimeType?: string;
  /** Model that actually produced the image (for provenance). */
  model?: string;
  errorCode?: string;
  error?: string;
}

/** Hints the pipeline derives from a request to drive provider selection. */
export interface JobHints {
  needsEdit?: boolean;
  needsReferences?: boolean;
  needsTypography?: boolean;
  needsVector?: boolean;
  preferSpeed?: boolean;
  preferFree?: boolean;
  aspectRatio?: AspectRatio;
  /** If set, this exact provider id is required (no automatic substitution). */
  explicitProvider?: string;
}

/** One entry recorded in the gallery history manifest. */
export interface HistoryEntry {
  id: string;
  prompt: string;
  provider: string;
  model: string;
  aspectRatio: string;
  filePath: string;
  fileName: string;
  kind: "generate" | "edit";
  createdAt: string;
  warnings?: string[];
}

/** Normalised response surfaced to the CLI/MCP callers. */
export interface AssetResponse {
  success: boolean;
  filePath?: string;
  provider?: string;
  model?: string;
  aspectRatio?: string;
  mimeType?: string;
  prompt?: string;
  errorCode?: string;
  error?: string;
  warnings?: string[];
  /** When multiple images are produced (batch / variations). */
  results?: Array<{ filePath: string; provider: string; model: string }>;
  galleryPath?: string;
}
