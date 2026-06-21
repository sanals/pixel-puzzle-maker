# Pixel Puzzle Maker: v0 to v1 Migration & Improvements

This document tracks all the major features, refactors, and mathematical fixes implemented since the project was transferred from v0 to the local workspace.

## 1. 3D WebGL Preview Engine
- **Replaced 2D CSS Grid**: Completely removed the simple CSS flex/grid visualizer and replaced it with a fully interactive Three.js canvas (`preview-3d.tsx`).
- **Orbit Controls & Lighting**: Added smooth orbit controls and a realistic 3-point lighting setup to visualize the puzzle pieces with accurate shadows.
- **Physical CAD Assets**: Swapped procedural boxes for actual loaded STL geometries (`base_16_x_16.stl` and `base_24_x_24.stl`) for the base plates, ensuring the preview accurately reflects the final 3D print.

## 2. Advanced Image Cropping & Resampling
- **Interactive Crop Modal**: Integrated `react-image-crop` to allow users to zoom and crop their uploaded photos before processing.
- **Ratio Constraints**: Added constraints for multiple physical aspect ratios (1:1, 1:2, 2:1, etc.) which tie directly to the base plate grid counts.
- **Exact Resample Algorithm**: Refactored the `exactResample` algorithm to ensure the cropped image is perfectly mapped pixel-for-pixel to the exact required grid dimensions (e.g. 16x16, 16x32) without any edge truncation or empty gaps.

## 3. Mathematical Grid Alignments
- **Pitch & Tolerances**: Updated the grid engine to use the exact physical pitch of the CAD files (`8.75mm` pocket distance).
- **Z-Axis Alignment**: Fixed a visual offset where the blocks appeared shifted by one row. This involved calculating the exact bounding box of the STL tray, resolving the `rotateX(-90)` transform offsets, and removing an obsolete `-3.9mm` shift.
- **Y-Axis Seating**: Corrected the Y-axis elevation of the blocks so that their bottoms sit perfectly on the tray's `4.8mm` pocket floor, sticking out a realistic `2.6mm` above the tray lips.

## 4. 3MF & ZIP Manufacturing Exports
- **Monolithic Base Plates via CSG**: Fixed an issue where text letters were exported as separate disconnected components inside the 3MF file, causing Bambu Studio to scatter them across the build plate if "Split to Objects" was clicked.
  - Implemented `three-bvh-csg` in the exporter. The letters are now physically boolean-merged (embossed or debossed) into the base plate geometry, creating a single, solid, watertight mesh.
- **Single-Color Printing Enhancements**: When splitting blocks into separate plates by color, the exporter now packs the identical colored blocks tightly around the origin `(0,0)` using `packTilesAtOrigin`, ensuring minimal print head travel time and eliminating wasted bed space.
- **Z-Height Fixes**: Ensured that the packed tiles sit perfectly flat on the printing bed instead of clipping through it.

## 5. Type Safety & UI Polish
- **TypeScript Fixes**: Resolved multiple strict typing issues related to event handlers and undefined assets in `geometry-generators.ts` and `crop-modal.tsx`.
- **Empty `src` Bug**: Prevented the browser from doing redundant network requests by fixing the `imgSrc` initialization state in the crop modal.
