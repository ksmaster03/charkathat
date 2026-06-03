#!/usr/bin/env node
/**
 * charkathat MCP server.
 *
 * Exposes a single, deliberately abstract tool — `create_asset` on a server
 * named `creative-pipeline`. The abstraction is intentional: when the tool name
 * matches intent too literally ("generate_image"), assistants call it directly
 * and bypass the Skill, losing the Skill's prompt-crafting and provider/aspect
 * selection. A generic name keeps the Skill the obvious choice for image work,
 * while the MCP tool remains available for non-skill workflows.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createRuntimeConfig } from "./config.js";
import { createLogger, formatError } from "./logger.js";
import { Pipeline } from "./pipeline/generate.js";
import {
  createAssetArgsSchema,
  createAssetInputSchema,
  createAssetOutputSchema,
} from "./schemas.js";
import type { AssetResponse } from "./types.js";

const config = createRuntimeConfig();
const logger = createLogger("mcp", config.logLevel);
const pipeline = new Pipeline(config, logger);

function buildText(result: AssetResponse): string {
  if (!result.success) {
    return `Image generation failed: ${result.error ?? "unknown error"}`;
  }
  const lines = [
    "Image created successfully.",
    "",
    `File: ${result.filePath}`,
    `Provider: ${result.provider}`,
    `Model: ${result.model}`,
    `Aspect ratio: ${result.aspectRatio}`,
  ];
  if (result.results && result.results.length > 1) {
    lines.push("", `Variations: ${result.results.length}`);
    for (const r of result.results) lines.push(`  - ${r.filePath} (${r.provider})`);
  }
  if (result.galleryPath) lines.push("", `Gallery: ${result.galleryPath}`);
  if (result.warnings?.length) lines.push("", `Warnings: ${result.warnings.join(" | ")}`);
  return lines.join("\n");
}

const server = new Server(
  { name: "creative-pipeline", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const configured = pipeline.getRegistry().configured().map((p) => p.id);
  return {
    tools: [
      {
        name: "create_asset",
        description:
          `Generate or edit an image with the best available AI provider, save it locally, ` +
          `and return the absolute path. Auto-selects among configured providers ` +
          `(${configured.join(", ") || "none configured"}) with fallback. ` +
          `Supports aspect ratios, reference images, editing, style templates, and batch variations.`,
        inputSchema: createAssetInputSchema,
        outputSchema: createAssetOutputSchema,
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "create_asset") {
    const error = `Unknown tool: ${request.params.name}`;
    return {
      isError: true,
      structuredContent: { success: false, errorCode: "UNKNOWN_TOOL", error },
      content: [{ type: "text", text: error }],
    };
  }

  try {
    const args = createAssetArgsSchema.parse(request.params.arguments);
    const result = await pipeline.run(args);
    return {
      isError: !result.success,
      structuredContent: result,
      content: [{ type: "text", text: buildText(result) }],
    };
  } catch (error) {
    const message = `Error generating image: ${formatError(error)}`;
    logger.warn("Tool execution failed", { error: message });
    return {
      isError: true,
      structuredContent: { success: false, errorCode: "VALIDATION_ERROR", error: message },
      content: [{ type: "text", text: message }],
    };
  }
});

async function main(): Promise<void> {
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", { error: formatError(error) });
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection", { error: formatError(reason) });
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("creative-pipeline MCP server started", {
    outputDirectory: pipeline.getOutputDirectory(),
    configured: pipeline.getRegistry().configured().map((p) => p.id),
  });
}

main().catch((error) => {
  logger.error("Server startup failed", { error: formatError(error) });
  process.exit(1);
});
