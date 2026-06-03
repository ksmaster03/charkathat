<p align="center">
  <img src="assets/banner.svg" alt="charkathat — multi-provider AI image generation for Claude" width="100%">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-7c3aed?style=flat-square" alt="MIT License">
  <img src="https://img.shields.io/badge/node-%E2%89%A5%2018-06b6d4?style=flat-square" alt="Node 18+">
  <img src="https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Claude-Skill%20%2B%20CLI%20%2B%20MCP-2dd4bf?style=flat-square" alt="Skill + CLI + MCP">
  <img src="https://img.shields.io/badge/providers-3-a78bfa?style=flat-square" alt="3 providers">
</p>

<p align="center">
  <b>English</b>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="README.th.md">ไทย</a>
</p>

<p align="center">
  <b>One interface. The best image model for every job.</b><br>
  charkathat routes each request to the most suitable configured provider and falls back automatically if one fails —<br>
  so you simply describe what you want and get a finished image.
</p>

---

## Overview

charkathat is an image-generation toolkit for Claude that ships in two forms from a single codebase: a **Skill** that drives a bundled **CLI**, and an optional **MCP server**. It speaks to multiple image backends — Google Gemini, OpenAI, and HuggingFace FLUX — through one capability-aware layer, so Claude can pick the right model for the task instead of being locked to a single provider.

It is designed to disappear into your workflow. When Claude is building a landing page, a slide deck, or an app icon and needs an image, the Skill detects the need, crafts a strong prompt, selects an aspect ratio and provider, and produces the asset in the right place — no manual tool wrangling.

## Capabilities

| Capability | What it does |
|------------|--------------|
| **Automatic provider selection** | A capability matrix scores every configured provider against the job (editing, references, typography, speed, cost) and routes to the best match. |
| **Resilient fallback** | If a provider errors, times out, or rate-limits, the request transparently retries on the next provider in the chain. |
| **Image editing** | Modify an existing image from a text instruction, with optional reference images to preserve style. |
| **Reference images** | Pass up to 13 references to keep a consistent look across an entire set (Gemini multimodal). |
| **Style presets & templates** | Reusable Markdown prompt templates (`hero`, `logo`, `thumbnail`, `icon`, or your own) with a `{subject}` slot for brand consistency. |
| **Prompt enhancement** | Claude refines prompts inside the Skill; a deterministic `--enhance` adds quality boosters for direct CLI/MCP calls. |
| **Batch & gallery** | Generate several variations at once and get a self-contained HTML gallery plus a `history.json` manifest of every prompt, provider, and model. |
| **Single-file distribution** | esbuild produces one bundled file per entry point — nothing to install on the user's machine. |

## Architecture

<p align="center">
  <img src="assets/architecture.svg" alt="charkathat architecture: Claude reaches the provider registry through either the Skill/CLI path or the MCP server; the registry selects a provider with automatic fallback." width="100%">
</p>

Both entry points — the bundled CLI and the MCP server — share one core. The CLI is the Skill's default path because it avoids MCP protocol overhead; the MCP server exists for non-skill clients.

**On naming.** The MCP server is called `creative-pipeline` and its tool `create_asset`, deliberately abstract. When a tool's name matches intent too literally (for example `generate_image`), assistants tend to call it directly and bypass the Skill — losing the Skill's prompt-crafting, aspect-ratio choice, and provider selection. A generic name keeps the Skill the obvious choice for visual work, while the underlying tool stays available when it is genuinely needed.

## Installation

In Claude Code:

```
/plugin marketplace add ksmaster03/charkathat
/plugin install charkathat@charkathat
```

Then configure at least one provider key:

```bash
mkdir -p ~/.config/charkathat
echo "GEMINI_API_KEY=your_key_here" > ~/.config/charkathat/.env
```

| Variable | Provider | Notes | Get a key |
|----------|----------|-------|-----------|
| `GEMINI_API_KEY` | Google Gemini | Editing + reference images. Recommended. | https://aistudio.google.com/apikey |
| `OPENAI_API_KEY` | OpenAI (gpt-image-1) | Strong typography / logos. | https://platform.openai.com/api-keys |
| `HF_TOKEN` | HuggingFace (FLUX.1-schnell) | Free, fast drafts. | https://huggingface.co/settings/tokens |

