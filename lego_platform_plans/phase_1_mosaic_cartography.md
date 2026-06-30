# Phase 1: The Mosaic & Cartography Studio

## Objective
Adapt the 2D pixel processing architecture from `pixel-puzzle-maker_2` and combine it with topographical data logic (inspired by `leifgehrmann/lego-art-map-generator`) to generate complex, data-driven LEGO mosaics and 3D landscapes.

## Core Features & Generators

### 1. The Pro Pixel Art & Portrait Engine
- **Concept:** Translates user uploaded images (JPEGs/PNGs) into 2D studded LEGO baseplates.
- **Enhancements over previous puzzle maker:**
  - **BrickLink Color Mapping:** Instead of arbitrary palettes, we constrain quantization to real-world LEGO filament/brick colors (e.g., standard red, dark bluish grey).
  - **Stud Omission (Background Removal):** If a user hides a color in the palette, the engine skips generating those 1x1 plates, leaving the raw baseplate exposed. This mimics official LEGO Art sets and saves massive amounts of filament.
  - **Mini-Map Engraving:** For massive posters (e.g., 96x96 studs), the engine slices the model into multiple 16x16 plates and automatically engraves coordinates (A1, A2, B1) onto the back using CSG subtraction.

### 2. Topographic & Bathymetric Map Modeler
- **Concept:** Generate stunning 3D stepped landscapes using real-world map data.
- **Integration:** 
  - Allow users to upload grayscale DEM (Digital Elevation Model) or Bathymetric (ocean depth) images.
  - White pixels represent the highest elevation, black pixels the lowest.
- **Parametric Generation:**
  - The script samples the image grid. Instead of color mapping, it maps brightness to *Height*.
  - *Math:* A baseplate is generated. If a pixel is 50% gray, it generates a stack of 5 plates (3.2mm each = 16mm height) at that stud coordinate.
  - Generates a breathtaking 3D physical map that looks incredibly premium when side-lit.

### 3. Soundwave & Lithophane Generators
- **Soundwaves:** Upload an MP3/WAV. The browser uses the Web Audio API to extract a frequency array, normalizing it to a 32x32 stud grid to generate a 3D physical equalizer wave out of standard LEGO bricks.
- **Lithophanes:** Combine thin, translucent standard LEGO backing walls (0.8mm - 2mm thick) with a structural studded frame, allowing users to build lightboxes directly into their LEGO castles or houses.

## Open Source Repos to Leverage
- **`ethantr/lego-mosaic`:** A TypeScript reference for the Pro Pixel Art Engine.
- **`leifgehrmann/lego-art-map-generator`:** A reference for distributing bathymetric colored tiles.

## Agent Execution Instructions for Phase 1
When executing this phase, the AI agent must:
1. **Analyze `ethantr/lego-mosaic`:** Fetch the raw source code and review their image quantization algorithms. Port their logic for mapping pixels to nearest colors and generating the accurate "Piece Count" (Bill of Materials) list.
2. **Analyze `leifgehrmann/lego-art-map-generator`:** Fetch the raw source code. Do not just read the README. Understand the math used to sample grayscale maps and translate those values. We will adapt this data to map to Z-axis heights (stacking 1x1 plates) in our Three.js engine.
