// Phase 5: Intelligent board splitting & snap-fit connectors.

import * as THREE from "three"
import type { GridLayout } from "./grid-engine"
import type { PuzzleConfig } from "./types"

const MIN_CHUNK = 4 // never leave sub-boards thinner than 4 grid lines

export interface BoardChunk {
  /** [start, end) inclusive-exclusive cell ranges. */
  col0: number
  col1: number
  row0: number
  row1: number
}

export interface SubBoard extends BoardChunk {
  id: string
  cols: number
  rows: number
}

export interface SplitPlan {
  needsSplit: boolean
  /** Number of sub-boards across (x) and down (z). */
  gridCols: number
  gridRows: number
  subBoards: SubBoard[]
  /** Pre-computed world coordinates for snap-fit connectors along seams. */
  connectorPositions: { x: number; z: number; rotated: boolean }[]
  connectorCount: number
  reason: string
}

/** Evaluate the physical footprint against the bed and plan any splitting. */
export function planBoardSplit(layout: GridLayout, config: PuzzleConfig): SplitPlan {
  // Trays are ALWAYS full basePlateSize STLs
  const maxCols = layout.basePlateSize
  const maxRows = layout.basePlateSize

  const totalCols = Math.round(layout.boardWidth / layout.pitch)
  const totalRows = Math.round(layout.boardDepth / layout.pitch)

  // Number of physical boards in X and Z
  const numBoardsX = Math.ceil(totalCols / maxCols)
  const numBoardsZ = Math.ceil(totalRows / maxRows)
  const needsSplit = numBoardsX > 1 || numBoardsZ > 1

  const subBoards: SubBoard[] = []
  for (let r = 0; r < numBoardsZ; r++) {
    for (let c = 0; c < numBoardsX; c++) {
      subBoards.push({
        id: `board-r${r + 1}-c${c + 1}`,
        col0: c * maxCols,
        col1: Math.min((c + 1) * maxCols, totalCols),
        row0: r * maxRows,
        row1: Math.min((r + 1) * maxRows, totalRows),
        cols: maxCols,
        rows: maxRows,
      })
    }
  }

  // Count seams (touching edges) between the boards.
  const verticalSeams = Math.max(0, numBoardsX - 1) * numBoardsZ
  const horizontalSeams = Math.max(0, numBoardsZ - 1) * numBoardsX
  const totalSeams = verticalSeams + horizontalSeams
  
  // The physical STLs have exactly 3 holes on every side.
  const connectorCount = totalSeams * 3

  return {
    needsSplit,
    gridCols: numBoardsX,
    gridRows: numBoardsZ,
    subBoards,
    connectorCount,
    connectorPositions: [], // Obsolete, not used for export or UI
    reason: needsSplit
      ? `Puzzle requires a ${numBoardsX}x${numBoardsZ} grid of ${layout.basePlateSize}x${layout.basePlateSize} bases.`
      : `Puzzle fits on a single ${layout.basePlateSize}x${layout.basePlateSize} base.`
  }
}

/**
 * Standalone "Connector Peg" mesh — a locking bow-tie key that bridges
 * neighboring split boards after printing.
 */
export function createConnectorPegGeometry(pitch: number): THREE.BufferGeometry {
  const w = pitch * 0.55
  const neck = w * 0.34
  const h = pitch * 0.32
  const shape = new THREE.Shape()
  // Symmetric bow-tie (double dovetail) profile.
  shape.moveTo(-w / 2, h / 2)
  shape.lineTo(-neck / 2, neck / 2)
  shape.lineTo(-neck / 2, -neck / 2)
  shape.lineTo(-w / 2, -h / 2)
  shape.lineTo(w / 2, -h / 2)
  shape.lineTo(neck / 2, -neck / 2)
  shape.lineTo(neck / 2, neck / 2)
  shape.lineTo(w / 2, h / 2)
  shape.closePath()

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(2, pitch * 0.25),
    bevelEnabled: false,
  })
  geo.rotateX(-Math.PI / 2)
  geo.center()
  geo.computeVertexNormals()
  return geo
}
