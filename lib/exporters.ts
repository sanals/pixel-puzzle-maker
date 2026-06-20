// Phase 6: Production 3MF & ZIP binary exporters.

import JSZip from "jszip"
import * as THREE from "three"
import type { SplitPlan } from "./board-splitter"
import { createConnectorPegGeometry } from "./board-splitter"
import { createPocketRingGeometry, createTileGeometry } from "./geometry-generators"
import type { GridLayout } from "./grid-engine"
import type { PaletteColor } from "./types"

const TRAY_COLOR = "#cbd5e1"

/** A baked, world-space triangle soup tagged with a color + name. */
interface BakedMesh {
  name: string
  color: string
  positions: number[] // flat xyz, Z-up convention
}

/** Append a geometry's triangles to a baked mesh, applying a transform.
 *  Converts the engine's Y-up space into a print-friendly Z-up space. */
function bake(geo: THREE.BufferGeometry, matrix: THREE.Matrix4, target: BakedMesh): void {
  const g = geo.index ? geo.toNonIndexed() : geo.clone()
  g.applyMatrix4(matrix)
  const pos = g.getAttribute("position")
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    // Y-up -> Z-up: (x, y, z) => (x, z, y)
    target.positions.push(x, z, y)
  }
  g.dispose()
}

function newMesh(name: string, color: string): BakedMesh {
  return { name, color, positions: [] }
}

/** Bounds of a subset of placements (cells within a sub-board range). */
function subBoardBounds(
  layout: GridLayout,
  range: { col0: number; col1: number; row0: number; row1: number },
) {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  const indices: number[] = []
  layout.placements.forEach((p, i) => {
    if (p.gx >= range.col0 && p.gx < range.col1 && p.gy >= range.row0 && p.gy < range.row1) {
      indices.push(i)
      minX = Math.min(minX, p.worldX)
      maxX = Math.max(maxX, p.worldX)
      minZ = Math.min(minZ, p.worldZ)
      maxZ = Math.max(maxZ, p.worldZ)
    }
  })
  return { indices, minX, maxX, minZ, maxZ }
}

export interface ExportAssets {
  /** Tray sub-boards (one mesh each). */
  trays: BakedMesh[]
  /** Tiles grouped per palette color. */
  tiles: BakedMesh[]
  /** Optional connector pegs mesh. */
  connectors: BakedMesh | null
}

