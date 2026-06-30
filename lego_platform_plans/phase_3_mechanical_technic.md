# Phase 3: The Mechanical & Technic Workshop

## Objective
Bridge the gap between static 3D printing and kinetic machinery (Section 3 of LEGO_IDEAS). We will integrate `cfinke/Technic.scad` and `LEGO.scad` to generate custom gears, axles, and motor adapters, enabling hobbyists to build massive motorized setups without buying expensive, rare Technic parts.

## Core Features & Generators

### 1. OpenSCAD WASM Integration
- **Concept:** While native Three.js math is fast, recreating the complex logic of standard Technic gears and pins is tedious. Chris Finke's `Technic.scad` already solved this flawlessly.
- **Implementation:** 
  - We will compile OpenSCAD to WebAssembly (`openscad.wasm`) to run locally in the user's browser.
  - The UI will present Next.js React sliders (e.g., "Gear Teeth Count: 24").
  - The app dynamically generates a `.scad` text string: `technic_gear(teeth=24);`
  - The WASM engine parses the string, runs the CSG math, and returns an STL/BufferGeometry to the Three.js Canvas for preview and export.

### 2. Custom Planetary Gears & Drivetrains
- **Concept:** Hobbyists often need massive gear reductions for robotics.
- **Generator:** A UI that lets users input gear ratios (e.g., 20:1). It outputs custom ring gears, sun gears, and planetary carriers that accept standard LEGO cross-axles.

### 3. Motor & Servo Adapters (The Game Changer)
- **Concept:** Connecting cheap electronics (Arduino/Raspberry Pi) to LEGO builds.
- **Generators:**
  - **NEMA 17 Stepper Mount:** A heavy, print-optimized block that perfectly aligns with NEMA 17 bolt patterns, converting the chassis into a Technic beam layout.
  - **SG90 Servo to Cross-Axle Adapter:** A tiny generator that takes the standard splined shaft of a micro-servo and outputs a plastic sleeve that perfectly grips a standard LEGO cross-axle.

### 4. Tank Treads & Deep Dish Wheels
- **Concept:** Printing custom rubberized grips or massive custom rim designs that interface with standard hubs.
- **Implementation:** Sliders for tire diameter, width, and tread aggressiveness. Generates a monolithic wheel mesh featuring a standard Technic pin-hole hub for immediate compatibility.
