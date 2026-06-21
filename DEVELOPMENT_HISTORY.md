# Pixel Puzzle Maker - Post-v0 Development History

This document outlines the detailed technical progress, bug fixes, and feature implementations accomplished after migrating the initial UI prototype from v0 to the local development environment.

## 1. Project Initialization & Architecture
- **Environment Setup:** Initialized a local Next.js environment with TailwindCSS, shadcn/ui components, and Three.js dependencies.
- **Strict Dependency Management:** Configured `package.json` to explicitly handle `@types/three`, `three-stdlib`, and CSG utilities to prevent runtime crashes during 3D processing.

## 2. Core Image Processing & Quantization (`lib/image-processing.ts`)
- **Deterministic K-Means Clustering:** Implemented a fixed-seed PRNG (mulberry32) k-means++ color quantization algorithm. This guarantees that uploading the same image with the same color count always results in the exact same color palette and block assignments.
- **Stable Labeling:** Implemented luminance-based sorting (darkest to lightest) for the generated palette, ensuring that spreadsheet-style alphanumeric labels (A, B, C...) remain completely stable and deterministic across renders.
- **Center-Crop Downscaling:** Built a nearest-neighbor downscaling algorithm to map image pixels precisely to the puzzle grid without blurring boundaries.

## 3. High-Performance 3D Engine (`lib/geometry-generators.ts`)
- **InstancedMesh Architecture:** Built the 3D preview engine using `THREE.InstancedMesh`. This allows the application to smoothly render thousands of individual puzzle blocks simultaneously without browser performance drops.
- **Boolean CSG Operations:** Integrated `three-bvh-csg` to dynamically engrave (deboss) or emboss 3D alphanumeric labels onto the puzzle blocks and the base tray.
- **Dynamic Text Generation:** Leveraged `TextGeometry` with the Helvetiker font to generate crisp 3D labels mapped perfectly to the quantized color assignments. 
- **Visibility Fix:** Solved an issue where white text generated on dark tiles was virtually invisible when printed recessed onto the light-grey physical tray. Enforced high-contrast dark ink for all tray-recessed texts in the preview.

## 4. Master STL Integration & Coordinate Math (`lib/grid-engine.ts`)
- **Replaced Procedural Trays:** Transitioned from procedurally generating waffle grids to loading the actual production CAD files (`sample_block.stl`, `assemble_1.stl`, `connector_47.stl`) into the 3D scene.
- **Coordinate Math Fixes:** Solved severe alignment bugs where blocks and texts were not sitting cleanly inside the pockets. The geometry `rotateX` pipeline was refactored so that `textGeo.center()` executes *before* rotation, preventing double-shifting mathematical errors.
- **Half-Pitch Snapping:** Implemented logic to ensure odd-sized images (e.g. 23x23) snap to the strict half-pitch boundaries of the even-sized (24x24) physical tray, guaranteeing no overlap on the pocket walls.

## 5. Advanced Bambu Studio 3MF Export (`lib/exporters.ts`)
- **Bambu Studio AMS Compatibility:** Developed a highly custom `.3mf` XML packager that assigns proprietary `m:colorgroup` and `bambu:color` properties to meshes. This allows Bambu Studio to natively recognize the file as a multi-color AMS object without any manual user painting required.
- **Component Wrapping:** Fixed an issue where Bambu Studio scattered all puzzle blocks wildly across the build plate upon import. We solved this by wrapping all geometries tightly into a single `<component>` XML node, locking them together as a solid, multi-part object.

## 6. Monolithic vs. Separated Plate Exports
- **Monolithic Single File:** Provided the initial option to export the entire assembled board (tray + text + blocks) as a massive merged `.stl` or `.3mf` for single prints.
- **Separated Plates (.zip):** Replaced the generic `.stl` zip export with an advanced `.3mf` zip pipeline.
  - **Color Chunking:** The export groups blocks strictly by color into tightly packed grids (`Plate_Tiles_A_Blue.3mf`, `Plate_Tiles_B_Red.3mf`) optimized for single-color filament prints.
  - **Tray Chunking:** The export mathematically calculates the 3D bounding box of each 24x24 tray and sweeps up all associated text decals. This ensures that if the puzzle is 48x48 (spanning four physical trays), it correctly exports four separated `.3mf` files (`1_Plate_Board_1`, `_2`, `_3`, `_4`), each with perfectly baked text exactly where it belongs.

## 7. Current Work in Progress
- **Dynamic Photo Cropping & Scaling:** Preparing to implement an integrated `react-image-crop` modal that locks photo uploads to specific aspect ratios, combined with dynamic selection of `16x16` or `24x24` base plates, ensuring the final generated puzzle is always an exact multiple of the physical trays.
