// Phase 6: Production 3MF & ZIP binary exporters.

import JSZip from "jszip"
import * as THREE from "three"
import type { SplitPlan } from "./board-splitter"
import { createConnectorPegGeometry } from "./board-splitter"
import { createTrayGeometry, createTileGeometry, getFont } from "./geometry-generators"
import type { GridLayout } from "./grid-engine"
import type { EmbossingStyle, PaletteColor } from "./types"
import { Brush, Evaluator, SUBTRACTION, ADDITION } from "three-bvh-csg"
import { mergeBufferGeometries, TextGeometry } from "three-stdlib"

const TRAY_COLOR = "#cbd5e1"

/** A template mesh with a list of instance transforms. */
export interface InstancedExport {
  name: string
  color: string
  geometry: THREE.BufferGeometry
  instances: THREE.Matrix4[]
}

/** Legacy baked mesh format for ZIP STL generation */
interface BakedMesh {
  name: string
  color: string
  positions: number[] 
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
  trays: InstancedExport[]
  tiles: InstancedExport[]
  connectors: InstancedExport | null
  texts: InstancedExport[]
}

import { loadMasterAssets } from "./geometry-generators"

/** Build all instanced geometry for export. */
export async function assembleExportAssets(
  layout: GridLayout,
  palette: PaletteColor[],
  split: SplitPlan,
  embossing: EmbossingStyle,
  options: { packTilesAtOrigin?: boolean } = {}
): Promise<ExportAssets> {
  const floorY = layout.baseHeight - layout.pocketDepth
  const tmp = new THREE.Matrix4()
  const font = await getFont()
  const masterAssets = await loadMasterAssets(layout.basePlateSize)

  const trays: InstancedExport[] = []
  const texts: InstancedExport[] = []

  // --- Trays & Text Embossing ---
  const TRAY_SIZE = layout.basePlateSize * layout.pitch
  const numBoardsX = Math.ceil(layout.boardWidth / TRAY_SIZE)
  const numBoardsZ = Math.ceil(layout.boardDepth / TRAY_SIZE)
  
  const bbox = masterAssets.base.boundingBox!
  const cx = (bbox.max.x + bbox.min.x) / 2
  const cz = (bbox.max.z + bbox.min.z) / 2
  
  const textDepth = 0.6 // Use 0.6 to give 0.3mm embossing/debossing
  const fontSize = layout.tileSize * 0.4
  const floorThickness = layout.baseHeight - layout.pocketDepth
  const ty = floorThickness // Centers the text exactly on the floor surface
  const textOp = embossing === "raised" ? ADDITION : SUBTRACTION

  // Pre-generate all text geometries for each placement in world space
  const placementTexts: THREE.BufferGeometry[] = []
  if (embossing !== "none") {
    for (const [colorIndex, pal] of palette.entries()) {
      if (!pal.label) continue
      const textGeo = new TextGeometry(pal.label, {
        font, size: fontSize, height: textDepth, curveSegments: 2, bevelEnabled: false
      })
      textGeo.deleteAttribute('uv')
      textGeo.center()
      textGeo.rotateX(-Math.PI / 2)
      
      layout.placements.forEach((p, i) => {
        if (p.colorIndex === colorIndex) {
          const tGeo = textGeo.clone()
          tGeo.translate(p.worldX, ty, p.worldZ)
          placementTexts[i] = tGeo
        }
      })
    }
  }

  // Generate Boards (CSG merged if text is present)
  const baseNonIdx = masterAssets.base.index ? masterAssets.base.toNonIndexed() : masterAssets.base.clone()
  const localEvaluator = new Evaluator()
  localEvaluator.useGroups = false
  localEvaluator.attributes = ['position', 'normal']

  for (let x = 0; x < numBoardsX; x++) {
    for (let z = 0; z < numBoardsZ; z++) {
      const totalW = numBoardsX * TRAY_SIZE
      const totalD = numBoardsZ * TRAY_SIZE
      const px = -totalW / 2 + (x * TRAY_SIZE) + (TRAY_SIZE / 2) - cx
      const pz = -totalD / 2 + (z * TRAY_SIZE) + (TRAY_SIZE / 2) - cz
      const mTray = new THREE.Matrix4()
      mTray.makeTranslation(px, 0, pz)

      let finalGeo = masterAssets.base
      
      if (embossing !== "none") {
        // Find which texts fall into this tray's bounding box
        const minX = px + cx - TRAY_SIZE / 2 - 1
        const maxX = px + cx + TRAY_SIZE / 2 + 1
        const minZ = pz + cz - TRAY_SIZE / 2 - 1
        const maxZ = pz + cz + TRAY_SIZE / 2 + 1
        
        const localTextGeos: THREE.BufferGeometry[] = []
        layout.placements.forEach((p, i) => {
          if (placementTexts[i] && p.worldX >= minX && p.worldX <= maxX && p.worldZ >= minZ && p.worldZ <= maxZ) {
            localTextGeos.push(placementTexts[i])
          }
        })
        
        if (localTextGeos.length > 0) {
          const textMerged = mergeBufferGeometries(localTextGeos)
          if (textMerged) {
            const textBrush = new Brush(textMerged)
            textBrush.updateMatrixWorld()
            
            const baseBrush = new Brush(baseNonIdx)
            baseBrush.applyMatrix4(mTray)
            baseBrush.updateMatrixWorld()
            
            const result = localEvaluator.evaluate(baseBrush, textBrush, textOp)
            
            // Revert back to local origin so the instance matrix works seamlessly
            const invTray = mTray.clone().invert()
            result.geometry.applyMatrix4(invTray)
            result.geometry.computeVertexNormals()
            finalGeo = result.geometry
          }
        }
      }
      
      trays.push({
        name: numBoardsX * numBoardsZ === 1 ? "Board" : `Board_${x + 1}_${z + 1}`,
        color: TRAY_COLOR,
        geometry: finalGeo,
        instances: [mTray],
      })
    }
  }

  // --- Tiles ---
  const tiles: InstancedExport[] = []
  const MAX_COLS = 26 // 26 * 8.75 = 227.5mm (comfortably fits on 256x256 plate)
  const MAX_PER_PLATE = MAX_COLS * MAX_COLS

  for (const [colorIndex, pal] of palette.entries()) {
    const indices = layout.placements
      .map((p, i) => (p.colorIndex === colorIndex ? i : -1))
      .filter((i) => i !== -1)
    if (indices.length === 0) continue

    // Chunk into separate plates if there are too many tiles
    for (let chunkStart = 0; chunkStart < indices.length; chunkStart += MAX_PER_PLATE) {
      const chunkIndices = indices.slice(chunkStart, chunkStart + MAX_PER_PLATE)
      const tileInstances: THREE.Matrix4[] = []
      
      const numCols = Math.min(MAX_COLS, chunkIndices.length)
      const numRows = Math.ceil(chunkIndices.length / MAX_COLS)
      const totalW = (numCols - 1) * layout.pitch
      const totalD = (numRows - 1) * layout.pitch
      const startX = -totalW / 2
      const startZ = -totalD / 2

      for (let localIdx = 0; localIdx < chunkIndices.length; localIdx++) {
        const p = layout.placements[chunkIndices[localIdx]]
        const m = new THREE.Matrix4()
        
        if (options.packTilesAtOrigin) {
          const col = localIdx % MAX_COLS
          const row = Math.floor(localIdx / MAX_COLS)
          // Center the grid perfectly around the origin
          m.makeTranslation(startX + col * layout.pitch, 3.6, startZ + row * layout.pitch)
        } else {
          m.makeTranslation(p.worldX, floorY + 3.6, p.worldZ)
        }
        tileInstances.push(m)
      }

      const partSuffix = indices.length > MAX_PER_PLATE ? `_Part_${Math.floor(chunkStart / MAX_PER_PLATE) + 1}` : ""
      tiles.push({
        name: `Tiles_${pal.label}${partSuffix}`,
        color: pal.hex,
        geometry: masterAssets.block,
        instances: tileInstances
      })
    }
  }

  let connectors: InstancedExport | null = null
  if (split.connectorCount > 0 && masterAssets.connector) {
    const connectorInstances: THREE.Matrix4[] = []
    const perRow = Math.ceil(Math.sqrt(split.connectorCount))
    const gap = layout.pitch * 0.9
    const startX = layout.boardWidth / 2 + layout.pitch * 2
    for (let i = 0; i < split.connectorCount; i++) {
      const row = Math.floor(i / perRow)
      const col = i % perRow
      const m = new THREE.Matrix4()
      m.makeTranslation(startX + col * gap, layout.pitch * 0.15, row * gap)
      connectorInstances.push(m)
    }
    connectors = {
      name: "Connectors",
      color: "#888888",
      geometry: masterAssets.connector,
      instances: connectorInstances
    }
  }

  return { trays, tiles, connectors, texts }
}

