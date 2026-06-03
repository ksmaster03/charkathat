#!/usr/bin/env node
/**
 * charkathat CLI — the path the Skill uses (no MCP overhead).
 *
 * Emits a single JSON object on stdout so callers (the Skill, scripts) can parse
 * the result deterministically. All human/diagnostic output goes to stderr.
 *
 * Usage:
 *   charkathat -p "a red fox in snow" -a 16:9 -o hero.png
 *   charkathat -p "gear icon" --style styles/blue-glass.md --enhance
 *   charkathat -p "make the sky purple" --edit input.png --ref style.png
 *   charkathat -p "app icon" -n 4 --gallery
 *   charkathat --list-providers
 */

import { createRuntimeConfig } from "./config.js";
import { createLogger, formatError } from "./logger.js";
import { Pipeline } from "./pipeline/generate.js";
import { describeProvider } from "./providers/registry.js";
import { createAssetArgsSchema } from "./schemas.js";
import { ALL_ASPECT_RATIOS } from "./types.js";

interface ParsedFlags {
  prompt?: string;
  output?: string;
  aspectRatio?: string;
  provider?: string;
  model?: string;
  edit?: string;
  refs: string[];
  style?: string;
  enhance: boolean;
  count?: number;
  gallery: boolean;
  outputDir?: string;
  cwd?: string;
  listProviders: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): ParsedFlags {
  const flags: ParsedFlags = {
    refs: [],
    enhance: false,
    gallery: false,
    listProviders: false,
    help: false,
  };
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case "--prompt":
      case "-p":
        flags.prompt = next();
        break;
      case "--output":
      case "-o":
        flags.output = next();
        break;
      case "--aspect-ratio":
      case "-a":
        flags.aspectRatio = next();
        break;
      case "--provider":
        flags.provider = next();
        break;
      case "--model":
      case "-m":
        flags.model = next();
        break;
      case "--edit":
        flags.edit = next();
        break;
      case "--ref":
      case "--reference":
        flags.refs.push(next());
        break;
      case "--style":
      case "-s":
        flags.style = next();
        break;
      case "--enhance":
        flags.enhance = true;
        break;
      case "--count":
      case "-n":
        flags.count = Number.parseInt(next(), 10);
        break;
      case "--gallery":
        flags.gallery = true;
        break;
      case "--output-dir":
      case "-d":
        flags.outputDir = next();
        break;
      case "--cwd":
        flags.cwd = next();
        break;
      case "--list-providers":
        flags.listProviders = true;
        break;
      case "--help":
      case "-h":
        flags.help = true;
        break;
      default:
        if (!arg.startsWith("-")) positional.push(arg);
    }
  }

  // Allow the prompt as the first positional argument.
  if (!flags.prompt && positional.length > 0) flags.prompt = positional[0];
  return flags;
}

const HELP = `charkathat — multi-provider AI image generation

Usage:
  charkathat -p "<prompt>" [options]

Options:
  -p, --prompt <text>        Image description (required; or first positional arg)
  -o, --output <path>        Output file path (relative to --cwd / project root)
  -a, --aspect-ratio <r>     ${ALL_ASPECT_RATIOS.join(" | ")}   (default 1:1)
      --provider <id>        Force provider: gemini | openai | huggingface
  -m, --model <name>         Provider-specific model override
      --edit <path>          Edit an existing image instead of generating
      --ref <path>           Reference image (repeatable) for style/subject
  -s, --style <path.md>      Style template with a "## Prompt Template" block
      --enhance              Apply deterministic prompt enhancement
  -n, --count <1-4>          Number of variations (writes a gallery)
      --gallery              Write/refresh the HTML gallery + history
  -d, --output-dir <dir>     Override output directory
      --cwd <dir>            Resolve relative paths against this directory
      --list-providers       Show configured providers and capabilities
  -h, --help                 Show this help

Output: a single JSON object on stdout, e.g. {"success":true,"filePath":"..."}`;

function print(obj: unknown): void {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

async function main(): Promise<number> {
  const flags = parseArgs(process.argv.slice(2));

  if (flags.help) {
    process.stderr.write(`${HELP}\n`);
    return 0;
  }

  const config = createRuntimeConfig();
  if (flags.outputDir) config.outputDirectory = flags.outputDir;
  const logger = createLogger("cli", config.logLevel);
  const baseDir = flags.cwd || process.cwd();
  const pipeline = new Pipeline(config, logger, baseDir);

  if (flags.listProviders) {
    const lines = pipeline
      .getRegistry()
      .all()
      .map(describeProvider);
    process.stderr.write(`Providers (✓ = configured):\n${lines.join("\n")}\n`);
    print({
      success: true,
      providers: pipeline
        .getRegistry()
        .all()
        .map((p) => ({ id: p.id, configured: p.isConfigured(), capabilities: p.capabilities })),
    });
    return 0;
  }

  if (!flags.prompt) {
    print({ success: false, error: "Missing --prompt. Run --help for usage." });
    return 1;
  }

  const parsed = createAssetArgsSchema.safeParse({
    prompt: flags.prompt,
    outputPath: flags.output,
    aspectRatio: flags.aspectRatio,
    provider: flags.provider,
    model: flags.model,
    editImage: flags.edit,
    references: flags.refs.length ? flags.refs : undefined,
    style: flags.style,
    enhance: flags.enhance || undefined,
    count: flags.count,
    gallery: flags.gallery || undefined,
  });

  if (!parsed.success) {
    print({ success: false, error: parsed.error.issues.map((x) => x.message).join("; ") });
    return 1;
  }

  try {
    const result = await pipeline.run(parsed.data);
    print(result);
    return result.success ? 0 : 1;
  } catch (error) {
    print({ success: false, error: formatError(error) });
    return 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    print({ success: false, error: formatError(error) });
    process.exit(1);
  });
