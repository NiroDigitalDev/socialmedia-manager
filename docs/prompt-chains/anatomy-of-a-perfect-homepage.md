# Full Prompt Chain — "Anatomy of a Perfect Homepage"

**Entry ID:** `cmn06lyyc000gykun5cil1sdg`
**Arena ID:** `cmn06ly5h0000ykun0k0je905`
**Round:** 1
**Rating:** up
**Model:** nano-banana-2 (Gemini 3.1 Flash Image Preview)
**Aspect Ratio:** 4:5
**Date:** 2026-03-21

---

## 1. Source Material

The raw source text uploaded to the arena. This is what the AI works from.

```
The CRO Playbook
Conversion Rate Optimization for Shopify Stores
This is a manual to follow, not a book to read. Diagnose what is broken in your Shopify store and fix it in order of priority.
nirodigital.com
Part of the CRO Kit
The CRO Playbook - NiroDigital Page 1

Table of Contents
Introduction
1 Diagnostics (preview)
1.1 Four Root Causes of Low Sales
1.2 The 5 Funnel Numbers
1.3 Cold Audience vs Warm Audience
1.4 Benchmark Table
1.5 Diagnosis Decision Tree
1.6 Two Shopify Reports to Check Weekly
1.7 Weekly Review Routine
1.8 AOV Diagnostics
2 Product Page (preview)
2.1 Above-the-Fold Layout
2.2 Product Images
2.3 Minimum Shot List (5 Images)
2.4 Extended Shot List (8-10 Images)
2.5 Buy Box Elements
2.6 Product Description
2.7 Reviews
2.8 Mobile Product Page Rules
3 Home Page (preview)
3.1 Above-the-Fold
3.2 Section Order
3.3 Email Popup Rules
3.4 Mobile Home Page Rules
3.5 Blog / Journal Section
4 Landing Page (preview)
4.1 When You Need a Landing Page
4.2 Define the One Job of the Page
4.3 Win the First Screen
4.4 Build Desire Below the Fold
4.5 Kill Doubt
4.6 Increase Perceived Value
4.7 Handle Objections
4.8 Close Strong
4.9 Headlines That Convert
4.10 Technical Rules
4.11 Landing Page vs Product Page
5 Shop Page (preview)
5.1 Product Cards
5.2 Sorting and Filters
5.3 Collection Banners
5.4 Mobile Shop Page Rules
6 Cart Drawer (preview)
6.1 Why Cart Drawer, Not Cart Page
6.2 Required Cart Elements
6.3 Free Shipping Threshold
6.4 Cart Upsells
6.5 Mobile Cart Rules
7 Checkout (preview)
7.1 The Rule
7.2 Payment Setup
7.3 What Not to Touch
8 About Us (preview)
8.1 Why It Matters
8.2 Required Elements
8.3 Product-Type Specific Guidance
9 Contact Us (preview)
9.1 Required Elements
9.2 Placement
10 Policy Pages (preview)
10.1 What You Need
10.2 Shipping Policy Essentials
10.3 Returns Policy Essentials
10.4 Privacy Policy and Terms
11 Footer & Navigation (preview)
11.1 Navigation Structure
11.2 Navigation Rules
11.3 Footer Structure
11.4 Mobile Navigation
12 AOV Optimization
12.1 What Is AOV and How to Track It
12.2 Bundles
12.3 Upsells
12.4 Cross-Sells
12.5 Free Shipping Threshold
12.6 Minimum Order Incentives
Glossary

Introduction
Who this is for: Shopify store owners with traffic and no sales. Your conversion rate is below 2%. You do not know what to fix first. This manual tells you exactly what to fix, in what order, and how long each fix takes.

This Is a Manual
This is not a book to read. It is a manual to follow. Every sentence is an instruction or a number. No theory. No padding. No filler.

Core Formula
More Sales = Clarity + Trust - Friction
Every fix in this playbook increases clarity, builds trust, or removes friction.
```

*(Source text continues with full CRO Playbook content — sections on diagnostics, product pages, home pages, landing pages, etc.)*

---

## 2. Style Definition

**Style Name:** Magazine Editorial
**Style ID:** `cmmt29wny000iekhrhzaf0g8h`

