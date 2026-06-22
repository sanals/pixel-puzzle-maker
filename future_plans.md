# Future Feature: Mini-Map Engraving and Zip Output Formatting

## Description
This feature aims to:
1. Rename the ZIP export contents using an intuitive `A1, B1, A2` coordinate grid naming system for multi-board puzzles.
2. Output a dynamically generated `README.txt` acting as an assembly manifest (tile color counts and board layout).
3. Engrave a physical "mini-map" on the bottom (back face) of every 3D printed board. This mini-map visually indicates the board's exact location in the entire puzzle layout, ensuring completely foolproof assembly.

## Saved Work
The code for this entire feature, including the CSG (Constructive Solid Geometry) subtraction code needed for the engraving, has been perfectly implemented and captured in the `mini-map-feature.patch` file in the root directory.

To apply this feature in the future, you can simply run:
```bash
git apply mini-map-feature.patch
```
