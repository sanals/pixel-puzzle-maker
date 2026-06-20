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

/**
 * Partition a 1D length into chunks no larger than `maxPer`, merging any
 * trailing remainder smaller than MIN_CHUNK into its neighbor to avoid slivers.
 */
function splitAxis(total: number, maxPer: number): [number, number][] {
  if (maxPer >= total) return [[0, total]]
  const chunkCount = Math.ceil(total / maxPer)
  const base = Math.floor(total / chunkCount)
  let remainder = total - base * chunkCount

  const sizes: number[] = []
  for (let i = 0; i < chunkCount; i++) {
    sizes.push(base + (remainder > 0 ? 1 : 0))
    if (remainder > 0) remainder--
  }
  // Repair any sub-MIN_CHUNK slivers by borrowing from the largest neighbor.
  for (let i = 0; i < sizes.length; i++) {
    while (sizes[i] < MIN_CHUNK && sizes.length > 1) {
      const donor = sizes.reduce(
        (best, v, idx) => (idx !== i && v > sizes[best] ? idx : best),
        i === 0 ? 1 : 0,
      )
      if (sizes[donor] - 1 < MIN_CHUNK) break
      sizes[donor]--
      sizes[i]++
    }
  }

  const ranges: [number, number][] = []
  let cursor = 0
  for (const s of sizes) {
    ranges.push([cursor, cursor + s])
    cursor += s
  }
  return ranges
}

/** Evaluate the physical footprint against the bed and plan any splitting. */
export function planBoardSplit(layout: GridLayout, config: PuzzleConfig): SplitPlan {
  // Usable cells per bed axis, leaving a small safety border.
  const usableW = config.bedWidth * 0.96
  const usableD = config.bedDepth * 0.96
  const maxCols = Math.max(MIN_CHUNK, Math.floor(usableW / layout.pitch))
  const maxRows = Math.max(MIN_CHUNK, Math.floor(usableD / layout.pitch))

  const totalCols = Math.round(layout.boardWidth / layout.pitch)
  const totalRows = Math.round(layout.boardDepth / layout.pitch)

  const colRanges = splitAxis(totalCols, maxCols)
  const rowRanges = splitAxis(totalRows, maxRows)
  const needsSplit = colRanges.length > 1 || rowRanges.length > 1

  const subBoards: SubBoard[] = []
  for (let r = 0; r < rowRanges.length; r++) {
    for (let c = 0; c < colRanges.length; c++) {
      const [col0, col1] = colRanges[c]
      const [row0, row1] = rowRanges[r]
      subBoards.push({
        id: `board-r${r + 1}-c${c + 1}`,
        col0,
        col1,
        row0,
        row1,
        cols: col1 - col0,
        rows: row1 - row0,
      })
    }
  }

  const connectorPositions: { x: number; z: number; rotated: boolean }[] = []
  if (needsSplit) {
    const halfX = (layout.boardWidth - layout.pitch) / 2
    const halfZ = (layout.boardDepth - layout.pitch) / 2

    // Vertical seams (connect left/right sub-boards)
    for (let c = 1; c < colRanges.length; c++) {
      const colIdx = colRanges[c][0]
      const worldX = colIdx * layout.pitch - halfX - layout.pitch / 2
      for (let r = 0; r < rowRanges.length; r++) {
        const rowMid = (rowRanges[r][0] + rowRanges[r][1]) / 2
        const worldZ = rowMid * layout.pitch - halfZ
        // Place two connectors per seam for stability
        connectorPositions.push({ x: worldX, z: worldZ - layout.pitch, rotated: false })
        connectorPositions.push({ x: worldX, z: worldZ + layout.pitch, rotated: false })
      }
    }

    // Horizontal seams (connect top/bottom sub-boards)
    for (let r = 1; r < rowRanges.length; r++) {
      const rowIdx = rowRanges[r][0]
      const worldZ = rowIdx * layout.pitch - halfZ - layout.pitch / 2
      for (let c = 0; c < colRanges.length; c++) {
        const colMid = (colRanges[c][0] + colRanges[c][1]) / 2
        const worldX = colMid * layout.pitch - halfX
        connectorPositions.push({ x: worldX - layout.pitch, z: worldZ, rotated: true })
        connectorPositions.push({ x: worldX + layout.pitch, z: worldZ, rotated: true })
      }
    }
  }

  const connectorCount = connectorPositions.length

  return {
    needsSplit,
    gridCols: colRanges.length,
    gridRows: rowRanges.length,
    subBoards,
    connectorCount,
    connectorPositions,
    reason: needsSplit
      ? `Footprint ${Math.round(layout.boardWidth)}×${Math.round(
          layout.boardDepth,
        )}mm exceeds the ${config.bedWidth}×${config.bedDepth}mm bed.`
      : `Footprint ${Math.round(layout.boardWidth)}×${Math.round(
          layout.boardDepth,
        )}mm fits the ${config.bedWidth}×${config.bedDepth}mm bed.`,
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
