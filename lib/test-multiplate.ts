import JSZip from "jszip"
import { bambuProjectSettings } from "./bambu-project-settings"

export async function exportTestMultiPlate(): Promise<Blob> {
  const zip = new JSZip()

  // 1. Create a simple Box Geometry model
  const boxXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>
          <vertex x="-50" y="-50" z="0"/>
          <vertex x="50" y="-50" z="0"/>
          <vertex x="50" y="50" z="0"/>
          <vertex x="-50" y="50" z="0"/>
          <vertex x="-50" y="-50" z="10"/>
          <vertex x="50" y="-50" z="10"/>
          <vertex x="50" y="50" z="10"/>
          <vertex x="-50" y="50" z="10"/>
        </vertices>
        <triangles>
          <triangle v1="0" v2="2" v3="1"/>
          <triangle v1="0" v2="3" v3="2"/>
          <triangle v1="4" v2="5" v3="6"/>
          <triangle v1="4" v2="6" v3="7"/>
          <triangle v1="0" v2="1" v3="5"/>
          <triangle v1="0" v2="5" v3="4"/>
          <triangle v1="1" v2="2" v3="6"/>
          <triangle v1="1" v2="6" v3="5"/>
          <triangle v1="2" v2="3" v3="7"/>
          <triangle v1="2" v2="7" v3="6"/>
          <triangle v1="3" v2="0" v3="4"/>
          <triangle v1="3" v2="4" v3="7"/>
        </triangles>
      </mesh>
    </object>
  </resources>
</model>`

  zip.folder("3D")!.folder("Objects")!.file("object_1.model", boxXml)

  // 2. Create the main 3dmodel.model referencing the box twice (as two distinct objects)
  // Object 2 will go on Plate 1. Object 3 will go on Plate 2.
  const mainXml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:p="http://schemas.bambulab.com/package/2021" requiredextensions="p">
  <metadata name="Application">BambuStudio-02.06.00.51</metadata>
  <metadata name="BambuStudio:3mfVersion">1</metadata>
  <resources>
    <object id="2" p:UUID="00000002-61cb-4c03-9d28-80fed5dfa1dc" type="model">
      <components>
        <component p:path="/3D/Objects/object_1.model" objectid="1" p:UUID="10000001-b206-40ff-9872-83e8017abed1" transform="1 0 0 0 1 0 0 0 1 128 128 0"/>
      </components>
    </object>
    <object id="3" p:UUID="00000003-61cb-4c03-9d28-80fed5dfa1dc" type="model">
      <components>
        <component p:path="/3D/Objects/object_1.model" objectid="1" p:UUID="10000002-b206-40ff-9872-83e8017abed1" transform="1 0 0 0 1 0 0 0 1 128 128 0"/>
      </components>
    </object>
  </resources>
  <build>
    <!-- Object 2 on Plate 1 (global offset 0) -->
    <item objectid="2" p:UUID="20000001-b1ec-4553-aec9-835e5b724bb4" transform="1 0 0 0 1 0 0 0 1 0 0 0" printable="1"/>
    <!-- Object 3 on Plate 2 (global offset 292, which is 256 + 36mm margin) -->
    <item objectid="3" p:UUID="20000002-b1ec-4553-aec9-835e5b724bb4" transform="1 0 0 0 1 0 0 0 1 292 0 0" printable="1"/>
  </build>
</model>`

  zip.folder("3D")!.file("3dmodel.model", mainXml)

  // 3. Create model_settings.config which defines the Plates!
  const modelSettingsXml = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <object id="2">
    <metadata key="name" value="Test Box 1"/>
    <metadata key="extruder" value="1"/>
    <part id="1" subtype="normal_part">
      <metadata key="name" value="Test Box 1"/>
      <metadata key="matrix" value="1 0 0 128 0 1 0 128 0 0 1 0 0 0 0 1"/>
      <metadata key="source_file" value="object_1.model"/>
      <metadata key="source_object_id" value="0"/>
      <metadata key="source_volume_id" value="0"/>
      <metadata key="source_offset_x" value="0"/>
      <metadata key="source_offset_y" value="0"/>
      <metadata key="source_offset_z" value="0"/>
    </part>
  </object>
  <object id="3">
    <metadata key="name" value="Test Box 2"/>
    <metadata key="extruder" value="1"/>
    <part id="1" subtype="normal_part">
      <metadata key="name" value="Test Box 2"/>
      <metadata key="matrix" value="1 0 0 128 0 1 0 128 0 0 1 0 0 0 0 1"/>
      <metadata key="source_file" value="object_1.model"/>
      <metadata key="source_object_id" value="0"/>
      <metadata key="source_volume_id" value="0"/>
      <metadata key="source_offset_x" value="0"/>
      <metadata key="source_offset_y" value="0"/>
      <metadata key="source_offset_z" value="0"/>
    </part>
  </object>
  <plate>
    <metadata key="plater_id" value="1"/>
    <metadata key="plater_name" value="Plate 1"/>
    <metadata key="locked" value="false"/>
    <model_instance>
      <metadata key="object_id" value="2"/>
      <metadata key="instance_id" value="0"/>
      <metadata key="identify_id" value="10002"/>
    </model_instance>
  </plate>
  <plate>
    <metadata key="plater_id" value="2"/>
    <metadata key="plater_name" value="Plate 2"/>
    <metadata key="locked" value="false"/>
    <model_instance>
      <metadata key="object_id" value="3"/>
      <metadata key="instance_id" value="0"/>
      <metadata key="identify_id" value="10003"/>
    </model_instance>
  </plate>
  <assemble>
  </assemble>
</config>`

  zip.folder("Metadata")!.file("model_settings.config", modelSettingsXml)


  // 4. Create project_settings.config (Colors & Printer info)
  const baseConfig = JSON.parse(bambuProjectSettings)
  // We use the EXACT A1 mini settings from the native file to prevent Bambu Studio from
  // dropping the config due to validation errors, then manually override the printer to A1.
  baseConfig["printer_model"] = "Bambu Lab A1"
  baseConfig["printer_settings_id"] = "Bambu Lab A1 0.4 nozzle"
  baseConfig["default_print_profile"] = "0.20mm Standard @BBL A1"

  const projectSettingsXml = JSON.stringify(baseConfig, null, 2)
  zip.folder("Metadata")!.file("project_settings.config", projectSettingsXml)

  // 5. Create slice_info.config
  const sliceInfoXml = `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <header>
    <header_item key="X-BBL-Client-Type" value="slicer"/>
    <header_item key="X-BBL-Client-Version" value="1.9.1.66"/>
  </header>
</config>`

  zip.folder("Metadata")!.file("slice_info.config", sliceInfoXml)

  // 6. Create relationships
  const relsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
  <Relationship Target="/Metadata/model_settings.config" Id="rel-2" Type="http://schemas.bambulab.com/package/2021/model_settings"/>
  <Relationship Target="/Metadata/project_settings.config" Id="rel-3" Type="http://schemas.bambulab.com/package/2021/project_settings"/>
  <Relationship Target="/Metadata/slice_info.config" Id="rel-4" Type="http://schemas.bambulab.com/package/2021/slice_info"/>
</Relationships>`

  zip.folder("_rels")!.file(".rels", relsXml)

  const modelRelsXml = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/Objects/object_1.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`

  zip.folder("3D")!.folder("_rels")!.file("3dmodel.model.rels", modelRelsXml)

  // 7. MUST HAVE [Content_Types].xml for OPC format to work!
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
 <Default Extension="png" ContentType="image/png"/>
 <Default Extension="gcode" ContentType="text/x.gcode"/>
 <Default Extension="config" ContentType="text/xml"/>
</Types>`
  zip.file("[Content_Types].xml", contentTypesXml)

  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } })
}
