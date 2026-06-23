# Stained Glass Pet Portrait Maker - Deep Technical Implementation Plan

This is a deep-dive technical specification for building the Stained Glass Maker as a 100% client-side Web Application. By keeping this entirely in the browser, we eliminate server costs and ensure instant, real-time user feedback.

---

## 1. Core Architecture & Tech Stack

- **Framework:** Next.js 15 (App Router), React 19, TypeScript.
- **Styling:** Tailwind CSS v4, shadcn/ui.
- **Image Vectorization Engine:** `imagetracerjs` (A highly optimized JS library capable of simultaneously clustering colors and tracing smooth SVG paths from raster images).
- **2D Geometry Math (For Borders):** `paper.js` or `clipper-lib` (Used to calculate precise offsets and tolerances so the printed plastic parts fit together).
- **3D Engine:** Three.js (`SVGLoader` + `ExtrudeGeometry`) wrapped in `@react-three/fiber`.
- **Exporter:** `jszip` with a custom XML generator for Bambu Studio 3MF support.

---

## 2. Detailed Pipeline & Algorithmic Flow

### Phase 1: Image Pre-Processing & Vectorization (Web Worker)
Instead of a heavy AI model, we use a deterministic vector tracing pipeline. This ensures smooth, printable curves rather than jagged pixels.

1. **Canvas Normalization:** The user uploads a photo. We draw it to an `OffscreenCanvas`, scale it to a max dimension of `800px`, and apply a slight Gaussian Blur. The blur is critical because it eliminates high-frequency noise (like individual hairs) that would otherwise generate thousands of unprintable microscopic glass shards.
2. **ImageTracer Execution:** We pass the pixel buffer to `imagetracerjs`. 
   - We configure it to cluster into a strict palette limit (e.g., 4 or 8 colors).
   - We set curve smoothing high.
   - **Output:** It returns a raw SVG string consisting of closed `<path>` elements representing every solid color pane.

### Phase 2: Frame Generation & Tolerance Math (2D Geometry)
A 3D printer needs a physical black frame to hold the glass panes, and we must account for real-world plastic expansion (tolerances).

1. **Extracting the Panes:** We parse the generated SVG paths.
2. **Tolerance Shrinkage (Clipper.js):** We use a 2D polygon library to physically shrink every colored pane path inwards by exactly `0.15mm`. If we don't do this, the printer will overlap the colored plastic and the black frame, causing print failures.
3. **Generating the Solid Frame:** 
   - We take the *original* (unshrunk) paths and apply a boolean `UNION` to merge them all into one massive silhouette.
   - We then apply a `STROKE` (outline) to all the original paths with a width of `1.2mm` (which perfectly equals three perimeters for a standard 0.4mm nozzle).
   - We boolean `SUBTRACT` the pane cutouts from the silhouette, leaving us with a solid 2D web representing the black lead frame.

### Phase 3: 3D Parametric Extrusion (Three.js)
We bring the 2D SVGs into the 3D viewport.

1. **Parsing:** Feed the cleaned SVG paths into Three.js's `SVGLoader`.
2. **Extruding the Frame:**
   - Loop over the black frame paths.
   - Use `THREE.ExtrudeGeometry` with a depth of `3.0mm`.
   - Apply a dark, matte material for the 3D preview.
3. **Extruding the Colored Panes:**
   - Loop over the colored pane paths.
   - Use `THREE.ExtrudeGeometry` with a depth of `2.0mm`.
   - We align them so they are flush with the bottom of the frame (Z=0).
   - Apply a semi-transparent, glossy material based on their clustered hex color to simulate stained glass in the browser.
4. **Interactive Preview:** The user can orbit the camera using `@react-three/fiber` controls to verify the frame is higher than the panes.

### Phase 4: Smart 3MF Export Engine
We package the geometries so they open flawlessly in Bambu Studio.

1. **Extracting Buffer Geometry:** Convert the generated Three.js `ExtrudeGeometry` instances into raw vertex arrays.
2. **Building the 3MF XML Structure:**
   - **`3dmodel.model`:** Insert the vertices and triangles. 
     - `<object id="1">` = The Black Frame.
     - `<object id="2">` = Blue Panes, `<object id="3">` = Red Panes, etc. (We group panes of identical colors into single objects to reduce file size).
   - **`model_settings.config`:** The critical step. We map `<object id="1">` to Extruder 1. We map `<object id="2">` to Extruder 2, etc. 
3. **Packaging:** Compress the XMLs into a standard ZIP format using `jszip`, rename the extension to `.3mf`, and trigger a browser download. 
4. **End Result:** The user drags the file into Bambu Studio, and it instantly loads as a solid, multi-colored object ready for an AMS unit.

---

## 3. UI/UX Control Panel Specifics

- **Detail Level (Slider):** Maps directly to the `imagetracerjs` path-fitting tolerance. Higher detail = more complex SVG curves.
- **Color Constraint (Radio Buttons):** Select 4, 8, or 12 max colors. Maps to the clustering algorithm limit.
- **Frame Thickness (Slider):** Adjusts the 2D boolean stroke width (`0.8mm` to `2.0mm`) to accommodate different printer nozzle sizes.

## User Review Required
> [!IMPORTANT]
> The exact logic and libraries for every phase have been detailed.
> 
> When you are ready, please let me know which of the three projects we should initialize and begin writing code for first:
> 1. Update the **Pixel Puzzle Maker** with the Smart 3MF Exporter.
> 2. Initialize the **Car Customizer Builder**.
> 3. Initialize the **Stained Glass Maker**.
