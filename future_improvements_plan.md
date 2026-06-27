# Pixel Puzzle Maker: Next Steps & Feature Plan

## 1. Background Removal Feature

There are two primary ways to approach removing the background so users don't have to print useless background tiles:

### Option A: Palette-Based Toggle (Recommended for V1)
- **How it works:** In the UI's "Palette Legend", we add a "Visibility" eye icon next to each extracted color. 
- **Implementation:** 
  - The user can click the icon to toggle a specific color off (e.g., clicking off the massive blue background).
  - During the 3MF export and 3D preview generation, the engine simply skips generating instances for any pixel mapped to a hidden color.
- **Pros:** Very easy to implement, gives the user total manual control, no heavy dependencies.
- **Cons:** Only works well if the background is a solid color or mostly one shade.

### Option B: AI-Powered Background Removal (Advanced)
- **How it works:** When the user uploads an image, we provide a "Remove Background" button that uses an in-browser AI model (like `@imgly/background-removal`) to strip the background.
- **Implementation:** 
  - The image alpha channel is modified so the background becomes perfectly transparent before we run our pixelation algorithm.
  - The pixelation logic is updated to ignore any pixel with an Alpha value of 0.
- **Pros:** Feels like magic. Works on complex photos (e.g., isolating a pet from a messy living room).
- **Cons:** Adds a heavy ML dependency to the app (the AI weights have to be downloaded by the browser on first load).

---

## 2. Additional Feature Suggestions for the App

Since you asked for suggestions on how to improve the app, here are a few high-impact ideas based on how 3D printing apps usually evolve:

### A. Dynamic Base Plate Colors
**The Problem:** If we implement Background Removal, the base plate will become highly visible since there are no tiles covering it. Currently, the base plate is always rendered and exported as dark grey/black.
**The Fix:** Add a color picker in the UI that lets the user choose the base plate filament color, so it acts as a complementary backdrop to their puzzle.

### B. Puzzle Fit Tolerance Slider
**The Problem:** Not all 3D printers are perfectly calibrated. Some users might find the puzzle tiles are too tight to press in, while others might find them too loose.
**The Fix:** Add a "Tile Fit Tolerance" slider (e.g., `0.05mm` to `0.20mm`). This would dynamically shrink the XY dimensions of the exported tile geometries slightly, giving users the ability to tune the "snap" feel of the puzzle.

### C. Smart Bed Rotation Optimization
**The Problem:** Right now, a `16x32` puzzle board might be split into two plates because it tries to place it vertically and exceeds the printer's Y-axis bounds.
**The Fix:** Update the exporter algorithms to run a quick bounding-box check. If a split board doesn't fit vertically, it should try rotating the entire board 90 degrees to see if it fits horizontally before deciding to slice it onto a second physical plate.

### D. Manual Recolor & Custom Palettes
**The Problem:** The app automatically generates the color palette from the image, but users might want to tweak specific areas (e.g., fixing a weirdly colored pixel) or completely swap a generated color for a custom one that matches the actual filament they have on hand.
**The Fix:** 
- **Custom Colors:** Allow the user to edit the hex value of any extracted color in the palette legend, or add a brand new custom color to the palette manually.
- **Paint Tool:** Add a "Paint" interaction mode to the 3D preview. Users can select a color from the palette, then click on individual puzzle tiles (or drag across multiple tiles) on the 3D board to manually overwrite their colors.

---

## Next Steps
Let me know which Background Removal option (A or B) you prefer, and if you want to tackle any of the additional suggestions!
