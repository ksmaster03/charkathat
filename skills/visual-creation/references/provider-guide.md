# Provider Selection Guide

charkathat auto-selects the best **configured** provider for each job and falls
back to the next if one fails. Override with `--provider <id>` only when the job
clearly favours a specific backend.

## Capability matrix

| Provider | id | Edit | References | Cost | Speed | Best at |
|----------|----|------|-----------|------|-------|---------|
| Google Gemini | `gemini` | ✅ | ✅ (up to 13) | $$ | medium | Editing, reference consistency, multimodal, photoreal, art |
| OpenAI (gpt-image-1) | `openai` | ✅ | ✅ (up to 4) | $$ | medium | Typography / text-in-image, logos, general purpose |
| HuggingFace (FLUX.1-schnell) | `huggingface` | ❌ | ❌ | free | fast | Fast drafts, cheap iterations, art/photoreal |

## How auto-selection works

The registry scores each configured provider against the job:

- Hard requirements first: editing needs a provider with `edit`; reference
  images need `referenceImages`; the aspect ratio must be supported.
- Then soft scoring: typography → OpenAI; edit/reference → Gemini (multimodal);
  `--enhance`-style speed/cost preferences favour HuggingFace.
- A mild quality bias breaks ties toward higher-tier models.

## When to override

| Job | Use |
|-----|-----|
| Logo, poster, anything with **readable text** | `--provider openai` |
| **Editing** an existing image | `--provider gemini` (only one that edits well with refs) |
| Keeping a **consistent style** via reference images | `--provider gemini` |
| **Fast, free** drafts / many quick iterations | `--provider huggingface` |
| Highest general quality, no special needs | omit — let auto-select decide |

## Configuration

A provider is "configured" when its key is present (process env or
`~/.config/charkathat/.env`):

```bash
GEMINI_API_KEY=...     # or GOOGLE_AI_API_KEY  — https://aistudio.google.com/apikey
OPENAI_API_KEY=...     # https://platform.openai.com/api-keys
HF_TOKEN=...           # https://huggingface.co/settings/tokens (free)
```

Run `charkathat --list-providers` to see which are active.