Run `charkathat --list-providers` to confirm which backends are active.

## CLI usage

Every call prints a single JSON line on stdout, e.g. `{"success":true,"filePath":"...","provider":"gemini","aspectRatio":"16:9"}`.

```bash
# basic generation
charkathat -p "a red fox in fresh snow, cinematic lighting" -a 16:9 -o hero.png

# force a provider (usually unnecessary — auto-selection is good)
charkathat -p "logo with the text ACME" --provider openai

# edit an existing image
charkathat -p "change the background to a warm sunset" --edit photo.png

# keep a consistent style with reference images
charkathat -p "a matching coffee-cup icon" --ref icon1.png --ref icon2.png -o coffee.png

# apply a style preset
charkathat -p "a rocket ship" \
  --style skills/visual-creation/references/presets/icon.md

# four variations + an HTML gallery
charkathat -p "modern budgeting app icon" -n 4 --gallery

# inspect configured providers and their capabilities
charkathat --list-providers
```

| Flag | Purpose |
|------|---------|
| `-p, --prompt` | Image description (required) |
| `-o, --output` | Output path (relative paths resolve against `--cwd` / the project root) |
| `-a, --aspect-ratio` | `1:1 16:9 9:16 4:3 3:4 4:5 5:4 3:2 2:3 21:9` (default `1:1`) |
| `--provider` | Force `gemini` \| `openai` \| `huggingface` |
| `--edit <path>` | Edit an existing image |
| `--ref <path>` | Reference image (repeatable) |
| `-s, --style <file>` | Apply a Markdown style template |
| `--enhance` | Add deterministic quality boosters |
| `-n, --count <1-4>` | Number of variations |
| `--gallery` | Write/refresh the HTML gallery + history |

## Provider selection

charkathat auto-selects the best **configured** provider per job; override only when a job clearly favours one.

| Provider | Edit | References | Cost | Speed | Best at |
|----------|:----:|:----------:|:----:|:-----:|---------|
| Google Gemini | Yes | Up to 13 | Standard | Medium | Editing, reference consistency, photoreal, art |
| OpenAI (gpt-image-1) | Yes | Up to 4 | Standard | Medium | Typography, text in images, logos |
| HuggingFace (FLUX.1-schnell) | No | No | Free | Fast | Fast drafts, cheap iterations |

The full matrix and override guidance live in [`skills/visual-creation/references/provider-guide.md`](skills/visual-creation/references/provider-guide.md).

## Build from source

```bash
cd core
npm install
npm run build      # typecheck, then bundle cli.bundle.js and mcp.bundle.js
```

Run the standalone CLI directly:

```bash
GEMINI_API_KEY=... node core/build/cli.bundle.js \
  --prompt "Landing page hero for a fintech startup" --aspect-ratio 16:9
```

## Project structure

```
charkathat/
├── assets/                    Banner and architecture graphics
├── .claude-plugin/            Plugin + marketplace manifests
├── core/                      TypeScript core, shared by CLI and MCP
│   ├── src/
│   │   ├── providers/         base · gemini · openai · huggingface · registry
│   │   ├── pipeline/          generate · edit · enhance · presets · gallery
│   │   ├── config · storage · schemas · logger · types
│   │   ├── cli.ts             CLI entry  → build/cli.bundle.js
│   │   └── mcp.ts             MCP entry  → build/mcp.bundle.js
│   └── build/                 Bundled, ready-to-run outputs
└── skills/visual-creation/
    ├── SKILL.md
    └── references/            prompt-crafting · provider-guide · presets/
```

## Roadmap

- Live verification of generation, editing, and batch paths with provider keys
- Additional providers: BFL FLUX2, Ideogram (typography), Recraft (vector)
- `.mcpb` extension packaging for Claude Desktop
- Example gallery and reproducible smoke-test script

## Credits

The design distills lessons from several open image plugins: the abstract-naming
insight (guinacio/claude-image-gen), multi-provider routing (shipdeckai/image-gen),
the edit / reference / style-template patterns (ypfaff/google-image-gen-plugin),
and the lean FastMCP FLUX approach (TaricaTarica/flux-image-generator-mcp).

## License

Released under the [MIT License](LICENSE).
