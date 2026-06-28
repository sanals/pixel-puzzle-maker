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
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js"

// Helper to prevent UI freezing during heavy processing
const yieldToMain = () => new Promise<void>(resolve => setTimeout(resolve, 0))

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
  options: { packTilesAtOrigin?: boolean; bedWidth?: number, onProgress?: (msg: string, percent?: number) => void } = {}
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
      if (!pal.label || pal.ignored) continue
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
      if (options.onProgress) {
        options.onProgress(`Embossing tray ${x * numBoardsZ + z + 1} of ${numBoardsX * numBoardsZ}...`, ((x * numBoardsZ + z) / (numBoardsX * numBoardsZ)) * 100)
      }
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

            await yieldToMain()
            const result = localEvaluator.evaluate(baseBrush, textBrush, textOp)
            await yieldToMain()

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
  const bedWidth = options.bedWidth || 256
  // Leave ~25mm safety margin for prime lines and purge tower space
  const maxSafeWidth = bedWidth - 25
  const MAX_COLS = Math.max(1, Math.floor(maxSafeWidth / layout.pitch))
  const MAX_PER_PLATE = MAX_COLS * MAX_COLS

  for (const [colorIndex, pal] of palette.entries()) {
    if (pal.ignored) continue
    
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
    const bbox = masterAssets.connector.boundingBox!
    const sizeX = bbox.max.x - bbox.min.x
    const sizeZ = bbox.max.z - bbox.min.z
    const gapX = sizeX + 3
    const gapZ = sizeZ + 3

    const bedWidth = options.bedWidth || 256
    const maxSafeWidth = bedWidth - 25
    const maxPerRow = Math.max(1, Math.floor(maxSafeWidth / gapX))
    const actualPerRow = Math.min(split.connectorCount, maxPerRow)

    const startX = layout.boardWidth / 2 + gapX
    for (let i = 0; i < split.connectorCount; i++) {
      const row = Math.floor(i / actualPerRow)
      const col = i % actualPerRow
      const m = new THREE.Matrix4()
      m.makeTranslation(startX + col * gapX, layout.pitch * 0.15, row * gapZ)
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

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/** Build a multi-material .3MF (zip + XML) with native per-object color materials. */
export async function build3MF(assets: ExportAssets, options: { bedWidth?: number, bedId?: string, onProgress?: (msg: string, percent?: number) => void } = {}): Promise<Blob> {
  if (options?.onProgress) options.onProgress("Generating 3MF geometry...", 0)
  const { bambuProjectSettings } = await import("./bambu-project-settings");
  const zip = new JSZip()
  const groups = [...assets.trays, ...assets.tiles, ...assets.texts]
  if (assets.connectors) groups.push(assets.connectors)

  const uniqueColors: string[] = []
  groups.forEach(g => {
    if (!uniqueColors.includes(g.color)) {
      uniqueColors.push(g.color)
    }
  })

  const colorEntries = uniqueColors
    .map((c) => `      <m:color color="${hexToTriplet(c)}"/>`)
    .join("\n")

  const objects: string[] = []
  const buildItems: string[] = []

  const modelSettingsObjects: string[] = []
  const plateConfigs: string[] = []

  const plateSize = options.bedWidth || 256
  const PLATE_SPACING = plateSize * 1.2

  const numPlates = groups.length
  const columns = Math.ceil(Math.sqrt(numPlates))

  let nextObjectId = 2 // 1 is reserved for basematerials

  for (let plateIdx = 0; plateIdx < groups.length; plateIdx++) {
    if (options?.onProgress) options.onProgress(`Processing object ${plateIdx + 1}/${groups.length}...`, (plateIdx / groups.length) * 100)
    const grp = groups[plateIdx]
    const col = plateIdx % columns
    const row = Math.floor(plateIdx / columns)

    // Force the source geometry to be non-indexed so mergeBufferGeometries doesn't complain about mixed attributes
    let sourceGeo = grp.geometry
    if (sourceGeo.index) sourceGeo = sourceGeo.toNonIndexed()

    // Keep only position to avoid merge issues
    const attrs = Object.keys(sourceGeo.attributes)
    attrs.forEach(key => {
      if (key !== 'position') sourceGeo.deleteAttribute(key)
    })

    if (grp.instances.length === 0) continue

    // 2. Weld all perfectly touching faces together to satisfy Bambu Studio
    await yieldToMain()
    let exportGeo = BufferGeometryUtils.mergeVertices(sourceGeo, 1e-4)

    const p = exportGeo.getAttribute("position")
    const verts: string[] = []
    const tris: string[] = []

    for (let i = 0; i < p.count; i++) {
      verts.push(`<vertex x="${fmt(p.getX(i))}" y="${fmt(-p.getZ(i))}" z="${fmt(p.getY(i))}"/>`)
      if (i > 0 && i % 50000 === 0) await yieldToMain()
    }

    await yieldToMain()
    const colorIndex = uniqueColors.indexOf(grp.color)
    const index = exportGeo.index!
    for (let i = 0; i < index.count; i += 3) {
      tris.push(`<triangle v1="${index.getX(i)}" v2="${index.getX(i + 1)}" v3="${index.getX(i + 2)}" pid="1" p1="${colorIndex}"/>`)
      if (i > 0 && i % 50000 === 0) await yieldToMain()
    }

    const baseId = nextObjectId++

    objects.push(
      `    <object id="${baseId}" p:UUID="${generateUUID()}" type="model">\n` +
      `      <mesh>\n` +
      `        <vertices>${verts.join("")}</vertices>\n` +
      `        <triangles>${tris.join("")}</triangles>\n` +
      `      </mesh>\n` +
      `    </object>`
    )

    exportGeo.computeBoundingBox()
    const bbox = exportGeo.boundingBox!
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    
    // We only need 4 corners of the XZ bounding box since we only care about X and Z centering
    const corners = [
      new THREE.Vector3(bbox.min.x, 0, bbox.min.z),
      new THREE.Vector3(bbox.max.x, 0, bbox.min.z),
      new THREE.Vector3(bbox.min.x, 0, bbox.max.z),
      new THREE.Vector3(bbox.max.x, 0, bbox.max.z)
    ]

    const groupId = nextObjectId++
    const components: string[] = []
    for (let i = 0; i < grp.instances.length; i++) {
      const e = grp.instances[i].elements

      for (const corner of corners) {
        const v = corner.clone().applyMatrix4(grp.instances[i])
        if (v.x < minX) minX = v.x
        if (v.x > maxX) maxX = v.x
        if (v.z < minZ) minZ = v.z
        if (v.z > maxZ) maxZ = v.z
      }

      // ThreeJS Matrix4 is column-major.
      // Convert to 3MF Transform string, mapping Y-up to Z-up: X3=X, Y3=-Z, Z3=Y
      const tStr = [
        e[0], -e[2], e[1],
        -e[8], e[10], -e[9],
        e[4], -e[6], e[5],
        e[12], -e[14], e[13]
      ].map(fmt).join(" ")
      
      components.push(`        <component objectid="${baseId}" transform="${tStr}"/>`)
      if (i > 0 && i % 5000 === 0) await yieldToMain()
    }
    
    objects.push(
      `    <object id="${groupId}" p:UUID="${generateUUID()}" type="model">\n` +
      `      <components>\n` +
      components.join("\n") +
      `\n      </components>\n` +
      `    </object>`
    )

    const cx = (minX + maxX) / 2
    const cz = (minZ + maxZ) / 2

    const globalX = col * PLATE_SPACING
    const globalY = -row * PLATE_SPACING
    const itemX = globalX + plateSize / 2 - cx
    const itemY = globalY + plateSize / 2 + cz
    buildItems.push(`    <item objectid="${groupId}" p:UUID="${generateUUID()}" transform="1 0 0 0 1 0 0 0 1 ${itemX} ${itemY} 0" printable="1"/>`)

    const cleanName = grp.name.replace(/[^a-zA-Z0-9_\- ]/g, "")

    const extruderIndex = uniqueColors.indexOf(grp.color) + 1
    modelSettingsObjects.push(`
  <object id="${groupId}">
    <metadata key="name" value="${cleanName}"/>
    <metadata key="extruder" value="${extruderIndex}"/>
    <part id="${groupId}" subtype="normal_part">
      <metadata key="name" value="${cleanName}"/>
      <metadata key="matrix" value="1 0 0 ${plateSize / 2} 0 1 0 ${plateSize / 2} 0 0 1 0 0 0 0 1"/>
      <metadata key="source_file" value="${cleanName}.model"/>
      <metadata key="source_object_id" value="0"/>
      <metadata key="source_volume_id" value="0"/>
      <metadata key="source_offset_x" value="0"/>
      <metadata key="source_offset_y" value="0"/>
      <metadata key="source_offset_z" value="0"/>
    </part>
  </object>`)

    plateConfigs.push(`
  <plate>
    <metadata key="plater_id" value="${plateIdx + 1}"/>
    <metadata key="plater_name" value="${cleanName}"/>
    <metadata key="locked" value="false"/>
    <model_instance>
      <metadata key="object_id" value="${groupId}"/>
      <metadata key="instance_id" value="0"/>
    </model_instance>
  </plate>`)
  }

  const modelChunks: string[] = []
  modelChunks.push(
    `<?xml version="1.0" encoding="UTF-8"?>\n`,
    `<model unit="millimeter" xml:lang="en-US"\n`,
    `  xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"\n`,
    `  xmlns:p="http://schemas.bambulab.com/package/2021"\n`,
    `  xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02"\n`,
    `  requiredextensions="p">\n`,
    `  <metadata name="Application">BambuStudio-02.06.00.51</metadata>\n`,
    `  <metadata name="BambuStudio:3mfVersion">1</metadata>\n`,
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

  const modelSettingsXml = `<?xml version="1.0" encoding="UTF-8"?>
<config>${modelSettingsObjects.join("")}${plateConfigs.join("")}
  <assemble>
  </assemble>
</config>`

  const colorsArray = uniqueColors.length > 0
    ? uniqueColors.map(c => `${c}FF`)
    : ["#CCCCCCFF"]

  const baseConfig = JSON.parse(bambuProjectSettings)

  const originalCount = baseConfig.filament_colour.length;
  const newCount = Math.max(1, colorsArray.length);

  for (const key of Object.keys(baseConfig)) {
    if (Array.isArray(baseConfig[key]) && baseConfig[key].length === originalCount) {
      if (newCount <= originalCount) {
        baseConfig[key] = baseConfig[key].slice(0, newCount);
      } else {
        const arr = [...baseConfig[key]];
        while (arr.length < newCount) {
          arr.push(arr[0]);
        }
        baseConfig[key] = arr;
      }
    }
  }

  baseConfig.filament_colour = colorsArray
  baseConfig.filament_map = uniqueColors.map((_, i) => (i + 1).toString())


  if (options.bedId === "bambu-mini") {
    baseConfig["printer_model"] = "Bambu Lab A1 mini"
    baseConfig["printer_settings_id"] = "Bambu Lab A1 mini 0.4 nozzle"
    baseConfig["default_print_profile"] = "0.20mm Standard @BBL A1M"
  } else {
    baseConfig["printer_model"] = "Bambu Lab A1"
    baseConfig["printer_settings_id"] = "Bambu Lab A1 0.4 nozzle"
    baseConfig["default_print_profile"] = "0.20mm Standard @BBL A1"
  }

  const projectSettingsXml = JSON.stringify(baseConfig, null, 2)

  const sliceInfoXml = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <header>
    <header_item key="X-BBL-Client-Type" value="slicer"/>
    <header_item key="X-BBL-Client-Version" value="1.9.1.66"/>
  </header>
</config>`

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n` +
    `  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n` +
    `  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>\n` +
    `  <Default Extension="config" ContentType="text/xml"/>\n` +
    `</Types>\n`

  const rels =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n` +
    `  <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n` +
    `  <Relationship Target="/Metadata/model_settings.config" Id="rel-2" Type="http://schemas.bambulab.com/package/2021/model_settings"/>\n` +
    `  <Relationship Target="/Metadata/project_settings.config" Id="rel-3" Type="http://schemas.bambulab.com/package/2021/project_settings"/>\n` +
    `  <Relationship Target="/Metadata/slice_info.config" Id="rel-4" Type="http://schemas.bambulab.com/package/2021/slice_info"/>\n` +
    `</Relationships>\n`

  zip.file("[Content_Types].xml", contentTypes)
  zip.folder("_rels")!.file(".rels", rels)
  zip.folder("3D")!.file("3dmodel.model", modelBlob)

  zip.folder("Metadata")!.file("model_settings.config", modelSettingsXml)
  zip.folder("Metadata")!.file("project_settings.config", projectSettingsXml)
  zip.folder("Metadata")!.file("slice_info.config", sliceInfoXml)

  if (options?.onProgress) options.onProgress("Compressing ZIP...", 0)

  return zip.generateAsync({ 
    type: "blob", 
    mimeType: "application/zip",
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  }, (metadata) => {
    if (options?.onProgress) options.onProgress(`Compressing ZIP...`, metadata.percent)
  })
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
async function buildBaked3MF(meshes: BakedMesh[], options?: { onProgress?: (msg: string, percent?: number) => void }): Promise<Blob> {
  const verts: string[] = []
  const tris: string[] = []
  let vertIndex = 0

  for (const m of meshes) {
    const p = m.positions
    for (let i = 0; i < p.length; i += 9) {
      verts.push(`<vertex x="${fmt(p[i])}" y="${fmt(p[i + 1])}" z="${fmt(p[i + 2])}"/>`)
      verts.push(`<vertex x="${fmt(p[i + 3])}" y="${fmt(p[i + 4])}" z="${fmt(p[i + 5])}"/>`)
      verts.push(`<vertex x="${fmt(p[i + 6])}" y="${fmt(p[i + 7])}" z="${fmt(p[i + 8])}"/>`)
      tris.push(`<triangle v1="${vertIndex}" v2="${vertIndex + 1}" v3="${vertIndex + 2}" pid="1" p1="0"/>`)
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
  
  if (options?.onProgress) options.onProgress("Compressing 3MF...", 0)
  
  return zip.generateAsync({ 
    type: "blob", 
    mimeType: "model/3mf",
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  }, (metadata) => {
    if (options?.onProgress) options.onProgress(`Compressing 3MF...`, metadata.percent)
  })
}

/** Bundle 3MF files into a ZIP (ideal for printing color-by-color separated plates). */
export async function build3MFZip(assets: ExportAssets, options?: { onProgress?: (msg: string, percent?: number) => void }): Promise<Blob> {
  const zip = new JSZip()

  // Base trays
  for (let i = 0; i < assets.trays.length; i++) {
    const trayExport = assets.trays[i]

    const trayAssets: ExportAssets = {
      trays: [trayExport],
      tiles: [],
      texts: [],
      connectors: null,
    }

    if (options?.onProgress) options.onProgress(`Generating plate ${trayExport.name}...`, (i / assets.trays.length) * 50)
    const base3mf = await build3MF(trayAssets, options)
    const label = `1_Plate_${trayExport.name}.3mf`
    zip.file(label, base3mf)
  }

  // Tiles separated by color
  for (let i = 0; i < assets.tiles.length; i++) {
    const t = assets.tiles[i]
    const maxPerPlate = 30 * 30

      if (options?.onProgress) options.onProgress(`Generating color plate ${t.name}...`, 50 + (i / assets.tiles.length) * 50)
      if (t.instances.length <= maxPerPlate) {
        const tileAssets: ExportAssets = {
          trays: [],
          tiles: [t],
          texts: [],
          connectors: null,
        }
        const t3mf = await build3MF(tileAssets, options)
        zip.file(`2_Plate_Tiles_${t.color.replace("#", "")}.3mf`, t3mf)
      } else {
        let chunkIdx = 1
        for (let j = 0; j < t.instances.length; j += maxPerPlate) {
          const chunkInstances = t.instances.slice(j, j + maxPerPlate)
          const chunkExport: InstancedExport = { ...t, instances: chunkInstances }
          const tileAssets: ExportAssets = {
            trays: [],
            tiles: [chunkExport],
            texts: [],
            connectors: null,
          }
          const t3mf = await build3MF(tileAssets, options)
          zip.file(`2_Plate_Tiles_${t.color.replace("#", "")}_Part${chunkIdx}.3mf`, t3mf)
          chunkIdx++
        }
      }
    }
  
    // Connectors
    if (assets.connectors) {
      const connectorAssets: ExportAssets = {
        trays: [],
        tiles: [],
        texts: [],
        connectors: assets.connectors,
      }
      const c3mf = await build3MF(connectorAssets, options)
      zip.file("3_Plate_Connectors.3mf", c3mf)
    }
    
    if (options?.onProgress) options.onProgress("Compressing ZIP...", 0)
  
    return zip.generateAsync({ 
      type: "blob",
      mimeType: "application/zip",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    }, (metadata) => {
      if (options?.onProgress) options.onProgress(`Compressing ZIP...`, metadata.percent)
    })
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
  // Increase timeout to 5 minutes so users with large files or slow disks don't get NotReadableError
  setTimeout(() => URL.revokeObjectURL(url), 300000)
}
