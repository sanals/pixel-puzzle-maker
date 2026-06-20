"use client"

import { Grid2x2, Palette } from "lucide-react"
import { ColorLegend } from "@/components/color-legend"
import { ExportBar } from "@/components/export-bar"
import { PrintConfig } from "@/components/print-config"
import { usePuzzle } from "@/components/puzzle-context"
import { UploadZone } from "@/components/upload-zone"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { GRID_SIZES, MAX_COLORS, MIN_COLORS } from "@/lib/types"

export function ControlPanel() {
  const { config, updateConfig, hasImage, processing } = usePuzzle()
  const disabled = !hasImage

  const gridIndex = GRID_SIZES.indexOf(config.gridSize as (typeof GRID_SIZES)[number])

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

      {/* Grid size */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Grid2x2 className="size-4 text-primary" aria-hidden="true" />
            Grid Size
          </Label>
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">
            {config.gridSize} × {config.gridSize}
          </span>
        </div>
        <Slider
          value={[gridIndex < 0 ? 1 : gridIndex]}
          min={0}
          max={GRID_SIZES.length - 1}
          step={1}
          disabled={disabled}
          onValueChange={(val: any) => {
            const i = Array.isArray(val) ? val[0] : val
            updateConfig({ gridSize: GRID_SIZES[i] })
          }}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
          {GRID_SIZES.map((g) => (
            <span key={g}>{g}</span>
          ))}
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