/** Helper to bake instances into a flat triangle soup array for ZIP export */
function bakeInstances(exp: InstancedExport): BakedMesh {
  const geo = exp.geometry.index ? exp.geometry.toNonIndexed() : exp.geometry.clone()
  const pos = geo.getAttribute("position")
  const baked: BakedMesh = { name: exp.name, color: exp.color, positions: [] }
  
  for (const matrix of exp.instances) {
    const g = geo.clone()
    g.applyMatrix4(matrix)
    const p = g.getAttribute("position")
    for (let i = 0; i < p.count; i++) {
      // Y-up -> Z-up: +90 rot X => (x, -z, y)
      baked.positions.push(p.getX(i), -p.getZ(i), p.getY(i))
    }
  }
  return baked
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
export function build3MF(assets: ExportAssets): Promise<Blob> {
  const zip = new JSZip()
  const groups = [...assets.trays, ...assets.tiles, ...assets.texts]
  if (assets.connectors) groups.push(assets.connectors)

  // Normalize so all coordinates are positive (3MF expects a positive octant).
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  for (const grp of groups) {
    const p = grp.geometry.getAttribute("position")
    for (let i = 0; i < p.count; i++) {
      // Geometry is Y-up, but 3MF is Z-up. Wait, we are instancing! 
      // The instances matrices map world coordinates. So we find bounds in world.
      for (const m of grp.instances) {
        const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i))
        v.applyMatrix4(m)
        minX = Math.min(minX, v.x)
        minY = Math.min(minY, -v.z) // Z-up Y is -Z
        minZ = Math.min(minZ, v.y)  // Z-up Z is Y
      }
    }
  }
  const ox = isFinite(minX) && minX < 0 ? -minX : 0
  const oy = isFinite(minY) && minY < 0 ? -minY : 0
  const oz = isFinite(minZ) && minZ < 0 ? -minZ : 0

  const colorEntries = groups
    .map((g) => `      <m:color color="${hexToTriplet(g.color)}"/>`)
    .join("\n")

  const objects: string[] = []
  const components: string[] = []
  
  let nextObjectId = 2 // 1 is reserved for basematerials

  // Create an object for each geometry template
  groups.forEach((grp, idx) => {
    const templateId = nextObjectId++
    
    // Convert Y-up geometry to Z-up string
    const verts: string[] = []
    const tris: string[] = []
    const g = grp.geometry.index ? grp.geometry.toNonIndexed() : grp.geometry.clone()
    const p = g.getAttribute("position")
    const vertCount = p.count
    for (let i = 0; i < p.count; i++) {
      // Y-up -> Z-up via +90 rot X (x'=x, y'=-z, z'=y)
      verts.push(`<vertex x="${fmt(p.getX(i))}" y="${fmt(-p.getZ(i))}" z="${fmt(p.getY(i))}"/>`)
    }
    for (let v = 0; v < vertCount; v += 3) {
      tris.push(`<triangle v1="${v}" v2="${v + 1}" v3="${v + 2}" pid="1" p1="${idx}"/>`)
    }
    
    objects.push(
      `    <object id="${templateId}" type="model">\n` +
      `      <mesh>\n` +
      `        <vertices>${verts.join("")}</vertices>\n` +
      `        <triangles>${tris.join("")}</triangles>\n` +
      `      </mesh>\n` +
      `    </object>`
    )

    // Instantiate it multiple times as components of a master object
    for (const m of grp.instances) {
      const e = m.elements
      // Transform Y-up matrix to Z-up 3MF matrix string.
      const tx = e[12] + ox
      const ty = e[13] + oy
      const tz = e[14] + oz
      
      const item_tx = tx
      const item_ty = -tz
      const item_tz = ty
      
      components.push(`        <component objectid="${templateId}" transform="1 0 0 0 1 0 0 0 1 ${fmt(item_tx)} ${fmt(item_ty)} ${fmt(item_tz)}"/>`)
    }
  })

  // Group everything passed to this function into a single monolithic multi-part object
  const masterId = nextObjectId++
  objects.push(
    `    <object id="${masterId}" type="model">\n` +
    `      <components>\n` +
    components.join("\n") +
    `\n      </components>\n` +
    `    </object>`
  )

  const buildItems = [`    <item objectid="${masterId}"/>`]

  const modelChunks: string[] = []
  modelChunks.push(
    `<?xml version="1.0" encoding="UTF-8"?>\n`,
    `<model unit="millimeter" xml:lang="en-US"\n`,
    `  xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"\n`,
    `  xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02"\n`,
    `  xmlns:slic3rpe="http://schemas.slic3r.org/3mf/2017/06">\n`,
    `  <metadata name="Application">Pixel Puzzle Maker</metadata>\n`,
    `  <metadata name="Title">Puzzle Board</metadata>\n`,
    `  <metadata name="CreationDate">${new Date().toISOString().split("T")[0]}</metadata>\n`,
    `  <metadata name="slic3rpe:3mf_version">2</metadata>\n`,
    `  <resources>\n`,
    `    <m:colorgroup id="1">\n${colorEntries}\n    </m:colorgroup>\n`
  )
  
  for (const obj of objects) {
    modelChunks.push(obj, "\n")
  }

  modelChunks.push(
    `  </resources>\n`,
    `  <build>\n${buildItems.join("\n")}\n  </build>\n`,
    `</model>\n`
  )
  
  const modelBlob = new Blob(modelChunks, { type: "text/xml" })

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
  zip.folder("3D")!.file("3dmodel.model", modelBlob)
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
    trayFolder.file("tray.stl", writeBinarySTL([bakeInstances(assets.trays[0])]))
  } else {
    for (const tray of assets.trays) {
      trayFolder.file(`${tray.name}.stl`, writeBinarySTL([bakeInstances(tray)]))
    }
  }
  const tileFolder = zip.folder("tiles")!
  for (const t of assets.tiles) {
    tileFolder.file(`${t.name}.stl`, writeBinarySTL([bakeInstances(t)]))
  }
  if (assets.connectors) {
    zip.file("connector-pegs.stl", writeBinarySTL([bakeInstances(assets.connectors)]))
  }
  const readme =
    "Pixel Puzzle Maker — STL package\n\n" +
    "trays/   : tray sub-boards\n" +
    "tiles/   : color-sorted tile batches\n" +
    "connector-pegs.stl : bow-tie keys bridging split boards\n\n"
  zip.file("README.txt", readme)
  return zip.generateAsync({ type: "blob" })
}

