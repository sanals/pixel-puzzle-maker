// Phase 4: Procedural 3D mesh & text generators.

import * as THREE from "three"
import type { GridLayout } from "./grid-engine"
import type { EmbossingStyle, PaletteColor, TileShape } from "./types"

/** Real-world 3D-print clearance shrink applied around every tile contour (mm). */
export const TILE_CLEARANCE_MM = 0.2

/**
 * Build a flat 2D outline (THREE.Shape) for a tile/pocket footprint.
 * `r` is the half-extent (radius) of the footprint in mm.
 */
export function buildShape(shape: TileShape, r: number): THREE.Shape {
  const s = new THREE.Shape()
  switch (shape) {
    case "cylinder": {
      s.absarc(0, 0, r, 0, Math.PI * 2, false)
      break
    }
    case "hexagon": {
      // Flat-top hexagon nested for honeycomb packing.
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 180) * (60 * i)
        const x = r * Math.cos(a)
        const y = r * Math.sin(a)
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
        const px = x * scale
        const py = y * scale
        if (i === 0) s.moveTo(px, py)
        else s.lineTo(px, py)
      }
      s.closePath()
      break
    }
    case "square":
    default: {
      s.moveTo(-r, -r)
      s.lineTo(r, -r)
      s.lineTo(r, r)
      s.lineTo(-r, r)
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
  const r = tileSize / 2 - TILE_CLEARANCE_MM
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

/**
 * Pocket "well" ring (the routed-out wall around each pocket) for the waffle tray.
 * Outer footprint = full pitch cell, inner hole = tile footprint + slack.
 */
export function createPocketRingGeometry(
  shape: TileShape,
  pitch: number,
  tileSize: number,
  depth: number,
): THREE.BufferGeometry {
  const outer = buildShape(shape, pitch / 2)
  const inner = buildShape(shape, tileSize / 2 + TILE_CLEARANCE_MM)
  outer.holes.push(inner)
  const geo = new THREE.ExtrudeGeometry(outer, {
    depth,
    bevelEnabled: false,
    curveSegments: shape === "cylinder" || shape === "heart" ? 24 : 6,
  })
  layFlat(geo)
  geo.translate(0, depth, 0)
  geo.computeVertexNormals()
  return geo
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
export function buildPuzzleGroup(
  layout: GridLayout,
  palette: PaletteColor[],
  embossing: EmbossingStyle,
): SceneBuildResult {
  const group = new THREE.Group()
  const disposables: { dispose: () => void }[] = []
  const track = <T extends { dispose: () => void }>(o: T): T => {
    disposables.push(o)
    return o
  }

  const count = layout.placements.length
  const trayColor = new THREE.Color("#cbd5e1")

  const floorThickness = layout.baseHeight - layout.pocketDepth

  // --- Base slab ---
  const baseGeo = track(
    new THREE.BoxGeometry(layout.boardWidth, floorThickness, layout.boardDepth),
  )
  const baseMat = track(
    new THREE.MeshStandardMaterial({ color: trayColor, roughness: 0.9, metalness: 0.02 }),
  )
  const base = new THREE.Mesh(baseGeo, baseMat)
  base.position.y = floorThickness / 2
  base.receiveShadow = true
  base.castShadow = true
  group.add(base)

  // --- Pocket rings (routed voids) as one InstancedMesh ---
  const ringGeo = track(
    createPocketRingGeometry(layout.shape, layout.pitch, layout.tileSize, layout.pocketDepth),
  )
  const ringMat = track(
    new THREE.MeshStandardMaterial({ color: trayColor, roughness: 0.92, metalness: 0.02 }),
  )
  const rings = new THREE.InstancedMesh(ringGeo, ringMat, count)
  rings.castShadow = true
  rings.receiveShadow = true
  const m = new THREE.Matrix4()
  for (let i = 0; i < count; i++) {
    const p = layout.placements[i]
    m.makeTranslation(p.worldX, floorThickness, p.worldZ)
    rings.setMatrixAt(i, m)
  }
  rings.instanceMatrix.needsUpdate = true
  group.add(rings)

  // --- Tiles, grouped per palette color into one InstancedMesh each ---
  const tileGeo = track(createTileGeometry(layout.shape, layout.tileSize, layout.tileHeight))
  const floorY = floorThickness
  const byColor = new Map<number, number[]>()
  for (let i = 0; i < count; i++) {
    const ci = layout.placements[i].colorIndex
    if (!byColor.has(ci)) byColor.set(ci, [])
    byColor.get(ci)!.push(i)
  }

  for (const [colorIndex, indices] of byColor) {
    const pal = palette[colorIndex]
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
      m.makeTranslation(p.worldX, floorY, p.worldZ)
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
    const decalY = raised
      ? floorY + layout.tileHeight + 0.05
      : floorY + 0.06
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
