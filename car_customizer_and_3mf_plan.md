# 3D Customizer Architecture & 3MF Multi-Plate Implementation Plan

This plan is divided into two major sections:
1. **The Car Builder Web App**: A completely new architecture based on lessons learned from the Pixel Puzzle Maker.
2. **The Pixel Puzzle Maker 3MF Upgrade**: Step-by-step plan to integrate multi-plate, pre-colored 3MF exports into our current app.

---

## Part 1: The Car Builder Web App Architecture

### Lessons Learned to Avoid Past Mistakes
Based on our `DEVELOPMENT_HISTORY.md` and `v0_migration_and_updates.md`, we must strictly avoid the following pitfalls:
1. **Double-Shifting Transforms**: We previously struggled with models shifting out of place because we applied rotations and bounds-centering in the wrong order. 
   *Fix*: Always calculate the exact bounding box and center the STL geometry *before* applying world rotations or offsets.
2. **Procedural Meshes vs CAD**: Procedural meshes often fail at precision. 
   *Fix*: We will strictly use loaded physical CAD files (.stl) for all car parts (chassis, body, spoiler, wheels) to ensure perfect fitment.
3. **CSG Disconnection**: Boolean merging (like text on a base) previously created separate disjointed models if not handled properly.
   *Fix*: `three-bvh-csg` will be used strictly to subtract (deboss) notches or merge parts into a single watertight mesh before export.
4. **UI Thread Blocking**: Heavy 3D calculations froze the browser.
   *Fix*: Heavy boolean operations and 3MF packaging will be offloaded to a Web Worker.

### Core Architecture & Tech Stack
- **Framework:** Next.js 15 (App Router), React 19, TypeScript.
- **3D Engine:** Three.js with `@react-three/fiber` (R3F) for declarative 3D scene management (much easier for interchangeable parts than vanilla Three.js).
- **Boolean Engine:** `three-bvh-csg` for dynamic notches (e.g., cutting a slot for the spoiler).
- **Exporter:** `jszip` and a custom XML generator for 3MF.

### Phased Implementation Plan

#### Phase 1: Environment & UI Shell
- Setup Next.js with Tailwind CSS and shadcn/ui.
- **CRITICAL**: Add `*.stl`, `*.3mf` to `.gitignore` to prevent repository bloat.
- Build the Layout:
  - **Left Panel:** Part selectors (Chassis, Body, Wheels, Spoiler) and Color pickers.
  - **Main Canvas:** Interactive 3D preview.

#### Phase 2: 3D Asset Loading & Assembly Engine
- Load base STL files using `STLLoader`.
- Calculate precise bounding boxes. Set an absolute anchor point (e.g., the rear bumper center) for attaching spoilers.
- Implement `three-bvh-csg`: When a spoiler is selected, subtract its mounting peg geometry from the car body to create a perfect boolean cut in real-time.

#### Phase 3: The 3MF Multi-Plate Manufacturing Export
- When exporting, generate the XML structures for `.3mf`.
- Assign different parts to different extruders (colors) in `Metadata/model_settings.config`.
- Place the Car Body on Plate 1 (`X=0`), Chassis on Plate 2 (`X=250`), Wheels on Plate 3 (`X=500`).
- Package everything using `jszip` and trigger download.

---

## Part 2: Upgrading Pixel Puzzle Maker to 3MF Multi-Plate

We will update our current app to export a single `pixel_puzzle.3mf` file instead of a ZIP of STLs. This will pre-arrange plates and pre-color pixels for Bambu Studio.

### Proposed Changes

#### 1. Add 3MF XML Generators
We need a set of pure TS functions to generate the required Bambu Studio XML templates.
- **[NEW]** `lib/3mf-xml-generators.ts`:
  - `generateModelSettingsConfig(objects)`: Generates `model_settings.config`. We will map object IDs to extruder numbers based on their assigned color.
  - `generateProjectSettings()`: Generates a boilerplate `project_settings.config`.
  - `generateContentTypes()`: Generates `[Content_Types].xml`.
  - `generateRels()`: Generates `_rels/.rels`.

#### 2. Update `exporters.ts`
- **[MODIFY]** `lib/exporters.ts`:
  - Deprecate the current `exportZip` function that creates multiple STLs.
  - Implement `exportMultiPlate3MF(blocks, basePlates, frame)`.
  - **Spatial Layout Logic:**
    - Iterate through all objects.
    - Base Plates go to Plate 1 (Coordinates: `X=0, Y=0`).
    - Frame pieces go to Plate 2 (Coordinates: `X=250, Y=0`).
    - Pixel blocks are grouped. A plate can hold ~200x200mm of blocks. If we exceed that, move to Plate 4 (`X=750`), etc.
  - Build the `3D/3dmodel.model` XML:
    - Insert all geometries.
    - Create `<build><item>` tags, applying the calculated `X` translation matrices.
  - Build the ZIP archive in-memory and trigger the `.3mf` download.

#### 3. UI Updates
- **[MODIFY]** `components/control-panel.tsx`:
  - Change the export button from "Export separated STLs" to "Export Smart 3MF (Pre-Colored & Arranged)".

## User Review Required
> [!IMPORTANT]
> - Do you want to proceed with updating the **Pixel Puzzle Maker** right now, or should we initialize the **Car Builder Web App** project first?
> - For the Pixel Puzzle Maker, should we completely remove the ZIP/STL export option, or leave it as a "Legacy Export" option for non-Bambu printers?

## Verification Plan
1. Update `exporters.ts` with the new 3MF packaging logic.
2. Generate a test puzzle in the app and click Export.
3. Manually open the resulting `.3mf` file in Bambu Studio.
4. Verify:
   - All objects appear.
   - Objects are physically separated onto different distinct plates.
   - Pixel blocks are correctly assigned to Extruders 1, 2, 3, etc., resulting in correct colors.
