---
name: brand-asset-vectorization
description: Convert user-provided raster brand boards, logos, and app icons into reference-preserving documentation and clean path-based SVG assets using VTracer with preprocessing and overlay QA. Use for logo or brand-asset conversion, not general illustration tracing.
---

# Brand Asset Vectorization

Use this workflow when a raster logo or brand board must become maintainable product assets without redesigning the supplied reference.

## Core distinction

Keep two deliverables separate:

- **Reference board**: preserve the supplied raster as the visual source of truth. A self-contained SVG wrapper is acceptable for documentation when pixel fidelity matters.
- **Product assets**: create clean, scalable SVG paths for logos and app icons. These must not contain `<image>`, embedded bitmap data, external fonts, or scripts.

Never rebuild a reference board with a new layout and call it an exact conversion. Never claim that a clean vector is mathematically identical to a raster when the original vector source is unavailable.

## Workflow

1. Copy the user-provided raster into `reference/` and keep it unchanged.
2. Record the canvas size and define deterministic crop coordinates for each logo, symbol, and icon variant.
3. Produce trace inputs by normalizing the intended palette and collapsing near-white background noise. Keep the untouched crops for comparison.
4. Run [VTracer](https://github.com/visioncortex/vtracer) in spline mode with color clustering, cutout hierarchy, fixed brand palette, speckle filtering, and curve simplification.
5. Inspect the SVG output. Remove tracing artifacts, merge accidental color clusters, and restore small semantic details that raster filtering can erase, such as a waypoint hole.
6. Compose app-icon backgrounds as vector geometry when the source background is ambiguous. Reuse the cleaned wordmark and route instead of tracing each background variant as a separate identity.
7. Render product SVGs at representative sizes, including 1024, 512, 192, 64, 32, and 16px where applicable.
8. Generate three-way comparison boards: reference, clean vector, and 50% overlay. Review both silhouette and semantic readability.
9. Only after visual approval, update brand strategy, `DESIGN.md`, and platform asset guides.

## Quality gates

- Reference board PNG matches the supplied source byte-for-byte when exact preservation is required.
- Product SVGs render successfully through the repository's SVG renderer.
- Product SVGs contain paths or vector primitives and no `<image>`, `data:image`, `font-family`, `@font-face`, or `<script>`.
- The Korean wordmark remains clearly readable as `갈래` at small sizes.
- The route remains continuous and the waypoint retains its center hole.
- Deep Navy `#0D2340`, Coral `#FF6B5C`, and white are intentional flat fills unless the source specification explicitly requires otherwise.
- Comparison metrics are recorded, but visual overlay review is the final acceptance test; raster anti-aliasing can make raw pixel deltas non-zero even for a good clean vector.

## Project reference implementation

For this repository, the maintained implementation is in [`docs/brand/v12/README.md`](../../../docs/brand/v12/README.md). Its deterministic sequence is:

```bash
node docs/brand/v12/extract-reference-assets.js
node docs/brand/v12/prepare-trace-inputs.js
node docs/brand/v12/trace-reference-assets.js
node docs/brand/v12/compose-app-icons.js
node docs/brand/v12/render-reference-board.js
node docs/brand/v12/render-assets.js
node docs/brand/v12/compare-reference-and-vector.js
```

Do not use the legacy `v10` or `v11` reconstruction pipelines as the current source of truth.