/** Write a 3MF containing exactly one solid monolithic mesh from baked geometry. */
async function buildBaked3MF(meshes: BakedMesh[]): Promise<Blob> {
  const verts: string[] = []
  const tris: string[] = []
  let vertIndex = 0

  for (const m of meshes) {
    const p = m.positions
    for (let i = 0; i < p.length; i += 9) {
      verts.push(`<vertex x="${fmt(p[i])}" y="${fmt(p[i+1])}" z="${fmt(p[i+2])}"/>`)
      verts.push(`<vertex x="${fmt(p[i+3])}" y="${fmt(p[i+4])}" z="${fmt(p[i+5])}"/>`)
      verts.push(`<vertex x="${fmt(p[i+6])}" y="${fmt(p[i+7])}" z="${fmt(p[i+8])}"/>`)
      tris.push(`<triangle v1="${vertIndex}" v2="${vertIndex+1}" v3="${vertIndex+2}" pid="1" p1="0"/>`)
      vertIndex += 3
    }
  }

  const modelXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US"
  xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"
  xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02"
  xmlns:slic3rpe="http://schemas.slic3r.org/3mf/2017/06">
  <metadata name="Application">Pixel Puzzle Maker</metadata>
  <metadata name="slic3rpe:3mf_version">2</metadata>
  <resources>
    <m:colorgroup id="1">
      <m:color color="${meshes[0] ? hexToTriplet(meshes[0].color) : "#FFFFFFff"}"/>
    </m:colorgroup>
    <object id="2" type="model">
      <mesh>
        <vertices>${verts.join("")}</vertices>
        <triangles>${tris.join("")}</triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="2"/>
  </build>
</model>
`
  const zip = new JSZip()
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
  zip.folder("3D")!.file("3dmodel.model", modelXml)
  return zip.generateAsync({ type: "blob", mimeType: "model/3mf" })
}

/** Bundle 3MF files into a ZIP (ideal for printing color-by-color separated plates). */
export async function build3MFZip(assets: ExportAssets): Promise<Blob> {
  const zip = new JSZip()
  
  // Base trays
  if (assets.trays.length > 0) {
    const trayExport = assets.trays[0]
    for (let i = 0; i < trayExport.instances.length; i++) {
      const m = trayExport.instances[i]
      const tx = m.elements[12]
      const tz = m.elements[14]
      
      const minX = tx - 112 - 1
      const maxX = tx + 112 + 1
      const minZ = tz - 112 - 1
      const maxZ = tz + 112 + 1
      
      const localTexts: InstancedExport[] = []
      for (const textGrp of assets.texts) {
        const localInstances: THREE.Matrix4[] = []
        for (const tm of textGrp.instances) {
          const ttx = tm.elements[12]
          const ttz = tm.elements[14]
          if (ttx >= minX && ttx <= maxX && ttz >= minZ && ttz <= maxZ) {
            localInstances.push(tm)
          }
        }
        if (localInstances.length > 0) {
          localTexts.push({ ...textGrp, instances: localInstances })
        }
      }
      
      const meshes: BakedMesh[] = [bakeInstances({ ...trayExport, instances: [m] })]
      for (const textGrp of localTexts) {
        meshes.push(bakeInstances(textGrp))
      }
      
      const base3mf = await buildBaked3MF(meshes)
      const label = trayExport.instances.length === 1 ? "1_Plate_Board.3mf" : `1_Plate_Board_${i + 1}.3mf`
      zip.file(label, base3mf)
    }
  }
  
  // Tiles separated by color
  for (let i = 0; i < assets.tiles.length; i++) {
    const t = assets.tiles[i]
    const maxPerPlate = 30 * 30
    
    if (t.instances.length <= maxPerPlate) {
      const t3mf = await buildBaked3MF([bakeInstances(t)])
      zip.file(`2_Plate_Tiles_${t.color.replace("#", "")}.3mf`, t3mf)
    } else {
      let chunkIdx = 1
      for (let j = 0; j < t.instances.length; j += maxPerPlate) {
        const chunkInstances = t.instances.slice(j, j + maxPerPlate)
        const chunkExport: InstancedExport = { ...t, instances: chunkInstances }
        const t3mf = await buildBaked3MF([bakeInstances(chunkExport)])
        zip.file(`2_Plate_Tiles_${t.color.replace("#", "")}_Part${chunkIdx}.3mf`, t3mf)
        chunkIdx++
      }
    }
  }
  
  // Connectors
  if (assets.connectors) {
    const c3mf = await buildBaked3MF([bakeInstances(assets.connectors)])
    zip.file("3_Plate_Connectors.3mf", c3mf)
  }
  
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
