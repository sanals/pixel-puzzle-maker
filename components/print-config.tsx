"use client"

import { Settings2 } from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { usePuzzle } from "@/components/puzzle-context"
import { PRINTER_BEDS, type EmbossingStyle, type TileShape } from "@/lib/types"

const SHAPES: { value: TileShape; label: string }[] = [
  { value: "square", label: "Square" },
  { value: "cylinder", label: "Cylinder" },
  { value: "hexagon", label: "Hexagon (Honeycomb)" },
  { value: "heart", label: "Heart" },
]

const EMBOSS: { value: EmbossingStyle; label: string }[] = [
  { value: "none", label: "None" },
  { value: "raised", label: "Raised (Protruding)" },
  { value: "recessed", label: "Recessed (Debossed)" },
]

export function PrintConfig() {
  const { config, updateConfig, hasImage } = usePuzzle()
  const disabled = !hasImage

  return (
    <Accordion className="rounded-lg border bg-card">
      <AccordionItem value="print" className="border-none">
        <AccordionTrigger className="px-3 py-3 text-sm font-medium hover:no-underline">
          <span className="flex items-center gap-2">
            <Settings2 className="size-4 text-primary" aria-hidden="true" />
            Advanced Print Configuration
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-4">
          <div className="flex flex-col gap-5">
            {/* Printer bed preset */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-medium text-muted-foreground">Printer Bed</Label>
              <Select
                value={config.bedId}
                onValueChange={(v) => {
                  const payload: any = { bedId: v || "bambu-mini" }
                  if (v === "bambu-mini") {
                    payload.basePlateSize = 16
                  }
                  updateConfig(payload)
                }}
                disabled={disabled}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRINTER_BEDS.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {config.bedId === "custom" && (
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <NumberField
                    label="Width (mm)"
                    value={config.bedWidth}
                    disabled={disabled}
                    onChange={(n) => updateConfig({ bedWidth: n })}
                  />
                  <NumberField
                    label="Depth (mm)"
                    value={config.bedDepth}
                    disabled={disabled}
                    onChange={(n) => updateConfig({ bedDepth: n })}
                  />
                </div>
              )}
            </div>

            {/* Physical board size */}
            <NumberField
              label="Target Physical Board Size (mm)"
              value={config.physicalSizeMm}
              min={20}
              max={1000}
              disabled={disabled}
              onChange={(n) => updateConfig({ physicalSizeMm: n })}
            />

            {/* Tile shape */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-medium text-muted-foreground">Tile Shape</Label>
              <Select
                value={config.tileShape}
                onValueChange={(v) => updateConfig({ tileShape: v as TileShape })}
                disabled={disabled}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHAPES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Embossing */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Letter Marking
              </Label>
              <RadioGroup
                value={config.embossing}
                onValueChange={(v) => updateConfig({ embossing: v as EmbossingStyle })}
                disabled={disabled}
                className="flex flex-col gap-2"
              >
                {EMBOSS.map((e) => (
                  <Label
                    key={e.value}
                    htmlFor={`emboss-${e.value}`}
                    className="flex cursor-pointer items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm font-normal has-[:checked]:border-primary/60 has-[:checked]:bg-primary/10"
                  >
                    <RadioGroupItem id={`emboss-${e.value}`} value={e.value} />
                    {e.label}
                  </Label>
                ))}
              </RadioGroup>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 100000,
  disabled,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (!Number.isNaN(n)) onChange(Math.max(min, Math.min(max, n)))
        }}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      />
    </div>
  )
}
