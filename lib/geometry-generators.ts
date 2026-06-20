// Phase 4: Procedural 3D mesh & text generators.

import * as THREE from "three"
import { FontLoader, type Font } from "three-stdlib"
import { TextGeometry } from "three-stdlib"
import { Brush, Evaluator, SUBTRACTION, ADDITION } from "three-bvh-csg"
import { STLLoader } from "three-stdlib"
import type { GridLayout } from "./grid-engine"
import type { EmbossingStyle, PaletteColor, TileShape } from "./types"

let cachedFont: Font | null = null
export async function getFont(): Promise<Font> {
  if (cachedFont) return cachedFont
  return new Promise((resolve, reject) => {
    new FontLoader().load(
      "/fonts/helvetiker_bold.typeface.json",
      (font) => {
        cachedFont = font
        resolve(font)
      },
      undefined,
      (err) => reject(err),
    )
  })
}

export type MasterAssets = {
  base: THREE.BufferGeometry
  block: THREE.BufferGeometry
  connector: THREE.BufferGeometry
}

let cachedAssets: MasterAssets | null = null

export async function loadMasterAssets(): Promise<MasterAssets> {
  if (cachedAssets) return cachedAssets
  const loader = new STLLoader()
  const [base, block, connector] = await Promise.all([
    loader.loadAsync("/models/assemble_1.stl"),
    loader.loadAsync("/models/sample_block.stl"),
    loader.loadAsync("/models/connector_47.stl"),
  ])
  
  // The master STLs from CAD are Z-up. 
  // Three.js is Y-up. So we rotate them -90 degrees around X.
  base.rotateX(-Math.PI / 2)
  block.rotateX(-Math.PI / 2)
  connector.rotateX(-Math.PI / 2)

  // Center geometries if needed, or leave them as modeled by the user
  // We'll calculate their bounding boxes for layout positioning
  base.computeBoundingBox()
  block.computeBoundingBox()
  connector.computeBoundingBox()

  cachedAssets = { base, block, connector }
  return cachedAssets
}

/** Pre-cache the standard materials used by the 3D preview. */
/** Real-world 3D-print clearance shrink applied around every tile contour (mm). */
export const TILE_SHRINK_MM = 0.1 // Shrink tile by 0.1mm radially
const POCKET_EXPAND_MM = 0.05 // Expand pocket by 0.05mm radially

/**
 * Build a flat 2D outline (THREE.Shape) for a tile/pocket footprint.
 * `r` is the half-extent (radius) of the footprint in mm.
 */
export function buildShape(shape: TileShape, r: number, cx = 0, cy = 0): THREE.Shape {
  const s = new THREE.Shape()
  switch (shape) {
    case "cylinder": {
      s.absarc(cx, cy, r, 0, Math.PI * 2, false)
      break
    }
    case "hexagon": {
      // Flat-top hexagon nested for honeycomb packing.
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 180) * (60 * i)
        const x = cx + r * Math.cos(a)
        const y = cy + r * Math.sin(a)
        if (i === 0) s.moveTo(x, y)
        else s.lineTo(x, y)
      }
      s.closePath()
      break
    }
    case "heart": {
      // Parametric heart curve scaled to fit within radius r.
      const steps = 48
      const scale = r / 17
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2
        const x = 16 * Math.pow(Math.sin(t), 3)
        const y =
          13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
        const px = cx + x * scale
        const py = cy + y * scale
        if (i === 0) s.moveTo(px, py)
        else s.lineTo(px, py)
      }
      s.closePath()
      break
    }
    case "square":
    default: {
      s.moveTo(cx - r, cy - r)
      s.lineTo(cx + r, cy - r)
      s.lineTo(cx + r, cy + r)
      s.lineTo(cx - r, cy + r)
      s.closePath()
      break
    }
  }
  return s
}

/** Lay an extruded (XY + depth Z) geometry flat so depth becomes the +Y height. */
function layFlat(geo: THREE.ExtrudeGeometry): THREE.BufferGeometry {
  geo.rotateX(-Math.PI / 2)
  return geo
}

/**
 * Solid tile geometry with a hard clearance shrink so pieces drop into pockets.
 * Returned geometry sits with its base at y=0 and rises to y=height.
 */
export function createTileGeometry(
  shape: TileShape,
  tileSize: number,
  height: number,
): THREE.BufferGeometry {
  const r = tileSize / 2 - TILE_SHRINK_MM
  const path = buildShape(shape, Math.max(0.5, r))
  const geo = new THREE.ExtrudeGeometry(path, {
    depth: height,
    bevelEnabled: false,
    curveSegments: shape === "cylinder" || shape === "heart" ? 24 : 6,
  })
  layFlat(geo)
  // After rotateX, extrude depth spans y in [-height, 0]; lift base to 0.
  geo.translate(0, height, 0)
  geo.computeVertexNormals()
  return geo
}

