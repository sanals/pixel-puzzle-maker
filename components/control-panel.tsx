"use client"
import { useEffect } from "react"
import { Grid2x2, Palette, Paintbrush } from "lucide-react"
import { ColorLegend } from "@/components/color-legend"
import { ExportBar } from "@/components/export-bar"
import { PrintConfig } from "@/components/print-config"
import { usePuzzle } from "@/components/puzzle-context"
import { UploadZone } from "@/components/upload-zone"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MAX_COLORS, MIN_COLORS, BasePlateSize } from "@/lib/types"

export function ControlPanel() {
  const { config, updateConfig, hasImage, processing, paintMode, setPaintMode, undo, redo } = usePuzzle()
  const disabled = !hasImage

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if the user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' || e.key === 'Z') {
          if (e.shiftKey) {
            redo()
          } else {
            undo()
          }
        } else if (e.key === 'y' || e.key === 'Y') {
          redo()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  const maxRatioDim = Math.max(config.cropRatio.w, config.cropRatio.h)
  const maxMultiplier = Math.max(1, Math.floor(6 / maxRatioDim))

  // Ensure current multiplier is within bounds if ratio changes
  useEffect(() => {
    if (config.resolutionMultiplier > maxMultiplier) {
      updateConfig({ resolutionMultiplier: maxMultiplier as any })
    }
  }, [config.resolutionMultiplier, maxMultiplier, updateConfig])

  return (
    <aside className="flex h-full w-full flex-col gap-4 overflow-y-auto border-r bg-sidebar p-4 lg:w-[340px] lg:shrink-0">
      <div className="flex flex-col gap-1">
        <h1 className="text-base font-semibold tracking-tight text-sidebar-foreground">
          Pixel Puzzle Maker
        </h1>
        <p className="text-xs text-muted-foreground">
          Photo to 3D-printable waffle tray &amp; tiles.
        </p>
      </div>

      <Tabs defaultValue="design" className="flex flex-col gap-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="palette">Palette</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>

        <TabsContent value="design" className="flex flex-col gap-5 mt-0 data-[state=inactive]:hidden">
          <UploadZone />
          <Separator />
          {/* Base Size & Resolution */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <Grid2x2 className="size-4 text-primary" aria-hidden="true" />
                Physical Base Plate
              </Label>
              <ToggleGroup
                size="sm"
                value={[config.basePlateSize.toString()]}
                onValueChange={(val: string[]) => {
                  if (val && val.length > 0) updateConfig({ basePlateSize: parseInt(val[0]) as BasePlateSize, resolutionMultiplier: Math.min(config.resolutionMultiplier, maxMultiplier) as any })
                }}
                className="border rounded-md p-0.5"
              >
                <ToggleGroupItem value="16" className="h-7 px-3 text-xs aria-pressed:bg-indigo-600 aria-pressed:text-white hover:aria-pressed:bg-indigo-600 hover:aria-pressed:text-white">16x16</ToggleGroupItem>
                <ToggleGroupItem
                  value="24"
                  disabled={config.bedId === "bambu-mini"}
                  className="h-7 px-3 text-xs aria-pressed:bg-indigo-600 aria-pressed:text-white hover:aria-pressed:bg-indigo-600 hover:aria-pressed:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                  title={config.bedId === "bambu-mini" ? "24x24 is too large for A1 Mini plates" : ""}
                >
                  24x24
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="flex flex-col gap-2">
              <Label className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
                Resolution (Blocks)
              </Label>
              <ToggleGroup
                value={[Math.min(config.resolutionMultiplier, maxMultiplier).toString()]}
                onValueChange={(val: string[]) => {
                  if (val && val.length > 0) updateConfig({ resolutionMultiplier: parseInt(val[0]) as any })
                }}
                disabled={disabled || maxMultiplier === 1}
                className="grid grid-cols-3 gap-1.5 w-full"
              >
                {Array.from({ length: maxMultiplier }).map((_, i) => {
                  const m = i + 1
                  const w = m * config.basePlateSize * config.cropRatio.w
                  const h = m * config.basePlateSize * config.cropRatio.h
                  return (
                    <ToggleGroupItem
                      key={m}
                      value={m.toString()}
                      className="h-9 px-2 text-xs font-medium border border-input bg-background aria-pressed:bg-indigo-600 aria-pressed:text-white hover:bg-accent aria-pressed:border-indigo-600 hover:aria-pressed:bg-indigo-600 hover:aria-pressed:text-white transition-colors"
                    >
                      {w} × {h}
                    </ToggleGroupItem>
                  )
                })}
              </ToggleGroup>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="palette" className="flex flex-col gap-5 mt-0 data-[state=inactive]:hidden">
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateConfig({ colorCount: Math.max(MIN_COLORS, config.colorCount - 1) })}
                disabled={disabled || config.colorCount <= MIN_COLORS}
                className="flex size-8 shrink-0 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
              >
                -
              </button>
              <input
                type="number"
                value={config.colorCount}
                min={MIN_COLORS}
                max={MAX_COLORS}
                disabled={disabled}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  if (!Number.isNaN(n)) updateConfig({ colorCount: Math.max(MIN_COLORS, Math.min(MAX_COLORS, n)) })
                }}
                className="h-8 w-full rounded-md border border-input bg-background px-3 text-center text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              />
              <button
                onClick={() => updateConfig({ colorCount: Math.min(MAX_COLORS, config.colorCount + 1) })}
                disabled={disabled || config.colorCount >= MAX_COLORS}
                className="flex size-8 shrink-0 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
              >
                +
              </button>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">
                Palette Legend
                {processing && (
                  <span className="ml-2 text-xs font-normal text-primary">processing…</span>
                )}
              </Label>
              <button
                onClick={() => setPaintMode(!paintMode)}
                disabled={disabled}
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${paintMode
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50"
                  }`}
              >
                <Paintbrush className="h-3.5 w-3.5" />
                {paintMode ? "Painting" : "Paint"}
              </button>
            </div>
            <ColorLegend />
          </div>
        </TabsContent>

        <TabsContent value="export" className="flex flex-col gap-5 mt-0 data-[state=inactive]:hidden">
          <PrintConfig />
          <Separator />
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-medium">Manufacturing Exports</Label>
            <ExportBar />
          </div>
        </TabsContent>
      </Tabs>
    </aside>
  )
}

