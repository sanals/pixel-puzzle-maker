"use client"

import { Settings2, Printer } from "lucide-react"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { usePuzzle } from "@/components/puzzle-context"
import { PRINTER_BEDS, type EmbossingStyle } from "@/lib/types"

const EMBOSS: { value: EmbossingStyle; label: string }[] = [
  { value: "raised", label: "Raised" },
  { value: "recessed", label: "Recessed" },
]

export function PrintConfig() {
  const { config, updateConfig, hasImage } = usePuzzle()
  const disabled = !hasImage

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Settings2 className="size-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-medium">Print Configuration</h3>
      </div>
      
      <div className="flex flex-col gap-6 pl-1">
        {/* Printer bed preset */}
        <div className="flex flex-col gap-3">
          <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5 mb-1">
            <Printer className="size-3.5" />
            Printer Bed
          </Label>
          <RadioGroup
            value={config.bedId}
            onValueChange={(v) => {
              const payload: any = { bedId: v || "bambu-mini" }
              if (v === "bambu-mini") {
                payload.basePlateSize = 16
              }
              updateConfig(payload)
            }}
            disabled={disabled}
            className="grid gap-2"
          >
            {PRINTER_BEDS.map((b) => {
              const namePart = b.name.split(' (')[0]
              const dimPart = b.name.match(/\(([^)]+)\)/)?.[1] || ''
              return (
                <Label
                  key={b.id}
                  htmlFor={`bed-${b.id}`}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-card p-3.5 hover:bg-accent/50 hover:border-accent-foreground/20 has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-all"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-sm leading-none">{namePart}</span>
                    <span className="text-xs text-muted-foreground">{dimPart}</span>
                  </div>
                  <RadioGroupItem id={`bed-${b.id}`} value={b.id} className="sr-only" />
                  <div className="h-4 w-4 rounded-full border border-primary/50 flex items-center justify-center opacity-0 has-[:checked]:opacity-100 transition-opacity relative">
                    {config.bedId === b.id && (
                      <div className="h-2 w-2 rounded-full bg-primary absolute" />
                    )}
                  </div>
                </Label>
              )
            })}
          </RadioGroup>
        </div>

        {/* Embossing */}
        <div className="flex flex-col gap-3">
          <Label className="text-sm font-medium text-muted-foreground">
            Letter Marking
          </Label>
          <ToggleGroup 
            size="sm"
            value={[config.embossing]}
            onValueChange={(val: string[]) => {
              if (val && val.length > 0) updateConfig({ embossing: val[0] as EmbossingStyle })
            }}
            disabled={disabled}
            className="border rounded-md p-0.5 justify-start flex-wrap w-full"
          >
            {EMBOSS.map((e) => (
              <ToggleGroupItem 
                key={e.value} 
                value={e.value} 
                className="h-9 px-4 text-xs aria-pressed:bg-indigo-600 aria-pressed:text-white hover:aria-pressed:bg-indigo-600 hover:aria-pressed:text-white flex-1"
              >
                {e.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>
    </div>
  )
}


