// Phase 3: Coordinate mapping & honeycomb layout engine.
// Maps logical pixel indices (x, y) to real-world mm coordinates on the XZ plane.

import type { PuzzleConfig, VoxelMatrix } from "./types"

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
  basePlateSize: number
  placements: CellPlacement[]
}

/**
 * Build the spatial layout for the whole matrix.
 * - Cartesian (square / cylinder / heart): strict linear projection.
 * - Honeycomb (hexagon): odd rows shifted half a tile; rows stepped by pitch*sin(60°).
 */
export function computeLayout(matrix: VoxelMatrix, config: PuzzleConfig): GridLayout {
  const width = matrix.width
  const height = matrix.height
  const pitch = 8.75
  const tileSize = 7.8 // Master block STL size
  
  // These are roughly inferred from the STLs for visualization purposes
  const baseHeight = 9.4 
  const tileHeight = 7.2
  const pocketDepth = 4.6 

  const rowStep = pitch
  const colStep = pitch

  const spanX = (width - 1) * colStep
  const spanZ = (height - 1) * rowStep
  
  // Because the resolution is strictly locked to multiples of the basePlateSize,
  // we do not need the half-pitch snapping hack anymore.
  let alignX = spanX / 2
  let alignZ = spanZ / 2

  const placements: CellPlacement[] = []
  for (let gy = 0; gy < height; gy++) {
    const worldZ = gy * rowStep - alignZ
    for (let gx = 0; gx < width; gx++) {
      const cell = matrix.cells[gx][gy]
      const worldX = gx * colStep - alignX
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
    pitch,
    tileSize,
    baseHeight,
    tileHeight,
    pocketDepth,
    boardWidth,
    boardDepth,
    basePlateSize: config.basePlateSize,
    placements,
  }
}