```
Magazine editorial layout, high-fashion photography aesthetic, sophisticated grid composition, elegant serif headlines, negative space, luxury publication design
```

---

## 3. Brand Identity

**Brand:** Niro Digital
**Tagline:** "Maximum Effort"
**Palette:** Accent `#f06543` (red) / Background `#171717` (near-black dark)
**Logo:** Attached as reference image

### Brand Context (assembled by `buildBrandContext`)

```
Brand name: Niro Digital (include once at most, never repeat). Brand tagline: "Maximum Effort" (include at most once if relevant). Brand color palette: use red as the accent/highlight color and near-black dark as the background/base color. Apply these colors visually — do NOT write color codes or names as text. A brand logo image is attached — reference its visual style and incorporate it naturally if appropriate. Do NOT distort or heavily modify the logo
```

---

## 4. Outline Generation

### System Prompt — `PROMPTS.outlines(10)`

```
You are an expert Instagram content designer who creates scroll-stopping static posts. Given source material, create 10 structured post outlines.

INSTAGRAM CONTENT PRINCIPLES:
- Less text = more impact. The best posts have 3-8 words as the headline, not a paragraph
- Every post needs a single clear message — one takeaway the viewer remembers
- The headline must stop the scroll — use power words, numbers, or provocative statements
- Supporting text (if any) should be secondary and brief — 1 short sentence max
- White space is your friend — cramped text kills readability on mobile
- Text must be readable at phone screen size (imagine viewing on a 6-inch screen)

CONTENT FORMATS — choose the best format for the source material:
- "headline": Bold statement or hook with optional supporting line (most common)
- "statistic": A striking number or percentage with context
- "quote": An attributed quote with minimal framing
- "tip-list": 3-5 short bullet points or numbered tips
- "how-to": Step-by-step with 2-4 clear steps
- "before-after": Contrast/comparison layout
- "question": Provocative question that drives engagement
- "visual-first": Minimal or no text — the image itself is the content

Each outline should include:
- format: One of the formats above
- overallTheme: The visual and messaging direction in one sentence
- headline: The primary text on the image (punchy, 3-8 words ideal, max 12)
- supportingText: Optional secondary text (1 short sentence max, omit if not needed)
- textPlacement: Where text should sit — "center", "top", "bottom", "left-third", "right-third", "overlay-on-image"
- visualDirection: What the visual/graphic elements should show (not the text — the imagery, shapes, photos, illustrations)

For backwards compatibility, also include a slides array with 1 slide containing title (= headline), description (= supportingText + visualDirection), and optional layoutNotes.

Make each outline a DISTINCT creative interpretation — vary the format, angle, tone, and visual approach.
```

### User Prompt (sent to outline generation)

```
[Full source text from Section 1 above]

Visual style direction: Magazine editorial layout, high-fashion photography aesthetic, sophisticated grid composition, elegant serif headlines, negative space, luxury publication design. Design the outline to work well with this aesthetic.
```

### Outline Output (for this specific entry)

```json
{
  "format": "how-to",
  "overallTheme": "Architectural, editorial deconstruction of a high-converting homepage above the fold.",
  "headline": "Anatomy of a Perfect Homepage",
  "supportingText": "Four elements to win the first 3 seconds.",
  "textPlacement": "right-third",
  "visualDirection": "Elegant, minimalist wireframe of a mobile viewport with delicate lines pointing to the headline, proof, CTA, and hero image, set against a soft, sepia-toned backdrop.",
  "slides": [
    {
      "title": "Anatomy of a Perfect Homepage",
      "description": "Four elements to win the first 3 seconds. Elegant, minimalist wireframe of a mobile viewport with delicate lines pointing to the headline, proof, CTA, and hero image, set against a soft, sepia-toned backdrop.",
      "layoutNotes": "The text anchors the right side, while the left showcases the delicate, blueprint-style mobile wireframe illustration."
    }
  ]
}
```

---

## 5. Image Generation

### System Prompt — `PROMPTS.images`

