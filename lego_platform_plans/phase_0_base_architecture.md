# Phase 0: Base Architecture & Infrastructure

## Objective
Establish a clean, scalable, and modular foundation for the Parametric LEGO Platform. We want to start simple by integrating existing public repositories and proven internal tools (like those from `pixel-puzzle-maker_2`), ensuring that all subsequent phases are built on a rock-solid, performant 3D engine.

## Core Technology Stack
- **Framework:** Next.js (App Router) for routing and API endpoints.
- **Styling:** TailwindCSS for a premium, responsive UI.
- **3D Visualization:** `Three.js` wrapped in `react-three-fiber` (R3F) and `@react-three/drei`.
- **State Management:** `zustand` to manage complex parametric states across the different tool suites.
- **Geometry Operations:** 
  - Use `three-bvh-csg` for fast native boolean operations (adding studs, subtracting holes). It is faster and better maintained for real-time use.
- **Exporting:** `jszip` and our proven `generic-3mf-exporter.ts` to compress massive arrays of studs into lightweight 3MF files.
- **State Management & Persistence:** Design `zustand` stores with local storage persistence (`.json` project saves) and built-in undo/redo capability from the start.
- **Units:** The canonical internal unit is `mm`. A standard stud pitch is defined as exactly `8.0mm`. (Stud diameter `4.8mm` sourced from official LEGO tolerances). All generators must conform to this internal scale.

## Deliverables for Phase 0

### 1. The Global 3D Viewer & UI Shell
- Set up a master Layout that features a sidebar for controls (Parametric Sliders, Uploads) and a main `Canvas` for the 3D view.
- Implement standard R3F controls: `OrbitControls`, `GridHelper`, and lighting (`AmbientLight`, `DirectionalLight` with shadows).

### 2. The Typed "Printer Tolerance" System
- **Concept:** Every FDM printer extrudes slightly differently. LEGO requires micrometer precision to snap fit. Instead of a single global scalar, the tolerance system must be strongly typed (e.g., `snapFit`, `slidingFit`, `pressFit`).
- **Implementation:** A global state slider for `snapFit` (e.g., `-0.2mm` to `+0.2mm`) that propagates to geometry generators.
- *Math & Verification:* Standard LEGO stud diameter is `4.8mm`. We compensate for over-extrusion by shrinking studs and expanding holes. The sign convention must be explicitly verified with a real print test before baking it into the generators.

### 3. Native Three.js Primitive Engine (The Baseplate)
- Before touching OpenSCAD, we will build a pure JS parameterized Baseplate generator.
- **Why?** It's highly performant. A baseplate is just a `BoxGeometry` (the base) merged with an array of `CylinderGeometry` (the studs).
- **Data Structure:** Design a generic "instance + per-element transform/scale" data structure (not just uniform `InstancedMesh`), along with an explicit "bake instances to merged `BufferGeometry`" step. This is required for Phase 1's non-uniform topographic stacking and CSG subtractions.
- **Features:** Sliders for `Width (studs)` and `Length (studs)`. Generates the precise 3D mesh instantly using this non-uniform instancing model for rendering and merging for export.

### 4. 3MF Export Integration & Geometry Validation
- **Export Pipeline:** Hook up the `generic-3mf-exporter.ts` from `pixel-puzzle-maker_2`. Verify and adapt the exporter explicitly so it supports the new "bake instances to merged `BufferGeometry`" data structure.
- **Validation Script:** Create a testing script that loads the exported geometry and mathematically asserts the final dimensions (stud diameter, tube diameter, height) against expected values. This ensures tolerance math is caught in CI, not at the 3D printer.

## Leveraging Existing Code & External Repositories
- **From internal:** Bring over the image quantization/palette code and manual raycast "Paint Tool" from `pixel-puzzle-maker_2`.

## Agent Execution Instructions for Phase 0
Since this phase may be executed in a fresh session, the AI agent must follow these explicit research steps BEFORE writing any geometry or UI code:
1. **Clone `bhushan6/lego-builder`:** Use terminal tools to clone this repository to a scratch directory. Traverse the source code to see how they handle React-Three-Fiber grid snapping, camera controls, and state management. Pin to a specific commit hash for deterministic reference.
2. **Analyze `cfinke/LEGO.scad`:** Fetch the raw `LEGO.scad` source file and pin the commit. **Read the actual code.** Specifically, find the mathematical formulas for the `block_bottom_type` and anti-stud tubes (the cylinders on the underside of a brick). Port these exact mathematical tolerances into our `Three.js` generator so our parts are snap-fit compatible with 3D printers.
3. **Internal Review:** View `pixel-puzzle-maker_2`'s `generic-3mf-exporter.ts` to understand how the new baseplate's InstancedMesh data needs to be structured and merged for export.
4. **Tolerance Validation:** Implement a small validation script that verifies the exported geometry's `snapFit` dimensions match expected targets after compensation.
