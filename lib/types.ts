// Shared domain types for the Pixel Puzzle Maker engine.

export type TileShape = "square" | "cylinder" | "hexagon" | "heart"

export type EmbossingStyle = "none" | "raised" | "recessed"

export const GRID_SIZES = [24, 48, 72, 96, 120] as const
export type GridSize = (typeof GRID_SIZES)[number]

export const MIN_COLORS = 2
export const MAX_COLORS = 6

/** A single quantized palette entry. */
export interface PaletteColor {
  /** Stable index assigned by the quantizer (0-based). */
  index: number
  /** Uppercase identifier key: A, B, C ... */
  label: string
  /** Hex string, e.g. "#1f2a44". */
  hex: string
  /** sRGB components 0-255. */
  rgb: [number, number, number]
  /** Number of pixels assigned to this color. */
  count: number
  /** Surface coverage as a fraction 0..1. */
  coverage: number
}

/** A single logical cell in the voxel matrix. */
export interface VoxelCell {
  hexColor: string
  label: string
  /** Palette index this cell maps to. */
  colorIndex: number
}

/**
 * The single-source voxel matrix data structure.
 * Indexed as matrix[x][y] where x is column, y is row.
 */
export interface VoxelMatrix {
  width: number
  height: number
  cells: VoxelCell[][]
  palette: PaletteColor[]
}

/** Printer bed presets in millimeters. */
export interface PrinterBed {
  id: string
  name: string
  width: number
  depth: number
}

export const PRINTER_BEDS: PrinterBed[] = [
  { id: "bambu-a1", name: "Bambu Lab 256 x 256", width: 256, depth: 256 },
  { id: "prusa-mk4", name: "Prusa MK4 250 x 210", width: 250, depth: 210 },
  { id: "ender-3", name: "Ender 3 220 x 220", width: 220, depth: 220 },
  { id: "custom", name: "Custom", width: 200, depth: 200 },
]

/** Complete manufacturing configuration coming from the control panel. */
export interface PuzzleConfig {
  gridSize: GridSize
  colorCount: number
  tileShape: TileShape
  embossing: EmbossingStyle
  bedId: string
  bedWidth: number
  bedDepth: number
  /** Target physical board size in mm (longest edge). */
  physicalSizeMm: number
}

export const DEFAULT_CONFIG: PuzzleConfig = {
  gridSize: 48,
  colorCount: 4,
  tileShape: "square",
  embossing: "raised",
  bedId: "bambu-a1",
  bedWidth: 256,
  bedDepth: 256,
  physicalSizeMm: 120,
}

/** Worker request/response contracts. */
export interface ProcessRequest {
  type: "process"
  imageData: ImageData
  gridSize: number
  colorCount: number
}

export interface ProcessResponse {
  type: "result"
  matrix: VoxelMatrix
}

export interface ProcessError {
  type: "error"
  message: string
}

export type WorkerOutbound = ProcessResponse | ProcessError
