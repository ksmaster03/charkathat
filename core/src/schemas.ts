/**
 * Validation schemas.
 *
 * - `zod` schemas validate runtime arguments (CLI + MCP) and give us typed,
 *   parsed objects with helpful error messages.
 * - The plain JSON-Schema objects are what the MCP protocol advertises to the
 *   client for the `create_asset` tool.
 */

import { z } from "zod";
import { ALL_ASPECT_RATIOS } from "./types.js";
import type { AspectRatio } from "./types.js";

const aspectRatioSchema = z.enum(
  ALL_ASPECT_RATIOS as [AspectRatio, ...AspectRatio[]],
);

export const createAssetArgsSchema = z.object({
  prompt: z.string().min(1, "prompt is required"),
  outputPath: z.string().optional(),
  aspectRatio: aspectRatioSchema.optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  /** Path to an image to edit. When set, this is an edit request. */
  editImage: z.string().optional(),
  /** Paths to reference images for style/subject steering. */
  references: z.array(z.string()).optional(),
  /** Path to a `.md` style template (with a `## Prompt Template` block). */
  style: z.string().optional(),
  /** Apply deterministic prompt enhancement before generating. */
  enhance: z.boolean().optional(),
  /** Number of variations to produce (1-4). */
  count: z.number().int().min(1).max(4).optional(),
  /** Write/refresh an HTML gallery after generating. */
  gallery: z.boolean().optional(),
});

export type CreateAssetArgs = z.infer<typeof createAssetArgsSchema>;

/** JSON Schema advertised to MCP clients. */
export const createAssetInputSchema = {
  type: "object",
  properties: {
    prompt: {
      type: "string",
      description:
        "Detailed image description. Use the formula [Style] [Subject] [Composition] [Atmosphere].",
    },
    outputPath: {
      type: "string",
      description:
        "Optional output file path (relative paths resolve against the project root).",
    },
    aspectRatio: {
      type: "string",
      enum: ALL_ASPECT_RATIOS,
      description: "Aspect ratio. Defaults to 1:1.",
    },
    provider: {
      type: "string",
      description:
        "Force a specific provider id (gemini | openai | huggingface). Omit to auto-select the best configured provider for the job.",
    },
    model: { type: "string", description: "Optional provider-specific model override." },
    editImage: {
      type: "string",
      description: "Path to an existing image to edit instead of generating from scratch.",
    },
    references: {
      type: "array",
      items: { type: "string" },
      description: "Paths to reference images that steer style/subject consistency.",
    },
    style: {
      type: "string",
      description: "Path to a .md style template containing a '## Prompt Template' code block.",
    },
    enhance: {
      type: "boolean",
      description: "Apply deterministic prompt enhancement (quality/clarity boosters).",
    },
    count: {
      type: "integer",
      minimum: 1,
      maximum: 4,
      description: "Number of variations to generate (1-4).",
    },
    gallery: {
      type: "boolean",
      description: "Write/refresh an HTML gallery + history manifest in the output directory.",
    },
  },
  required: ["prompt"],
  additionalProperties: false,
} as const;

export const createAssetOutputSchema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    filePath: { type: "string" },
    provider: { type: "string" },
    model: { type: "string" },
    aspectRatio: { type: "string" },
    error: { type: "string" },
    warnings: { type: "array", items: { type: "string" } },
    galleryPath: { type: "string" },
  },
  required: ["success"],
  additionalProperties: true,
} as const;
