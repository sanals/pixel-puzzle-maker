# Phase 4: Tabletop RPG & Strategy Tools

## Objective
Target the massive tabletop gaming community (D&D, Warhammer, Board Games). We will create specialized 3D printable components (Section 4 of LEGO_IDEAS) that utilize the LEGO system's modularity to build dynamic maps, game aides, and organizers that can be rapidly disassembled.

## Core Features & Generators

### 1. The Hex Terrain Matrix (Settlers / Battletech)
- **Concept:** Standard board game hexes (like Settlers of Catan) are not compatible with square LEGO plates.
- **Generator:** A tool where users define the radius of a hexagon. The engine generates a perfect hex base. It calculates a bounding box, masks a standard 8mm pitch stud array using the hex path (via CSG intersection), and drops perfect studs onto the hex.
- **Result:** Players can snap standard LEGO trees, houses, and minifigures onto their custom 3D printed hex boards.

### 2. D&D Modular Dungeon System
- **Concept:** Snap-together dungeon walls for D&D maps, allowing for massive modular layouts that don't shift when accidentally bumped.
- **Generator:** 
  - Standardized straight and corner wall segments.
  - The bottom features no studs, just flat plates.
  - The *Sides* of the base feature standard Technic pin holes. 
  - We generate simple friction pins (or users can use real LEGO Technic pins) to snap rooms and corridors together horizontally.

### 3. Modular Dice Towers
- **Concept:** Dice towers are fun, but usually static. A LEGO-compatible dice tower lets users theme it differently for every campaign (Sci-Fi one night, Castle the next).
- **Implementation:** 
  - The generator builds a core structural chassis featuring internal angled ramps (baffles).
  - The four exterior walls of the chassis are covered entirely in a grid of standard LEGO studs.
  - Users print the core, then click flat tiles, bricks, and minifigures onto the walls to decorate it.

### 4. Custom Miniature Bases & Dials
- **Concept:** Warhammer and D&D miniatures have standard bases (25mm, 32mm rounds).
- **Implementation:** 
  - Generate round bases with a single central LEGO stud to mount custom builds, or a ring of studs around the edge.
  - Generate 2-part snapping concentric dials (like HeroClix) with numbers to track Health/Mana, using a central Technic axle pin for rotation.

## Open Source Repos to Leverage
- **`LasseD/buildinginstructions.js`:** Reference for step-by-step 3D instructions.

## Agent Execution Instructions for Phase 4
When executing this phase, the AI agent must:
1. **Clone `LasseD/buildinginstructions.js`:** Clone the repo and analyze the source code to understand how it parses LDraw formats and steps through the geometries to render interactive assembly instructions. We will need to adapt this logic for our tabletop generated geometries.
