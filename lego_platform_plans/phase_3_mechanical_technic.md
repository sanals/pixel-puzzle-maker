# Phase 3: The Mechanical & Technic Workshop

## Objective
Bridge the gap between static 3D printing and kinetic machinery (Section 3 of LEGO_IDEAS). We will integrate `cfinke/Technic.scad` and `LEGO.scad` to generate custom gears, axles, and motor adapters, enabling hobbyists to build massive motorized setups without buying expensive, rare Technic parts.

## Core Features & Generators

### 1. OpenSCAD WASM Integration
- **Concept:** While native Three.js math is fast, recreating the complex logic of standard Technic gears and pins is tedious. Chris Finke's `Technic.scad` already solved this flawlessly.
- **Implementation:** 
  - We will compile OpenSCAD to WebAssembly (`openscad.wasm`) to run locally in the user's browser.
  - The UI will present Next.js React sliders (e.g., "Gear Teeth Count: 24").
  - **Performance/UX:** To handle WASM compilation times, the UI must implement debouncing on slider inputs, present explicit loading states, and ideally cache precomputed `.scad` strings to geometries.
  - The app dynamically generates a `.scad` text string: `technic_gear(teeth=24);`
  - The WASM engine parses the string, runs the CSG math, and returns an STL/BufferGeometry to the Three.js Canvas for preview and export.
  - **Export Divergence:** Note that this phase bypasses the `InstancedMesh -> 3MF` pipeline used in Phase 0-2, and directly exports STL or merged BufferGeometry from WASM.

### 2. Custom Planetary Gears & Drivetrains
- **Concept:** Hobbyists often need massive gear reductions for robotics.
- **Generator:** A UI that lets users input gear ratios (e.g., 20:1). 
- **Validation:** The generator must include a solvability check to ensure the inputted gear ratio is mathematically achievable with integer tooth counts in a planetary system, auto-correcting to the nearest achievable ratio if not.
- **Output:** It outputs custom ring gears, sun gears, and planetary carriers that accept standard LEGO cross-axles.

### 3. Motor & Servo Adapters (The Game Changer)
- **Concept:** Connecting cheap electronics (Arduino/Raspberry Pi) to LEGO builds.
- **Generators & Tolerance Sourcing:** 
  - Tolerances for these mounts must be explicitly sourced from official mechanical datasheets, not approximated. Small errors render these functional parts useless.
  - **NEMA 17 Stepper Mount:** A heavy, print-optimized block that perfectly aligns with NEMA 17 bolt patterns, converting the chassis into a Technic beam layout.
  - **SG90 Servo to Cross-Axle Adapter:** A tiny generator that takes the standard splined shaft of a micro-servo and outputs a plastic sleeve that perfectly grips a standard LEGO cross-axle.

### 4. Tank Treads & Deep Dish Wheels
- **Concept:** Printing custom rubberized grips or massive custom rim designs that interface with standard hubs.
- **Implementation:** Sliders for tire diameter, width, and tread aggressiveness. Generates a monolithic wheel mesh featuring a standard Technic pin-hole hub for immediate compatibility.

## Agent Execution Instructions for Phase 3
When executing this phase, the AI agent must:
1. **Analyze `cfinke/Technic.scad`:** Clone the repository to a scratch directory, pin to a specific commit hash for deterministic reference, and analyze the raw `.scad` source code to understand how gear teeth involute math and pin holes are implemented.
