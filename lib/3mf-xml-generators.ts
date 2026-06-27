export interface PlatePart {
  objectId: number
  name: string
  matrix: string
  sourceFile: string
  isNegative?: boolean
  extruder?: number
}

export interface PlateObject {
  objectId: number
  name: string
  extruder: number
  isNegative?: boolean
  parts: PlatePart[]
}

export interface PlateDefinition {
  plateName: string
  objects: PlateObject[]
}

export function generateModelSettingsConfig(
  allObjects: PlateObject[],
  plates: PlateDefinition[]
): string {
  // Object settings section
  const objectParts = allObjects.map(
    (obj) => {
      const partTags = obj.parts.map(part => {
        const subtype = part.isNegative || obj.isNegative ? "negative_volume" : "normal_part"
        const extruderStr = part.extruder ? `\n      <metadata key="extruder" value="${part.extruder}"/>` : ""
        return (
          `    <part id="${part.objectId}" subtype="${subtype}">\n` +
          `      <metadata key="name" value="${escapeXml(part.name)}"/>\n` +
          `      <metadata key="matrix" value="${part.matrix}"/>\n` +
          `      <metadata key="source_file" value="${escapeXml(part.sourceFile)}"/>\n` +
          `      <metadata key="source_object_id" value="0"/>\n` +
          `      <metadata key="source_volume_id" value="0"/>${extruderStr}\n` +
          `    </part>`
        )
      }).join("\n")

      return (
        `  <object id="${obj.objectId}">\n` +
        `    <metadata key="name" value="${escapeXml(obj.name)}"/>\n` +
        `    <metadata key="extruder" value="${obj.extruder}"/>\n` +
        (partTags ? partTags + "\n" : "") +
        `  </object>`
      )
    }
  )

  // Plate definitions section
  const plateParts = plates.map((plate, i) => {
    const platerId = i + 1
    const instanceParts = plate.objects.map((obj) => {
      const identifyId = 10000 + obj.objectId
      return (
        `    <model_instance>\n` +
        `      <metadata key="object_id" value="${obj.objectId}"/>\n` +
        `      <metadata key="instance_id" value="0"/>\n` +
        `      <metadata key="identify_id" value="${identifyId}"/>\n` +
        `    </model_instance>`
      )
    })

    return (
      `  <plate>\n` +
      `    <metadata key="plater_id" value="${platerId}"/>\n` +
      `    <metadata key="plater_name" value="${escapeXml(plate.plateName)}"/>\n` +
      `    <metadata key="locked" value="false"/>\n` +
      `    <metadata key="filament_map_mode" value="Auto For Flush"/>\n` +
      `    <metadata key="gcode_file" value=""/>\n` +
      instanceParts.join("\n") + "\n" +
      `  </plate>`
    )
  })

  return `<?xml version="1.0" encoding="UTF-8"?>\n<config>\n${objectParts.join("\n")}\n${plateParts.join("\n")}\n</config>`
}

export function generateProjectSettingsConfig(printerModel: string, printerSettingsId: string, colors: string[]) {
  const config = {
    name: "project_settings",
    version: "01.09.01.66",
    default_print_profile: "0.20mm Standard @BBL A1",
    printer_model: printerModel,
    printer_settings_id: printerSettingsId,
    printer_variant: "0.4",
    filament_colour: colors,
    filament_map: ["1"]
  };
  return JSON.stringify(config, null, 2);
}

export function generateSliceInfo(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <header>
    <header_item key="X-BBL-Client-Type" value="slicer"/>
    <header_item key="X-BBL-Client-Version" value="02.06.00.51"/>
  </header>
</config>`
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === '"' ? "&quot;" : "&apos;",
  )
}