/** Build all baked geometry for export, honoring any board split plan. */
export function assembleExportAssets(
  layout: GridLayout,
  palette: PaletteColor[],
  split: SplitPlan,
): ExportAssets {
  const ringGeo = createPocketRingGeometry(
    layout.shape,
    layout.pitch,
    layout.tileSize,
    layout.pocketDepth,
  )
  const tileGeo = createTileGeometry(layout.shape, layout.tileSize, layout.tileHeight)
  const floorY = layout.baseHeight - layout.pocketDepth
  const tmp = new THREE.Matrix4()

  // --- Trays (per sub-board, or one if not split) ---
  const trays: BakedMesh[] = []
  for (const sb of split.subBoards) {
    const { indices, minX, maxX, minZ, maxZ } = subBoardBounds(layout, sb)
    if (indices.length === 0) continue
    const mesh = newMesh(sb.id, TRAY_COLOR)

    const w = maxX - minX + layout.pitch
    const d = maxZ - minZ + layout.pitch
    const cx = (minX + maxX) / 2
    const cz = (minZ + maxZ) / 2
    const floorThickness = layout.baseHeight - layout.pocketDepth
    const baseGeo = new THREE.BoxGeometry(w, floorThickness, d)
    tmp.makeTranslation(cx, floorThickness / 2, cz)
    bake(baseGeo, tmp, mesh)
    baseGeo.dispose()

    for (const i of indices) {
      const p = layout.placements[i]
      tmp.makeTranslation(p.worldX, floorThickness, p.worldZ)
      bake(ringGeo, tmp, mesh)
    }
    trays.push(mesh)
  }

  // --- Tiles per color ---
  const byColor = new Map<number, number[]>()
  layout.placements.forEach((p, i) => {
    if (!byColor.has(p.colorIndex)) byColor.set(p.colorIndex, [])
    byColor.get(p.colorIndex)!.push(i)
  })
  const tiles: BakedMesh[] = []
  for (const [colorIndex, idxs] of [...byColor.entries()].sort((a, b) => a[0] - b[0])) {
    const pal = palette[colorIndex]
    const mesh = newMesh(`tiles-${pal.label}`, pal.hex)
    for (const i of idxs) {
      const p = layout.placements[i]
      tmp.makeTranslation(p.worldX, floorY, p.worldZ)
      bake(tileGeo, tmp, mesh)
    }
    tiles.push(mesh)
  }

  // --- Connector pegs (only when split) ---
  let connectors: BakedMesh | null = null
  if (split.connectorCount > 0) {
    const pegGeo = createConnectorPegGeometry(layout.pitch)
    connectors = newMesh("connector-pegs", "#94a3b8")
    const perRow = Math.ceil(Math.sqrt(split.connectorCount))
    const gap = layout.pitch * 0.9
    const startX = layout.boardWidth / 2 + layout.pitch * 2
    for (let i = 0; i < split.connectorCount; i++) {
      const row = Math.floor(i / perRow)
      const col = i % perRow
      tmp.makeTranslation(startX + col * gap, layout.pitch * 0.15, row * gap)
      bake(pegGeo, tmp, connectors)
    }
    pegGeo.dispose()
  }

  ringGeo.dispose()
  tileGeo.dispose()
  return { trays, tiles, connectors }
}

/** Write a binary STL from one or more baked meshes (merged triangle soup). */
export function writeBinarySTL(meshes: BakedMesh[]): ArrayBuffer {
  let triCount = 0
  for (const m of meshes) triCount += m.positions.length / 9
  const buffer = new ArrayBuffer(84 + triCount * 50)
  const view = new DataView(buffer)
  // 80-byte header left zeroed, then triangle count.
  view.setUint32(80, triCount, true)

  let offset = 84
  const ax = new THREE.Vector3()
  const bx = new THREE.Vector3()
  const cx = new THREE.Vector3()
  const cb = new THREE.Vector3()
  const ab = new THREE.Vector3()
  for (const m of meshes) {
    const p = m.positions
    for (let i = 0; i < p.length; i += 9) {
      ax.set(p[i], p[i + 1], p[i + 2])
      bx.set(p[i + 3], p[i + 4], p[i + 5])
      cx.set(p[i + 6], p[i + 7], p[i + 8])
      cb.subVectors(cx, bx)
      ab.subVectors(ax, bx)
      cb.cross(ab).normalize()
      view.setFloat32(offset, cb.x, true)
      view.setFloat32(offset + 4, cb.y, true)
      view.setFloat32(offset + 8, cb.z, true)
      offset += 12
      for (const v of [ax, bx, cx]) {
        view.setFloat32(offset, v.x, true)
        view.setFloat32(offset + 4, v.y, true)
        view.setFloat32(offset + 8, v.z, true)
        offset += 12
      }
      view.setUint16(offset, 0, true)
      offset += 2
    }
  }
  return buffer
}

function hexToTriplet(hex: string): string {
  const h = hex.replace("#", "")
  return `#${h.padEnd(6, "0").slice(0, 6)}ff`.toUpperCase()
}