import { mergeBufferGeometries } from "three-stdlib"

export function createTrayGeometry(
  layout: GridLayout,
  indices: number[],
  w: number,
  d: number,
  cx: number,
  cz: number,
  textBrush?: Brush,
  textOp?: number
): THREE.BufferGeometry {
  const outer = new THREE.Shape()
  outer.moveTo(-w / 2, -d / 2)
  outer.lineTo(w / 2, -d / 2)
  outer.lineTo(w / 2, d / 2)
  outer.lineTo(-w / 2, d / 2)
  outer.closePath()

  const holeRadius = layout.tileSize / 2 + POCKET_EXPAND_MM
  for (const i of indices) {
    const p = layout.placements[i]
    const lx = p.worldX - cx
    const lz = p.worldZ - cz
    const hole = buildShape(layout.shape, holeRadius, lx, lz)
    outer.holes.push(hole)
  }

  const floorThickness = layout.baseHeight - layout.pocketDepth
  
  // The lattice walls
  const latticeGeo = new THREE.ExtrudeGeometry(outer, {
    depth: layout.pocketDepth,
    bevelEnabled: false,
    curveSegments: layout.shape === "cylinder" || layout.shape === "heart" ? 24 : 6,
  })
  layFlat(latticeGeo)
  latticeGeo.translate(0, floorThickness + layout.pocketDepth, 0)
  latticeGeo.computeVertexNormals()

  // The solid floor
  const floorGeo = new THREE.BoxGeometry(w, floorThickness, d)
  floorGeo.translate(0, floorThickness / 2, 0)

  // Merge them safely by ensuring matching attributes and no indices
  let floorNonIdx = floorGeo.index ? floorGeo.toNonIndexed() : floorGeo.clone()
  const latticeNonIdx = latticeGeo.index ? latticeGeo.toNonIndexed() : latticeGeo.clone()

  if (textBrush && textOp !== undefined) {
    const floorBrush = new Brush(floorNonIdx)
    floorBrush.updateMatrixWorld()
    
    // We create a fresh evaluator for safety
    const localEvaluator = new Evaluator()
    localEvaluator.useGroups = false
    
    const result = localEvaluator.evaluate(floorBrush, textBrush, textOp)
    floorNonIdx.dispose()
    floorNonIdx = result.geometry
  }

  const merged = mergeBufferGeometries([floorNonIdx, latticeNonIdx])
  
  floorGeo.dispose()
  latticeGeo.dispose()
  floorNonIdx.dispose()
  latticeNonIdx.dispose()

  return merged!
}



