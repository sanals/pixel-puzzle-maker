# Pixel Puzzle Maker: Next Steps & Feature Plan

## ✅ Completed Features
We have successfully implemented several major features from our initial roadmap:
- **Background Removal:** Users can toggle colors on/off via the eye icon in the palette legend, preventing massive backgrounds from being generated/exported.
- **Manual Recolor (Paint Tool):** Added a 3D raycasting paint tool with undo functionality, allowing users to manually fix weirdly colored pixels by clicking directly on the board.
- **Optimized 3MF Engine:** Drastically reduced export sizes from 1.6GB down to ~10MB using native JSZip DEFLATE compression and instancing.

---

## ⏳ Pending Features

### 1. Dynamic Base Plate Colors
**The Problem:** If a user hides a large background color, the base plate becomes highly visible. Currently, the base plate is always rendered and exported as dark grey/black.
**The Fix:** Add a color picker in the UI that lets the user choose the base plate filament color, so it acts as a complementary backdrop to their puzzle.

### 2. Puzzle Fit Tolerance Slider
**The Problem:** Not all 3D printers are perfectly calibrated. Some users might find the puzzle tiles are too tight to press in, while others might find them too loose.
**The Fix:** Add a "Tile Fit Tolerance" slider (e.g., `0.05mm` to `0.20mm`). This would dynamically shrink the XY dimensions of the exported tile geometries slightly, giving users the ability to tune the "snap" feel of the puzzle.

### 3. Smart Bed Rotation Optimization
**The Problem:** Right now, a `16x32` puzzle board might be split into two plates because it tries to place it vertically and exceeds the printer's Y-axis bounds.
**The Fix:** Update the exporter algorithms to run a quick bounding-box check. If a split board doesn't fit vertically, it should try rotating the entire board 90 degrees to see if it fits horizontally before deciding to slice it onto a second physical plate.

### 4. Custom Hex Codes for Palettes
**The Problem:** The app automatically generates the color palette from the image, but users might want to completely swap a generated color for a custom one that matches the actual filament spool they have on hand (e.g. swapping a dull yellow for a bright neon yellow).
**The Fix:** Allow users to click the color square in the legend to type in their own custom Hex code.

---

## 🌟 New Feature Suggestions

### 5. Magnet Holes in Base Plates (Highly Requested in 3D Printing)
**The Concept:** A lot of enthusiasts love mounting flat puzzles or pixel art to their refrigerators or walls. 
**The Fix:** Add an option in the UI to generate `6x2mm` or `8x3mm` negative cylindrical cutouts on the back of the base trays.

### 6. Heightmap (Topological) Generation
**The Concept:** Instead of every tile being perfectly flat, generate tiles of different heights based on pixel brightness!
**The Fix:** Lighter colors = taller tiles (e.g. 5mm high), darker colors = shorter tiles (e.g. 3mm high). This creates a stunning 3D topological map effect that looks incredible when illuminated from the side.

### 7. AI-Powered Background Removal
**The Concept:** Instead of manually hiding colors, provide a "Remove Background" button.
**The Fix:** Use an in-browser machine learning model (like `@imgly/background-removal`) to automatically detect the main subject (e.g., a pet) and strip the background instantly before pixelation.

### 8. Save/Load Project State
**The Concept:** Since large 96x96 puzzles take time to configure, paint, and dial in, users would benefit from being able to save their progress.
**The Fix:** Allow users to export a lightweight `.json` file containing their image, palette, manual paint overrides, and config, which they can upload later to resume work.