```
You are an expert visual designer creating Instagram post images that look like they were made by a top creative agency.

DESIGN PRINCIPLES:
- VISUAL HIERARCHY: The headline is the largest, most prominent element. Supporting text is noticeably smaller. The eye should flow: headline → visual → supporting text
- WHITESPACE: Leave generous breathing room around text. Never fill the entire image with content. At least 30% of the image should be empty space or clean background
- MOBILE-FIRST: This will be viewed on a 6-inch phone screen. If text isn't readable at phone size, make it bigger or remove it
- FOCAL POINT: Every image needs one clear visual anchor — where the eye goes first. This is usually the headline or the primary visual element, never both competing
- TEXT-TO-VISUAL BALANCE: Aim for 30% text, 70% visual elements. The image should feel like a designed graphic, not a text document
- COLOR CONTRAST: Text must have strong contrast against its background. Use solid backgrounds, overlays, or text shadows to ensure legibility
- TYPOGRAPHY: Use clean, modern typography. One font family max. Bold for headlines, regular weight for supporting text
- PROFESSIONAL FINISH: The image should look like a published Instagram post from a premium brand — not a mockup, template, or wireframe

CRITICAL RULES:
- NEVER render hex color codes (like #f06543), RGB values, or color names as visible text in the image — use the colors visually instead
- NEVER render variation numbers, slide numbers, or meta-instructions as visible text
- NEVER render Instagram UI elements (hearts, comments, profile bars, notification bars)
- NEVER render the brand name or tagline more than once in the image
- NEVER render more text than specified in the outline — if the outline says "headline only", render ONLY the headline
- ALWAYS make the headline the visually dominant text element
- The image should look like a finished, published Instagram post — not a mockup or wireframe
```

### User Prompt (content prompt — sent alongside system prompt)

```
Visual style: Magazine editorial layout, high-fashion photography aesthetic, sophisticated grid composition, elegant serif headlines, negative space, luxury publication design

Content format: how-to
Theme: Architectural, editorial deconstruction of a high-converting homepage above the fold.
Headline text (render this prominently): "Anatomy of a Perfect Homepage"
Supporting text (render smaller, secondary): "Four elements to win the first 3 seconds."
Text placement: right-third
Visual direction: Elegant, minimalist wireframe of a mobile viewport with delicate lines pointing to the headline, proof, CTA, and hero image, set against a soft, sepia-toned backdrop.

Brand context: Brand name: Niro Digital (include once at most, never repeat). Brand tagline: "Maximum Effort" (include at most once if relevant). Brand color palette: use red as the accent/highlight color and near-black dark as the background/base color. Apply these colors visually — do NOT write color codes or names as text. A brand logo image is attached — reference its visual style and incorporate it naturally if appropriate. Do NOT distort or heavily modify the logo

Create a unique visual interpretation. Use different composition, layout angles, or emphasis — but do NOT write any variation numbers or meta-text in the image.
```

### Reference Images

- Brand logo (Niro Digital) — sent as multimodal image content alongside the text prompt

### Generation Config

- **Model:** `nano-banana-2` → `gemini-3.1-flash-image-preview`
- **Aspect Ratio:** 4:5
- **Provider Options:** `{ google: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "4:5" } } }`

---

## 6. Assembly — How the Prompts Were Combined

```
generateImageFromPrompt(
  prompt = [User Prompt from Section 5],
  modelKey = "nano-banana-2",
  aspectRatio = "4:5",
  referenceImages = [brand logo buffer],
  systemPrompt = [System Prompt from Section 5]
)
```

The function sends a `generateText` call with:
- `system`: The PROMPTS.images system prompt (design principles + critical rules)
- `messages[0].role = "user"`, `content = [logo image part, text prompt part]`
- `providerOptions.google.responseModalities = ["IMAGE"]`

The model returns an image file in `result.files`.

---

## Summary — The Full Chain

```
Source Text (CRO Playbook, ~3000 words)
    │
    ▼
Outline Generation
    System: PROMPTS.outlines(10) — Instagram content design expertise
    User: sourceText + "Visual style direction: Magazine editorial..."
    │
    ▼
Outline Output
    format: "how-to"
    headline: "Anatomy of a Perfect Homepage"
    supportingText: "Four elements to win the first 3 seconds."
    textPlacement: "right-third"
    visualDirection: "Elegant, minimalist wireframe..."
    │
    ▼
Image Generation
    System: PROMPTS.images — design principles + critical rules
    User: style prompt + outline content + brand context
    Reference: brand logo image
    │
    ▼
Generated Image (4:5, uploaded to R2)
```
