// Phase 4: Procedural 3D mesh & text generators.

import * as THREE from "three"
import { FontLoader, type Font } from "three-stdlib"
import { TextGeometry } from "three-stdlib"
import { Brush, Evaluator, SUBTRACTION, ADDITION } from "three-bvh-csg"
import { STLLoader } from "three-stdlib"
import type { GridLayout } from "./grid-engine"
import type { EmbossingStyle, PaletteColor } from "./types"

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

let cachedAssets: Record<number, MasterAssets> = {}

export async function loadMasterAssets(basePlateSize: number): Promise<MasterAssets> {
  if (cachedAssets[basePlateSize]) return cachedAssets[basePlateSize]
  const loader = new STLLoader()
  const baseFile = basePlateSize === 16 ? "/models/base_16_x_16.stl" : "/models/base_24_x_24.stl"
  const [base, block, connector] = await Promise.all([
    loader.loadAsync(baseFile),
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
  block.center()
  connector.computeBoundingBox()

  cachedAssets[basePlateSize] = { base, block, connector }
  return cachedAssets[basePlateSize]
}

/** Pre-cache the standard materials used by the 3D preview. */
/** Real-world 3D-print clearance shrink applied around every tile contour (mm). */
export const TILE_SHRINK_MM = 0.1 // Shrink tile by 0.1mm radially
const POCKET_EXPAND_MM = 0.05 // Expand pocket by 0.05mm radially

/**
 * Build a flat 2D outline (THREE.Shape) for a tile/pocket footprint.
 * `r` is the half-extent (radius) of the footprint in mm.
 */
export function buildShape(r: number, cx = 0, cy = 0): THREE.Shape {
  const s = new THREE.Shape()
  s.moveTo(cx - r, cy - r)
  s.lineTo(cx + r, cy - r)
  s.lineTo(cx + r, cy + r)
  s.lineTo(cx - r, cy + r)
  s.closePath()
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
  tileSize: number,
  height: number,
): THREE.BufferGeometry {
  const r = tileSize / 2 - TILE_SHRINK_MM
  const path = buildShape(Math.max(0.5, r))
  const geo = new THREE.ExtrudeGeometry(path, {
    depth: height,
    bevelEnabled: false,
    curveSegments: 6,
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
    const hole = buildShape(holeRadius, lx, lz)
    outer.holes.push(hole)
  }

  const floorThickness = layout.baseHeight - layout.pocketDepth

  // The lattice walls
  const latticeGeo = new THREE.ExtrudeGeometry(outer, {
    depth: layout.pocketDepth,
    bevelEnabled: false,
    curveSegments: 6,
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
  const assets = await loadMasterAssets(layout.basePlateSize)

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
  // The master tray is either 16x16 (140mm) or 24x24 (210mm) pockets.
  const TRAY_SIZE = layout.basePlateSize * layout.pitch
  const numBoardsX = Math.ceil(layout.boardWidth / TRAY_SIZE)
  const numBoardsZ = Math.ceil(layout.boardDepth / TRAY_SIZE)
  
  if (assets) {
    const baseGeo = assets.base // DO NOT CLONE or track STL to save massive CPU/GPU re-allocation!
    const trayMat = track(
      new THREE.MeshStandardMaterial({ color: trayColor, roughness: 0.9, metalness: 0.02 }),
    )
    const baseInst = track(new THREE.InstancedMesh(baseGeo, trayMat, numBoardsX * numBoardsZ))
    baseInst.receiveShadow = true
    baseInst.castShadow = true

    let idx = 0
    for (let x = 0; x < numBoardsX; x++) {
      for (let z = 0; z < numBoardsZ; z++) {
        const mTray = new THREE.Matrix4()
        // Trays center at 0,0 locally. We need to align the cluster.
        const totalW = numBoardsX * TRAY_SIZE
        const totalD = numBoardsZ * TRAY_SIZE

        // Because the base plate STLs have their origin at (0,0) at the bottom-left corner,
        // Wait! The previous assemble_1.stl was centered at (112, 112). 
        // Are the new base_X_X.stl files centered?
        // I will compute their bounding boxes to center them perfectly.
        const bbox = baseGeo.boundingBox!
        const cx = (bbox.max.x + bbox.min.x) / 2
        const cz = (bbox.max.z + bbox.min.z) / 2

        const px = -totalW / 2 + (x * TRAY_SIZE) + (TRAY_SIZE / 2) - cx
        const pz = -totalD / 2 + (z * TRAY_SIZE) + (TRAY_SIZE / 2) - cz
        mTray.makeTranslation(px, 0, pz)

        baseInst.setMatrixAt(idx++, mTray)
      }
    }
    baseInst.instanceMatrix.needsUpdate = true
    group.add(baseInst)
  }

  // --- Tiles: ONE single InstancedMesh for all 9000+ tiles ---
  const floorY = floorThickness
  const tileGeo = assets ? assets.block : track(createTileGeometry(layout.tileSize, layout.tileHeight))
  
  const tileMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffffff, // White base color, instanceColor will tint it
      roughness: 0.55,
      metalness: 0.05,
    }),
  )
  
  const tileInst = track(new THREE.InstancedMesh(tileGeo, tileMat, count))
  tileInst.castShadow = true
  tileInst.receiveShadow = true
  
  // Allocate color buffer
  const colorArray = new Float32Array(count * 3)
  tileInst.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3)

  const mRot = new THREE.Matrix4().makeRotationX(Math.PI)
  const colorObj = new THREE.Color()

  for (let i = 0; i < count; i++) {
    const p = layout.placements[i]
    const pal = palette[p.colorIndex]
    
    // Set Color
    colorObj.set(pal.hex)
    colorObj.toArray(colorArray, i * 3)
    
    const m = new THREE.Matrix4()
    if (pal.ignored) {
      // Hide completely by scaling to 0
      m.makeScale(0, 0, 0)
    } else {
      const mTrans = new THREE.Matrix4().makeTranslation(p.worldX, floorY + 3.6, p.worldZ)
      m.multiplyMatrices(mTrans, mRot)
    }
    tileInst.setMatrixAt(i, m)
  }
  
  tileInst.instanceColor.needsUpdate = true
  tileInst.instanceMatrix.needsUpdate = true
  tileInst.userData.placements = layout.placements // All placements mapped 1:1
  group.add(tileInst)

  // --- Letter decals (raised on tile face / recessed onto pocket floor) ---
  const planeSize = layout.tileSize * 0.62
  const raised = embossing === "raised"
  const decalY = floorThickness + 0.01 // barely above the pocket floor
  
  // Group indices by color for decals
  const byColor = new Map<number, number[]>()
  for (let i = 0; i < count; i++) {
    const ci = layout.placements[i].colorIndex
    if (!byColor.has(ci)) byColor.set(ci, [])
    byColor.get(ci)!.push(i)
  }
  
  // Share a single plane geometry for all decal instances
  const planeGeo = track(new THREE.PlaneGeometry(planeSize, planeSize))
  
  for (const [colorIndex, indices] of byColor) {
    const pal = palette[colorIndex]
    if (pal.ignored) continue 
    
    const lum = (0.2126 * pal.rgb[0] + 0.7152 * pal.rgb[1] + 0.0722 * pal.rgb[2]) / 255
    const ink = raised ? (lum > 0.45 ? "#0b1020" : "#f8fafc") : "#0b1020"
    const tex = track(createLabelTexture(pal.label, ink))
    
    const planeMat = track(
      new THREE.MeshStandardMaterial({
        map: tex,
        transparent: true,
        roughness: 0.6,
        depthWrite: false,
      }),
    )
    const decals = track(new THREE.InstancedMesh(planeGeo, planeMat, indices.length))
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

  // Center the whole group vertically already handled (base at +y).
  const dispose = () => {
    disposables.forEach((d) => d.dispose())
  }
  return { group, dispose }
}
