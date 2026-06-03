# charkathat

**God-tier, multi-provider AI image generation for Claude.** Generate and edit
images from inside Claude Code (Skill + CLI) or any MCP client — with automatic
provider selection, fallback, reference images, style presets, batch variations,
and a browsable gallery.

> charkathat picks the best image provider for each job and falls back if one
> fails, so you just describe what you want and get an image.

## Features

- 🧠 **Multi-provider with auto-selection + fallback** — Google Gemini, OpenAI
  (gpt-image-1), and HuggingFace FLUX.1-schnell behind one interface. A
  capability matrix routes each job to the best configured provider and retries
  with the next if one errors, times out, or rate-limits.
- ✏️ **Edit + reference images** — modify an existing image, or pass up to 13
  reference images to keep a consistent style across a set (Gemini multimodal).
- 🎨 **Style presets & templates** — reusable `.md` prompt templates
  (`hero`, `logo`, `thumbnail`, `icon`, or your own) with a `{subject}` slot.
- ✨ **Prompt enhancement** — Claude crafts the prompt in the Skill; a
  deterministic `--enhance` adds quality boosters for direct CLI/MCP calls.
- 🖼️ **Batch + gallery** — generate N variations and get an HTML gallery plus a
  `history.json` manifest recording every prompt/provider/model.
- ⚡ **Two execution modes** — the Skill runs a single bundled CLI (no MCP
  overhead); an MCP server is also available for non-skill workflows.
- 📦 **Single-file bundles** — no `npm install` on the user's machine.

## Architecture

```
Skill mode (default):  Claude → Skill → Bash → cli.bundle.js → provider registry → API
MCP mode (optional):   Claude → create_asset (creative-pipeline) → mcp.bundle.js → registry → API
```

The MCP server is named `creative-pipeline` and its tool `create_asset` —
intentionally abstract. When tool names match intent too literally
(`generate_image`), assistants call the tool directly and bypass the Skill,
losing its prompt-crafting and provider/aspect selection. A generic name keeps
the **Skill** the obvious choice for image work.

```
charkathat/
├── .claude-plugin/        # plugin + marketplace manifests
├── core/                  # TypeScript — shared by CLI + MCP
│   ├── src/
│   │   ├── providers/     # base, gemini, openai, huggingface, registry (capability matrix)
│   │   ├── pipeline/      # generate (orchestrator), edit, enhance, presets, gallery
│   │   ├── config.ts  storage.ts  schemas.ts  logger.ts  types.ts
│   │   ├── cli.ts         # CLI entry  → build/cli.bundle.js
│   │   └── mcp.ts         # MCP entry  → build/mcp.bundle.js
│   └── build/             # bundled outputs (committed)
└── skills/visual-creation/
    ├── SKILL.md
    └── references/        # prompt-crafting, provider-guide, presets/
```

## Install (Claude Code)

```
/plugin marketplace add ksmaster03/charkathat
/plugin install charkathat@charkathat
```

Then configure at least one provider key:

```bash
mkdir -p ~/.config/charkathat
echo "GEMINI_API_KEY=your_key_here" > ~/.config/charkathat/.env
```

| Key | Provider | Get it |
|-----|----------|--------|
| `GEMINI_API_KEY` | Google Gemini (edit + references) | https://aistudio.google.com/apikey |
| `OPENAI_API_KEY` | OpenAI (logos / text) | https://platform.openai.com/api-keys |
| `HF_TOKEN` | HuggingFace FLUX (free/fast) | https://huggingface.co/settings/tokens |

## Build from source

```bash
cd core
npm install
npm run build      # typecheck + bundle cli.bundle.js and mcp.bundle.js
```

Use the standalone CLI:

```bash
GEMINI_API_KEY=... node core/build/cli.bundle.js \
  --prompt "Landing page hero for a fintech startup" --aspect-ratio 16:9
```

## CLI usage

```bash
# basic
charkathat -p "a red fox in fresh snow, cinematic" -a 16:9 -o hero.png

# force a provider (usually unnecessary — auto-select is good)
charkathat -p "logo with the text ACME" --provider openai

# edit an existing image + reference for style
charkathat -p "change background to sunset" --edit photo.png
charkathat -p "matching coffee icon" --ref icon1.png --ref icon2.png -o coffee.png

# style preset
charkathat -p "a rocket ship" \
  --style skills/visual-creation/references/presets/icon.md

# 4 variations + gallery
charkathat -p "modern budgeting app icon" -n 4 --gallery

# inspect configured providers
charkathat --list-providers
```

Every call prints one JSON line: `{"success":true,"filePath":"...","provider":"gemini",...}`.

## Providers & selection

See [`skills/visual-creation/references/provider-guide.md`](skills/visual-creation/references/provider-guide.md)
for the full capability matrix and when to override auto-selection.

## Credits & inspiration

Design distilled from studying several open image plugins — the abstract-naming
insight (guinacio/claude-image-gen), multi-provider routing
(shipdeckai/image-gen), edit/reference/style-template patterns
(ypfaff/google-image-gen-plugin), and the lean FastMCP FLUX approach
(TaricaTarica/flux-image-generator-mcp).

## License

MIT