/** Generate a crisp alpha texture for a single character label. */
export function createLabelTexture(label: string, fg: string, bg?: string): THREE.CanvasTexture {
  const px = 128
  const canvas = document.createElement("canvas")
  canvas.width = px
  canvas.height = px
  const c = canvas.getContext("2d")!
  if (bg) {
    c.fillStyle = bg
    c.fillRect(0, 0, px, px)
  }
  c.fillStyle = fg
  c.font = `700 ${px * 0.66}px ui-sans-serif, system-ui, sans-serif`
  c.textAlign = "center"
  c.textBaseline = "middle"
  c.fillText(label, px / 2, px / 2 + px * 0.04)
  const tex = new THREE.CanvasTexture(canvas)
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

export interface SceneBuildResult {
  group: THREE.Group
  dispose: () => void
}

/**
 * Assemble the full preview scene: pocketed waffle tray + instanced tiles + letter decals.
 * Uses InstancedMesh so even 128x128 (16,384 tiles) stays performant.
 */
export async function buildPuzzleGroup(
  layout: GridLayout,
  palette: PaletteColor[],
  embossing: EmbossingStyle,
): Promise<SceneBuildResult> {
  // Ensure master assets are loaded before we start assembling the layout.
  await loadMasterAssets()

  const group = new THREE.Group()
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => {
    disposables.push(o)
    return o
  }

  const count = layout.placements.length
  const trayColor = new THREE.Color("#cbd5e1")

  const floorThickness = layout.baseHeight - layout.pocketDepth

  // --- Monolithic Tray Base ---
  // Tile the master base tray to cover the requested grid.
  // The master tray is exactly 24x24 pockets, 224x224mm.
  const TRAY_SIZE = 224.0
  const numBoardsX = Math.ceil(layout.boardWidth / TRAY_SIZE)
  const numBoardsZ = Math.ceil(layout.boardDepth / TRAY_SIZE)

  if (cachedAssets) {
    const baseGeo = track(cachedAssets.base.clone())
    const trayMat = track(
      new THREE.MeshStandardMaterial({ color: trayColor, roughness: 0.9, metalness: 0.02 }),
    )
    const baseInst = new THREE.InstancedMesh(baseGeo, trayMat, numBoardsX * numBoardsZ)
    baseInst.receiveShadow = true
    baseInst.castShadow = true
    
    let idx = 0
    const mTray = new THREE.Matrix4()
    for (let x = 0; x < numBoardsX; x++) {
      for (let z = 0; z < numBoardsZ; z++) {
        // The master STL bounding box has min=0, max=224
        // Our layout starts from worldX = -boardWidth/2 + pitch/2
        // We need to carefully align the tiled boards to the layout.
        // Easiest way: The board 0,0 spans from x=0 to 224.
        // We want the total assembled board to be centered around 0,0.
        const totalW = numBoardsX * TRAY_SIZE
        const totalD = numBoardsZ * TRAY_SIZE
        const px = -totalW / 2 + x * TRAY_SIZE
        const pz = -totalD / 2 + z * TRAY_SIZE
        mTray.makeTranslation(px, 0, pz)
        baseInst.setMatrixAt(idx++, mTray)
      }
    }
    baseInst.instanceMatrix.needsUpdate = true
    group.add(baseInst)
  }

  // --- Tiles, grouped per palette color into one InstancedMesh each ---
  const floorY = floorThickness
  const byColor = new Map<number, number[]>()
  for (let i = 0; i < count; i++) {
    const ci = layout.placements[i].colorIndex
    if (!byColor.has(ci)) byColor.set(ci, [])
    byColor.get(ci)!.push(i)
  }

  const m = new THREE.Matrix4()

  for (const [colorIndex, indices] of byColor) {
    const pal = palette[colorIndex]
    const tileGeo = cachedAssets ? track(cachedAssets.block.clone()) : track(createTileGeometry(layout.shape, layout.tileSize, layout.tileHeight))
    
    const mat = track(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(pal.hex),
        roughness: 0.55,
        metalness: 0.05,
      }),
    )
    const inst = new THREE.InstancedMesh(tileGeo, mat, indices.length)
    inst.castShadow = true
    inst.receiveShadow = true
    indices.forEach((idx, j) => {
      const p = layout.placements[idx]
      // Block STL min is 0, max is 7.8. So we must center it.
      const offset = cachedAssets ? -7.8 / 2 : 0
      m.makeTranslation(p.worldX + offset, floorY, p.worldZ + offset)
      inst.setMatrixAt(j, m)
    })
    inst.instanceMatrix.needsUpdate = true
    inst.userData.colorIndex = colorIndex
    group.add(inst)
  }

  // --- Letter decals (raised on tile face / recessed onto pocket floor) ---
  if (embossing !== "none") {
    const planeSize = layout.tileSize * 0.62
    const raised = embossing === "raised"
    const decalY = floorThickness + 0.01 // barely above the pocket floor
    for (const [colorIndex, indices] of byColor) {
      const pal = palette[colorIndex]
      // Choose contrasting ink for legibility.
      const lum =
        (0.2126 * pal.rgb[0] + 0.7152 * pal.rgb[1] + 0.0722 * pal.rgb[2]) / 255
      const ink = lum > 0.45 ? "#0b1020" : "#f8fafc"
      const tex = track(createLabelTexture(pal.label, ink))
      const planeGeo = track(new THREE.PlaneGeometry(planeSize, planeSize))
      const planeMat = track(
        new THREE.MeshStandardMaterial({
          map: tex,
          transparent: true,
          roughness: 0.6,
          depthWrite: false,
        }),
      )
      const decals = new THREE.InstancedMesh(planeGeo, planeMat, indices.length)
      indices.forEach((idx, j) => {
        const p = layout.placements[idx]
        const mat4 = new THREE.Matrix4()
        const rot = new THREE.Matrix4().makeRotationX(-Math.PI / 2)
        const trans = new THREE.Matrix4().makeTranslation(p.worldX, decalY, p.worldZ)
        mat4.multiplyMatrices(trans, rot)
        decals.setMatrixAt(j, mat4)
      })
      decals.instanceMatrix.needsUpdate = true
      group.add(decals)
    }
  }

  // Center the whole group vertically already handled (base at +y).
  const dispose = () => {
    disposables.forEach((d) => d.dispose())
  }
  return { group, dispose }
}
