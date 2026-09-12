# Four-Project Visual Identity System

Status: **IMPLEMENTED — brand system source of truth**

## Master direction

The four products share one design language: **intelligent systems, operational clarity, measurable outcomes**.

Common principles:
- Dark-first executive UI with high-contrast surfaces.
- One geometric signal mark used consistently across products.
- Space Grotesk for product/display English.
- IBM Plex Sans Arabic for Arabic UI and content.
- 12px–24px radius scale; restrained shadows; thin borders.
- Accent gradients are reserved for hero moments, active states, and key metrics.
- No decorative stock imagery in product UI.

## Master tokens

| Token | Value | Use |
|---|---|---|
| Ink | `#0B1020` | primary dark surface/text |
| Deep | `#111827` | elevated dark surface |
| Cloud | `#F6F7FB` | light surface |
| White | `#FFFFFF` | high-contrast text/surface |
| Indigo | `#5B5CF6` | master action/accent |
| Mint | `#19C7A3` | success/growth signal |
| Cyan | `#22D3EE` | system/intelligence signal |
| Amber | `#F4B942` | attention/insight |
| Coral | `#FB7185` | risk/error |

## Product identities

### 1. ZA Media — Growth Intelligence

**Position:** AI growth engine for lead generation, qualification, marketing automation, and revenue visibility.

- Primary: `#5B5CF6` Electric Indigo
- Secondary: `#19C7A3` Growth Mint
- Signal: `#22D3EE` Intelligence Cyan
- Visual language: data grids, trajectories, pipeline nodes, directional arrows.
- Tone: sharp, analytical, confident.

### 2. ZE Outsourcing — Revenue Operations

**Position:** AI operations and voice automation for revenue teams.

- Primary: `#22D3EE` Signal Cyan
- Secondary: `#5B5CF6` Electric Indigo
- Signal: `#19C7A3` Automation Mint
- Visual language: connected nodes, call paths, operational flows.
- Tone: reliable, technical, execution-focused.

### 3. Rizqha — AI Life & Opportunity OS

**Position:** bilingual AI operating system for moms: productivity, income, skills, career, and support.

- Primary: `#8B5CF6` Orchid Violet
- Secondary: `#FB7185` Warm Coral
- Signal: `#19C7A3` Renewal Mint
- Visual language: soft modular cards, progress arcs, connected personal systems.
- Tone: intelligent, warm, empowering — never childish.

### 4. JARVIS / AI COO — Executive Intelligence

**Position:** personal AI operating system / second hand for planning, memory, tools, execution, and verification.

- Primary: `#7C3AED` Executive Violet
- Secondary: `#22D3EE` System Cyan
- Signal: `#5B5CF6` Cognitive Indigo
- Visual language: command surfaces, state machines, evidence chains, orchestration graphs.
- Tone: precise, calm, executive, high-trust.

## Logo rule

Use a simple geometric monogram/mark rather than literal mascots. The mark should remain legible at 16px and work in monochrome. Product accent color differentiates the four brands; the shared geometry communicates that they belong to the same builder ecosystem.

## Typography

- English display: **Space Grotesk 600–700**
- English/UI: **DM Sans 400–700**
- Arabic: **IBM Plex Sans Arabic 400–700**

## UI rules

- Primary CTA uses the product primary color.
- Success states use Mint; warnings use Amber; destructive states use Coral.
- Avoid more than two accent colors in a single component.
- Charts should emphasize one primary series and use neutral gridlines.
- Use sentence case for UI labels.
- Use consistent 4px spacing increments.

## Asset map

`public/brand/` contains the canonical lightweight SVG marks for all four products. These are the starting assets for favicon, social cards, portfolio cards, and product navigation.

## Implementation order

1. Establish master tokens and typography in ZA Media.
2. Apply ZA Media product identity to landing/dashboard surfaces.
3. Reuse the token system and product-specific accents across ZE Outsourcing, Rizqha, and JARVIS.
4. Generate final social/portfolio mockups only after the four product marks are stable.
