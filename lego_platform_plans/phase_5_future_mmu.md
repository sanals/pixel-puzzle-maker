# Phase 5: Advanced True Multi-Color Printing (AMS/MMU)

## Objective
True AMS/MMU multi-color printing (single fused mesh, embedded per-instance color) is explicitly deferred to this phase. Early phases support multi-color output strictly via separate single-color batch files or by instructing users to snap on official LEGO pieces. Phase 5 will introduce deep MMU integration.

## Key Deliverables
- **Multi-Material 3MF Export:** A single 3MF file with embedded per-instance/per-vertex color assignments designed directly for Bambu AMS or Prusa MMU workflows.
- **LDraw Multi-Color Mapping:** If the LDraw instructional generator (Phase 4) is utilized in conjunction with full multi-color parts, this phase will implement the canonical numeric color-code mapping back to LDraw's palette.
- **Support Generation / Painting Tools:** Web-based brush tools to explicitly paint multi-color support interfaces onto generated geometries prior to export.
