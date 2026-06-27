const fs = require('fs')

const newFunction = `function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/** Build a multi-material .3MF (zip + XML) with native per-object color materials. */
export async function build3MF(assets: ExportAssets): Promise<Blob> {
  const { bambuProjectSettings } = await import("./bambu-project-settings");
  const zip = new JSZip()
  const groups = [...assets.trays, ...assets.tiles, ...assets.texts]
  if (assets.connectors) groups.push(assets.connectors)

  const colorEntries = groups
    .map((g) => \`      <m:color color="\${hexToTriplet(g.color)}"/>\`)
    .join("\\n")

  const objects: string[] = []
  const buildItems: string[] = []
  
  const modelSettingsObjects: string[] = []
  const plateConfigs: string[] = []

  const PLATE_SPACING = 292
  
  let nextObjectId = 2 // 1 is reserved for basematerials

  groups.forEach((grp, plateIdx) => {
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity
    let minZ = Infinity, maxZ = -Infinity
    const p = grp.geometry.index ? grp.geometry.toNonIndexed().getAttribute("position") : grp.geometry.getAttribute("position")
    
    for (let i = 0; i < p.count; i++) {
      for (const m of grp.instances) {
        const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i))
        v.applyMatrix4(m)
        minX = Math.min(minX, v.x)
        maxX = Math.max(maxX, v.x)
        minY = Math.min(minY, -v.z) // Z-up Y is -worldZ
        maxY = Math.max(maxY, -v.z)
        minZ = Math.min(minZ, v.y)  // Z-up Z is worldY
        maxZ = Math.max(maxZ, v.y)
      }
    }
    
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    
    const templateId = nextObjectId++
    
    const verts: string[] = []
    const tris: string[] = []
    
    for (let i = 0; i < p.count; i++) {
       verts.push(\`<vertex x="\${fmt(p.getX(i))}" y="\${fmt(-p.getZ(i))}" z="\${fmt(p.getY(i))}"/>\`)
    }
    for (let v = 0; v < p.count; v += 3) {
      tris.push(\`<triangle v1="\${v}" v2="\${v + 1}" v3="\${v + 2}" pid="1" p1="\${plateIdx}"/>\`)
    }
    
    objects.push(
      \`    <object id="\${templateId}" type="model">\\n\` +
      \`      <mesh>\\n\` +
      \`        <vertices>\${verts.join("")}</vertices>\\n\` +
      \`        <triangles>\${tris.join("")}</triangles>\\n\` +
      \`      </mesh>\\n\` +
      \`    </object>\`
    )
    
    const masterId = nextObjectId++
    const componentTags: string[] = []
    
    for (const m of grp.instances) {
      const e = m.elements
      const tx = e[12]
      const ty = e[13]
      const tz = e[14]
      
      const item_tx = tx - cx
      const item_ty = -tz - cy
      const item_tz = ty
      
      componentTags.push(\`        <component objectid="\${templateId}" transform="1 0 0 0 1 0 0 0 1 \${fmt(item_tx)} \${fmt(item_ty)} \${fmt(item_tz)}"/>\`)
    }
    
    objects.push(
      \`    <object id="\${masterId}" p:UUID="\${generateUUID()}" type="model">\\n\` +
      \`      <components>\\n\` +
      componentTags.join("\\n") +
      \`\\n      </components>\\n\` +
      \`    </object>\`
    )
    
    const globalX = plateIdx * PLATE_SPACING
    buildItems.push(\`    <item objectid="\${masterId}" p:UUID="\${generateUUID()}" transform="1 0 0 0 1 0 0 0 1 \${globalX} 0 0" printable="1"/>\`)
    
    const cleanName = grp.name.replace(/[^a-zA-Z0-9_\\- ]/g, "")
    
    modelSettingsObjects.push(\`
  <object id="\${masterId}">
    <metadata key="name" value="\${cleanName}"/>
    <metadata key="extruder" value="\${plateIdx + 1}"/>
    <part id="\${templateId}" subtype="normal_part">
      <metadata key="name" value="\${cleanName}"/>
      <metadata key="matrix" value="1 0 0 128 0 1 0 128 0 0 1 0 0 0 0 1"/>
      <metadata key="source_file" value="\${cleanName}.model"/>
      <metadata key="source_object_id" value="0"/>
      <metadata key="source_volume_id" value="0"/>
      <metadata key="source_offset_x" value="0"/>
      <metadata key="source_offset_y" value="0"/>
      <metadata key="source_offset_z" value="0"/>
    </part>
  </object>\`)

    plateConfigs.push(\`
  <plate>
    <metadata key="plater_id" value="\${plateIdx + 1}"/>
    <metadata key="plater_name" value="\${cleanName}"/>
    <metadata key="locked" value="false"/>
    <model_instance>
      <metadata key="object_id" value="\${masterId}"/>
      <metadata key="instance_id" value="0"/>
    </model_instance>
  </plate>\`)
  })

  const modelChunks: string[] = []
  modelChunks.push(
    \`<?xml version="1.0" encoding="UTF-8"?>\\n\`,
    \`<model unit="millimeter" xml:lang="en-US"\\n\`,
    \`  xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"\\n\`,
    \`  xmlns:p="http://schemas.bambulab.com/package/2021"\\n\`,
    \`  xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02"\\n\`,
    \`  requiredextensions="p">\\n\`,
    \`  <metadata name="Application">BambuStudio-02.06.00.51</metadata>\\n\`,
    \`  <metadata name="BambuStudio:3mfVersion">1</metadata>\\n\`,
    \`  <resources>\\n\`,
    \`    <m:colorgroup id="1">\\n\${colorEntries}\\n    </m:colorgroup>\\n\`
  )
  
  for (const obj of objects) {
    modelChunks.push(obj, "\\n")
  }

  modelChunks.push(
    \`  </resources>\\n\`,
    \`  <build>\\n\${buildItems.join("\\n")}\\n  </build>\\n\`,
    \`</model>\\n\`
  )
  
  const modelBlob = new Blob(modelChunks, { type: "text/xml" })

  const modelSettingsXml = \`<?xml version="1.0" encoding="UTF-8"?>
<config>\${modelSettingsObjects.join("")}\${plateConfigs.join("")}
  <assemble>
  </assemble>
</config>\`

  const baseConfig = JSON.parse(bambuProjectSettings)
  baseConfig["printer_model"] = "Bambu Lab A1"
  baseConfig["printer_settings_id"] = "Bambu Lab A1 0.4 nozzle"
  baseConfig["default_print_profile"] = "0.20mm Standard @BBL A1"
  const projectSettingsXml = JSON.stringify(baseConfig, null, 2)

  const sliceInfoXml = \`<?xml version="1.0" encoding="UTF-8"?>
<config>
  <header>
    <header_item key="X-BBL-Client-Type" value="slicer"/>
    <header_item key="X-BBL-Client-Version" value="1.9.1.66"/>
  </header>
</config>\`

  const contentTypes =
    \`<?xml version="1.0" encoding="UTF-8"?>\\n\` +
    \`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\\n\` +
    \`  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\\n\` +
    \`  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>\\n\` +
    \`  <Default Extension="config" ContentType="text/xml"/>\\n\` +
    \`</Types>\\n\`

  const rels =
    \`<?xml version="1.0" encoding="UTF-8"?>\\n\` +
    \`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\\n\` +
    \`  <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\\n\` +
    \`  <Relationship Target="/Metadata/model_settings.config" Id="rel-2" Type="http://schemas.bambulab.com/package/2021/model_settings"/>\\n\` +
    \`  <Relationship Target="/Metadata/project_settings.config" Id="rel-3" Type="http://schemas.bambulab.com/package/2021/project_settings"/>\\n\` +
    \`  <Relationship Target="/Metadata/slice_info.config" Id="rel-4" Type="http://schemas.bambulab.com/package/2021/slice_info"/>\\n\` +
    \`</Relationships>\\n\`

  zip.file("[Content_Types].xml", contentTypes)
  zip.folder("_rels")!.file(".rels", rels)
  zip.folder("3D")!.file("3dmodel.model", modelBlob)
  
  zip.folder("Metadata")!.file("model_settings.config", modelSettingsXml)
  zip.folder("Metadata")!.file("project_settings.config", projectSettingsXml)
  zip.folder("Metadata")!.file("slice_info.config", sliceInfoXml)
  
  return zip.generateAsync({ type: "blob", mimeType: "model/3mf" })
}
`

let code = fs.readFileSync('lib/exporters.ts', 'utf8')
const startIdx = code.indexOf('/** Build a multi-material .3MF')
const endIdx = code.indexOf('function fmt(n: number): string {')

if (startIdx !== -1 && endIdx !== -1) {
  code = code.substring(0, startIdx) + newFunction + '\n' + code.substring(endIdx)
  fs.writeFileSync('lib/exporters.ts', code)
  console.log('Patched exporters.ts successfully!')
} else {
  console.log('Failed to find start/end bounds')
}