/** Build a multi-material .3MF (zip + XML) with native per-object color materials. */
export function build3MF(meshes: BakedMesh[]): Promise<Blob> {
  const zip = new JSZip()

  // Normalize so all coordinates are positive (3MF expects a positive octant).
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  for (const m of meshes) {
    const p = m.positions
    for (let i = 0; i < p.length; i += 3) {
      minX = Math.min(minX, p[i])
      minY = Math.min(minY, p[i + 1])
      minZ = Math.min(minZ, p[i + 2])
    }
  }
  const ox = isFinite(minX) ? -minX : 0
  const oy = isFinite(minY) ? -minY : 0
  const oz = isFinite(minZ) ? -minZ : 0

  const baseEntries = meshes
    .map((m) => `      <base name="${escapeXml(m.name)}" displaycolor="${hexToTriplet(m.color)}"/>`)
    .join("\n")

  const objects: string[] = []
  const buildItems: string[] = []
  meshes.forEach((m, idx) => {
    const objId = idx + 2 // 1 reserved for basematerials group
    const verts: string[] = []
    const tris: string[] = []
    const p = m.positions
    const vertCount = p.length / 3
    for (let i = 0; i < p.length; i += 3) {
      verts.push(
        `<vertex x="${fmt(p[i] + ox)}" y="${fmt(p[i + 1] + oy)}" z="${fmt(p[i + 2] + oz)}"/>`,
      )
    }
    for (let v = 0; v < vertCount; v += 3) {
      tris.push(`<triangle v1="${v}" v2="${v + 1}" v3="${v + 2}"/>`)
    }
    objects.push(
      `    <object id="${objId}" type="model" pid="1" pindex="${idx}">\n` +
        `      <mesh>\n` +
        `        <vertices>${verts.join("")}</vertices>\n` +
        `        <triangles>${tris.join("")}</triangles>\n` +
        `      </mesh>\n` +
        `    </object>`,
    )
    buildItems.push(`    <item objectid="${objId}"/>`)
  })

  const model =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<model unit="millimeter" xml:lang="en"\n` +
    `  xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"\n` +
    `  xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">\n` +
    `  <resources>\n` +
    `    <basematerials id="1">\n${baseEntries}\n    </basematerials>\n` +
    `${objects.join("\n")}\n` +
    `  </resources>\n` +
    `  <build>\n${buildItems.join("\n")}\n  </build>\n` +
    `</model>\n`

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n` +
    `  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n` +
    `  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>\n` +
    `</Types>\n`

  const rels =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n` +
    `  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n` +
    `</Relationships>\n`

  zip.file("[Content_Types].xml", contentTypes)
  zip.folder("_rels")!.file(".rels", rels)
  zip.folder("3D")!.file("3dmodel.model", model)
  return zip.generateAsync({ type: "blob", mimeType: "model/3mf" })
}

function fmt(n: number): string {
  return Number(n.toFixed(4)).toString()
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === '"' ? "&quot;" : "&apos;",
  )
}

/** Bundle STL files (per sub-board, per-color tiles, connectors) into a ZIP. */
export function buildStlZip(assets: ExportAssets): Promise<Blob> {
  const zip = new JSZip()
  const trayFolder = zip.folder("trays")!
  if (assets.trays.length === 1) {
    zip.file("tray.stl", writeBinarySTL([assets.trays[0]]))
  } else {
    for (const tray of assets.trays) {
      trayFolder.file(`${tray.name}.stl`, writeBinarySTL([tray]))
    }
  }
  const tileFolder = zip.folder("tiles")!
  for (const t of assets.tiles) {
    tileFolder.file(`${t.name}.stl`, writeBinarySTL([t]))
  }
  if (assets.connectors) {
    zip.file("connector-pegs.stl", writeBinarySTL([assets.connectors]))
  }
  const readme =
    "Pixel Puzzle Maker — STL package\n\n" +
    "trays/   : tray sub-boards (snap-fit edges)\n" +
    "tiles/   : color-sorted tile batches\n" +
    "connector-pegs.stl : bow-tie keys bridging split boards\n\n" +
    "Tiles include a 0.2mm clearance for a free drop-fit.\n"
  zip.file("README.txt", readme)
  return zip.generateAsync({ type: "blob" })
}

/** Trigger a browser download for a Blob/ArrayBuffer. */
export function downloadBlob(data: Blob | ArrayBuffer, filename: string): void {
  const blob = data instanceof Blob ? data : new Blob([data])
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
