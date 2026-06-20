// Phase 3: Coordinate mapping & honeycomb layout engine.
// Maps logical pixel indices (x, y) to real-world mm coordinates on the XZ plane.

import type { PuzzleConfig, TileShape, VoxelMatrix } from "./types"

const SIN_60 = Math.sin(Math.PI / 3) // ≈ 0.8660254

export interface CellPlacement {
  gx: number
  gy: number
  /** World position on the XZ ground plane (mm). Y is the up axis. */
  worldX: number
  worldZ: number
  colorIndex: number
  label: string
  hex: string
}

export interface GridLayout {
  shape: TileShape
  /** Edge-to-edge pitch between cell centers (mm). */
  pitch: number
  /** Nominal tile footprint size (mm) before clearance. */
  tileSize: number
  /** Tray base thickness (mm). */
  baseHeight: number
  /** Tile height above tray floor (mm). */
  tileHeight: number
  /** Pocket recess depth into the tray (mm). */
  pocketDepth: number
  boardWidth: number
  boardDepth: number
  placements: CellPlacement[]
}

/** Whether a shape nests in a hexagonal (honeycomb) grid. */
export function isHoneycomb(shape: TileShape): boolean {
  return shape === "hexagon"
}

/**
 * Build the spatial layout for the whole matrix.
 * - Cartesian (square / cylinder / heart): strict linear projection.
 * - Honeycomb (hexagon): odd rows shifted half a tile; rows stepped by pitch*sin(60°).
 */
export function computeLayout(matrix: VoxelMatrix, config: PuzzleConfig): GridLayout {
  const size = matrix.width
  const honeycomb = isHoneycomb(config.tileShape)

  // mm per logical cell along the longest edge.
  const pitch = config.physicalSizeMm / size
  const tileSize = pitch * 0.96 // small inter-tile margin
  const baseHeight = Math.max(3, pitch * 0.35)
  const tileHeight = Math.max(2.4, pitch * 0.55)
  const pocketDepth = Math.min(baseHeight - 1, tileHeight * 0.7)

  const rowStep = honeycomb ? pitch * SIN_60 : pitch
  const colStep = pitch

  const spanX = (size - 1) * colStep + (honeycomb ? pitch / 2 : 0)
  const spanZ = (size - 1) * rowStep
  const halfX = spanX / 2
  const halfZ = spanZ / 2

  const placements: CellPlacement[] = []
  for (let gy = 0; gy < size; gy++) {
    const rowShift = honeycomb && gy % 2 === 1 ? pitch / 2 : 0
    const worldZ = gy * rowStep - halfZ
    for (let gx = 0; gx < size; gx++) {
      const cell = matrix.cells[gx][gy]
      const worldX = gx * colStep + rowShift - halfX
      placements.push({
        gx,
        gy,
        worldX,
        worldZ,
        colorIndex: cell.colorIndex,
        label: cell.label,
        hex: cell.hexColor,
      })
    }
  }

  const boardWidth = spanX + pitch
  const boardDepth = spanZ + pitch

  return {
    shape: config.tileShape,
    pitch,
    tileSize,
    baseHeight,
    tileHeight,
    pocketDepth,
    boardWidth,
    boardDepth,
    placements,
  }
}
