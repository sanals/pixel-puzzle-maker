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
    const baseGeo = track(assets.base.clone())
    const trayMat = track(
      new THREE.MeshStandardMaterial({ color: trayColor, roughness: 0.9, metalness: 0.02 }),
    )
    const baseInst = new THREE.InstancedMesh(baseGeo, trayMat, numBoardsX * numBoardsZ)
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
    const tileGeo = assets ? track(assets.block.clone()) : track(createTileGeometry(layout.shape, layout.tileSize, layout.tileHeight))

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
      // The block is centered, so we must raise it by half its height (3.6mm) so its bottom rests on floorY
      // We also rotate by 180 degrees around X to flip the block so the chamfer faces UP in the preview.
      const mTrans = new THREE.Matrix4().makeTranslation(p.worldX, floorY + 3.6, p.worldZ)
      const mRot = new THREE.Matrix4().makeRotationX(Math.PI)
      m.multiplyMatrices(mTrans, mRot)
      inst.setMatrixAt(j, m)
    })
    inst.instanceMatrix.needsUpdate = true
    inst.userData.colorIndex = colorIndex
    inst.userData.placements = indices.map(idx => layout.placements[idx])
    group.add(inst)
  }

  // --- Letter decals (raised on tile face / recessed onto pocket floor) ---
  if (embossing !== "none") {
    const planeSize = layout.tileSize * 0.62
    const raised = embossing === "raised"
    const decalY = floorThickness + 0.01 // barely above the pocket floor
    for (const [colorIndex, indices] of byColor) {
      const pal = palette[colorIndex]
      // Choose contrasting ink for legibility on raised tiles. Tray floor is light grey, so use dark ink for recessed.
      const lum =
        (0.2126 * pal.rgb[0] + 0.7152 * pal.rgb[1] + 0.0722 * pal.rgb[2]) / 255
      const ink = raised ? (lum > 0.45 ? "#0b1020" : "#f8fafc") : "#0b1020"
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
