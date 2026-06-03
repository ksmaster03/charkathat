# Prompt Crafting Guide

A strong prompt is the single biggest lever on image quality. Use the formula
and the building blocks below.

## The Formula

```
[Style] [Subject] [Composition] [Context / Atmosphere]
```

- **Style** — medium and aesthetic: `minimalist 3D render`, `flat vector
  illustration`, `cinematic photograph`, `watercolor`, `isometric`, `line art`.
- **Subject** — the main thing, described concretely: `a golden retriever puppy`,
  `abstract geometric shapes`, `a wireless headphone on marble`.
- **Composition** — framing and layout: `wide shot`, `centered`, `rule of
  thirds`, `close-up`, `aerial view`, `negative space on the left for text`.
- **Context / Atmosphere** — lighting, mood, color: `golden hour`, `soft studio
  lighting from the left`, `moody fog`, `warm palette of oranges and reds`.

## Building Blocks

**Lighting:** soft studio lighting · golden hour · dramatic rim light · neon
glow · overcast diffuse light · backlit silhouette.

**Color:** deep purple to electric blue gradient · warm earthy palette ·
monochrome with a single accent · pastel · high-contrast.

**Camera / lens (for photoreal):** shot on 85mm · shallow depth of field ·
macro · wide-angle · bokeh background.

**Mood:** serene · energetic · luxurious · playful · corporate · futuristic.

## Use-Case Recipes

**Hero image (website header)** — `16:9`
```
Minimalist 3D illustration of [concept], soft gradient background, subtle glow,
modern professional aesthetic, wide composition with empty space on the right
for headline text
```

**Product shot** — `1:1` or `3:2`
```
Clean product photography of [product] on [surface], soft studio lighting from
the left, subtle shadows, high-end minimalist aesthetic, centered composition
```

**Blog header** — `4:3` or `16:9`
```
Cinematic [scene] photograph, [time of day] lighting, [color palette], wide
shot, [mood] atmosphere
```

**App / flat illustration** — `1:1`
```
Flat vector illustration of [subject], soft pastel colors, isometric
perspective, clean lines, friendly approachable style, white background
```

**Logo / wordmark** — `1:1` (prefer the OpenAI provider for crisp text)
```
Minimalist logo for [brand], [symbol idea], the text "[BRAND]" in a clean
geometric sans-serif, flat, two-color, on a white background
```

## Tips

- Be specific; vague prompts produce generic images.
- State where the image will be used so composition leaves room for text/UI.
- Lock a palette for brand consistency.
- For a consistent set, generate the first image, then pass it as `--ref` for the rest.
- For text inside the image, keep the words short and quote them explicitly.
