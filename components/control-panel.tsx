"use client"
import { useEffect } from "react"
import { Grid2x2, Palette } from "lucide-react"
import { ColorLegend } from "@/components/color-legend"
import { ExportBar } from "@/components/export-bar"
import { PrintConfig } from "@/components/print-config"
import { usePuzzle } from "@/components/puzzle-context"
import { UploadZone } from "@/components/upload-zone"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { MAX_COLORS, MIN_COLORS } from "@/lib/types"

export function ControlPanel() {
  const { config, updateConfig, hasImage, processing } = usePuzzle()
  const disabled = !hasImage

  const maxRatioDim = Math.max(config.cropRatio.w, config.cropRatio.h)
  const maxMultiplier = Math.max(1, Math.floor(4 / maxRatioDim))

  // Ensure current multiplier is within bounds if ratio changes
  useEffect(() => {
    if (config.resolutionMultiplier > maxMultiplier) {
      updateConfig({ resolutionMultiplier: maxMultiplier as any })
    }
  }, [config.resolutionMultiplier, maxMultiplier, updateConfig])

  return (
    <aside className="flex h-full w-full flex-col gap-5 overflow-y-auto border-r bg-sidebar p-4 lg:w-[340px] lg:shrink-0">
      <div className="flex flex-col gap-1">
        <h1 className="text-base font-semibold tracking-tight text-sidebar-foreground">
          Pixel Puzzle Maker
        </h1>
        <p className="text-xs text-muted-foreground">
          Photo to 3D-printable waffle tray &amp; tiles.
        </p>
      </div>

      <UploadZone />

      <Separator />

      {/* Base Size & Resolution */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Grid2x2 className="size-4 text-primary" aria-hidden="true" />
            Physical Base Plate
          </Label>
        </div>
        <div className="flex justify-between gap-2">
          <Button 
            variant={config.basePlateSize === 16 ? "default" : "outline"} 
            size="sm"
            onClick={() => updateConfig({ basePlateSize: 16, resolutionMultiplier: Math.min(config.resolutionMultiplier, maxMultiplier) as any })}
            className={config.basePlateSize === 16 ? "bg-indigo-600 hover:bg-indigo-700 text-white w-full" : "w-full text-muted-foreground"}
          >
            16x16
          </Button>
          <Button 
            variant={config.basePlateSize === 24 ? "default" : "outline"} 
            size="sm"
            onClick={() => updateConfig({ basePlateSize: 24, resolutionMultiplier: Math.min(config.resolutionMultiplier, maxMultiplier) as any })}
            className={config.basePlateSize === 24 ? "bg-indigo-600 hover:bg-indigo-700 text-white w-full" : "w-full text-muted-foreground"}
          >
            24x24
          </Button>
        </div>

        <div className="flex items-center justify-between mt-2">
          <Label className="flex items-center gap-2 text-sm font-medium">
            Resolution (Blocks)
          </Label>
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums text-indigo-400">
            {config.resolutionMultiplier * config.basePlateSize * config.cropRatio.w} × {config.resolutionMultiplier * config.basePlateSize * config.cropRatio.h}
          </span>
        </div>
        <Slider
          value={[Math.min(config.resolutionMultiplier, maxMultiplier)]}
          min={1}
          max={maxMultiplier}
          step={1}
          disabled={disabled || maxMultiplier === 1}
          onValueChange={(val: any) => {
            const i = Array.isArray(val) ? val[0] : val
            updateConfig({ resolutionMultiplier: i })
          }}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums px-1">
          {Array.from({ length: maxMultiplier }).map((_, i) => {
            const m = i + 1
            const w = m * config.basePlateSize * config.cropRatio.w
            const h = m * config.basePlateSize * config.cropRatio.h
            return <span key={m}>{w}x{h}</span>
          })}
        </div>
      </div>

      {/* Color count */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Palette className="size-4 text-primary" aria-hidden="true" />
            Colors
          </Label>
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">
            {config.colorCount}
          </span>
        </div>
        <Slider
          value={[config.colorCount]}
          min={MIN_COLORS}
          max={MAX_COLORS}
          step={1}
          disabled={disabled}
          onValueChange={(val: any) => {
            const n = Array.isArray(val) ? val[0] : val
            updateConfig({ colorCount: n })
          }}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
          {Array.from({ length: MAX_COLORS - MIN_COLORS + 1 }, (_, i) => MIN_COLORS + i).map(
            (n) => (
              <span key={n}>{n}</span>
            ),
          )}
        </div>
      </div>

      <PrintConfig />

      <Separator />

      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium">
          Palette Legend
          {processing && (
            <span className="ml-2 text-xs font-normal text-primary">processing…</span>
          )}
        </Label>
        <ColorLegend />
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium">Manufacturing Exports</Label>
        <ExportBar />
      </div>
    </aside>
  )
}
