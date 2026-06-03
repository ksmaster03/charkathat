---
name: visual-creation
description: >
  Generate or edit professional AI images using the best available provider
  (Google Gemini, OpenAI, FLUX). ALWAYS invoke when building websites, landing
  pages, hero sections, slide decks, presentations, marketing material, app
  icons, logos, illustrations, social posts, thumbnails, or any task that needs
  visual content — and IMMEDIATELY when you detect a placeholder or an empty
  visual section. Handles prompt optimization, provider selection, aspect ratio,
  editing, reference images, style templates, and batch variations.
allowed-tools: Bash, Read, Glob
---

# Visual Creation Skill (charkathat)

Generate and edit professional AI images through the bundled `charkathat` CLI.
The CLI auto-selects the best configured provider and falls back if one fails —
your job is to craft a great prompt, pick the right aspect ratio, and (when it
helps) nudge the provider choice.

## When to Invoke

Invoke immediately — don't wait to be asked — when you see:

**Web / app development**
- Hero sections, feature illustrations, empty `<section>`s with no imagery
- Placeholders in code: `placeholder.jpg`, `stock-photo.png`, `url('stock.jpg')`
- App icons, empty-state graphics, onboarding art, error-page visuals

**Presentations & docs**
- Cover images, section dividers, conceptual headers

**Marketing**
- Social posts, ad creative, thumbnails, banners, logos

## Running the CLI

The plugin runs from its own cache directory, so always pass `--cwd` with the
user's project path so output files land in their project, not the plugin cache:

```bash
ORIG_CWD="$(pwd)" && node "${CLAUDE_PLUGIN_ROOT}/core/build/cli.bundle.js" \
  --cwd "$ORIG_CWD" \
  --prompt "<detailed prompt>" \
  --output "assets/hero.png" \
  --aspect-ratio "16:9"
```

The CLI prints a single JSON line on stdout:
```json
{"success": true, "filePath": "/abs/path/assets/hero.png", "provider": "gemini", "model": "...", "aspectRatio": "16:9"}
```
On failure: `{"success": false, "error": "..."}`. Read `filePath` and reference it in the project.

### Key flags

| Flag | Purpose |
|------|---------|
| `-p, --prompt` | Detailed image description (required) |
| `-o, --output` | Output path (relative paths resolve against `--cwd`) |
| `-a, --aspect-ratio` | `1:1 16:9 9:16 4:3 3:4 4:5 5:4 3:2 2:3 21:9` (default `1:1`) |
| `--provider` | Force `gemini` \| `openai` \| `huggingface` (usually omit — let it auto-select) |
| `--edit <path>` | Edit an existing image instead of generating |
| `--ref <path>` | Reference image for style/subject (repeat for several) |
| `-s, --style <file.md>` | Apply a style template (see `references/presets/`) |
| `--enhance` | Add deterministic quality boosters to the prompt |
| `-n, --count <1-4>` | Generate N variations (also writes an HTML gallery) |
| `--gallery` | Write/refresh the gallery + history manifest |

## Choosing the Aspect Ratio

| Ratio | Use for |
|-------|---------|
| `16:9` | Hero images, website headers, presentation slides, YouTube thumbnails |
| `1:1` | Social posts, avatars, app icons, thumbnails |
| `9:16` | Mobile stories, vertical banners, TikTok/Reels |
| `4:3` | Blog headers, general web content |
| `3:2` | Photography-style images |
| `21:9` | Ultrawide / cinematic banners |

## Choosing / Steering the Provider

Usually omit `--provider` — auto-selection matches the job to the best provider.
Override only when the job clearly favours one (see `references/provider-guide.md`):

- **Logos / text in the image / typography** → `--provider openai`
- **Editing or reference-image consistency** → `--provider gemini`
- **Fast drafts / many cheap iterations** → `--provider huggingface`

## Crafting the Prompt

Use the formula: **`[Style] [Subject] [Composition] [Context/Atmosphere]`**

Good example:
```
Minimalist 3D illustration of abstract geometric shapes floating in space,
soft gradient from deep purple to electric blue, subtle glow, modern
professional aesthetic, wide composition for a website header
```

**DO** specify style keywords, color palette, mood, and composition.
**DON'T** use vague prompts ("make it look good") or ignore where the image is used.

See `references/prompt-crafting.md` for advanced techniques.

## Editing & Reference Images

Edit an existing image:
```bash
node "${CLAUDE_PLUGIN_ROOT}/core/build/cli.bundle.js" --cwd "$ORIG_CWD" \
  --prompt "Change the background to a warm sunset sky" \
  --edit "assets/photo.png" --output "assets/photo-sunset.png"
```

Keep a consistent style across a set by passing reference images (up to 13):
```bash
node "${CLAUDE_PLUGIN_ROOT}/core/build/cli.bundle.js" --cwd "$ORIG_CWD" \
  --prompt "A coffee cup icon in the same style" \
  --ref "assets/icon-1.png" --ref "assets/icon-2.png" --output "assets/icon-coffee.png"
```

## Presets / Style Templates

Reusable styles live in `references/presets/` as `.md` files with a
`## Prompt Template` block and a `{subject}` placeholder. Apply one with `--style`:

```bash
node "${CLAUDE_PLUGIN_ROOT}/core/build/cli.bundle.js" --cwd "$ORIG_CWD" \
  --prompt "a rocket ship" \
  --style "${CLAUDE_PLUGIN_ROOT}/skills/visual-creation/references/presets/icon.md" \
  --output "assets/icon-rocket.png"
```

Built-in presets: `hero.md`, `logo.md`, `thumbnail.md`, `icon.md`. Users can add their own.

## Batch & Variations

Generate several options and let the user choose; this also writes an HTML gallery:
```bash
node "${CLAUDE_PLUGIN_ROOT}/core/build/cli.bundle.js" --cwd "$ORIG_CWD" \
  --prompt "modern app icon for a budgeting app" -n 4 --gallery
```

## Workflow

1. **Detect** the visual need (hero, icon, illustration, edit).
2. **Pick** aspect ratio + whether a specific provider helps.
3. **Craft** the prompt with the formula above.
4. **Run** the CLI with `--cwd "$ORIG_CWD"`.
5. **Integrate** the returned `filePath` into the project with correct references.

## First-Time Setup

If the CLI reports no configured provider, tell the user to set at least one key:
```bash
mkdir -p ~/.config/charkathat
echo "GEMINI_API_KEY=your_key_here" > ~/.config/charkathat/.env   # recommended
```
Get a free Gemini key at https://aistudio.google.com/apikey

## Alternative: MCP Tool

If the MCP server is enabled, the same capability is available as the
`create_asset` tool on the `creative-pipeline` server (params: `prompt`,
`outputPath`, `aspectRatio`, `provider`, `editImage`, `references`, `style`,
`enhance`, `count`, `gallery`). Prefer the CLI from this skill — it's faster and
gives you these crafting steps.
