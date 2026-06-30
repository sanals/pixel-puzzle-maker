# Phase 5: Advanced True Multi-Color Printing (AMS/MMU)

## Objective
True AMS/MMU multi-color printing (single fused mesh, embedded per-instance color) is explicitly deferred to this phase. Early phases support multi-color output strictly via separate single-color batch files or by instructing users to snap on official LEGO pieces. Phase 5 will introduce deep MMU integration, climaxing with **Full-Spectrum CMY Blending** to generate millions of colors from just a few spools.

## Key Deliverables
- **Multi-Material 3MF Export:** A single 3MF file with embedded per-instance/per-vertex color assignments designed directly for Bambu AMS or Prusa MMU workflows.
- **Full-Spectrum CMY Blending (Lithophanes Only):** Integrate logic inspired by projects like `3DRev/Primed3D` to calculate exact filament mixing ratios of Cyan, Magenta, and Yellow (CMY) to dynamically generate millions of true-color pixels via halftone Z-layer dithering. 
  - *Architectural Scope:* This technique relies on optical blending of Z-layers viewed transversally. Therefore, it is strictly scoped to **Lithophanes**, where light passes *through* the layer stack. It is mathematically incompatible with flat, top-down Mosaics, which will remain exclusively on the Phase 1 BOM/Batch architecture.
  - *Slicer Constraints:* The dithered export requires the user to manually match an exact layer height in their slicer (e.g., 0.08mm or 0.06mm). The UI must prominently surface this hard requirement before exporting the 3MF.
  - *Implementation Strategy:* Generating the geometry is only half the battle; users need to visualize the optical blend *before* printing. We will evaluate embedding/adapting two specific open-source tools to build this feature without starting from scratch:
    - `3DRev/Primed3D` (Apache-2.0) for the underlying CMY 3MF export and photo-projection logic.
    - `zalo/full-spectrum` (MIT) for the WebGL browser simulation, allowing users to preview the exact Z-layer halftone blending effect in real-time.
- **LDraw Multi-Color Mapping:** If the LDraw instructional generator (Phase 4) is utilized in conjunction with full multi-color parts, this phase will implement the canonical numeric color-code mapping back to LDraw's palette.
- **Support Generation / Painting Tools:** Web-based brush tools to explicitly paint multi-color support interfaces onto generated geometries prior to export.

## Legal & Licensing Checklist (Phase 5)
- **Patent Review:** Conduct a technique-level patent review around Z-layer CMY halftone dithering. Given community murmurs regarding patent claims on this specific mechanical blending technique, verify the risk before rolling out the Lithophane CMY generator.
