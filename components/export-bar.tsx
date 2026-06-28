"use client"

import { Box, Package, Layers, Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { usePuzzle } from "@/components/puzzle-context"
import {
  assembleExportAssets,
  build3MF,
  build3MFZip,
  downloadBlob,
} from "@/lib/exporters"

export function ExportBar() {
  const { layout, split, matrix, hasImage, config } = usePuzzle()
  const [busy, setBusy] = useState<null | "3mf" | "zip">(null)
  const [progressMsg, setProgressMsg] = useState("")
  const [progressPct, setProgressPct] = useState<number | undefined>(undefined)
  const disabled = !hasImage || !layout || !matrix || !split

  async function exportThreeMF() {
    if (disabled) return
    setBusy("3mf")
    setProgressMsg("Preparing export...")
    setProgressPct(undefined)

    // Yield to the event loop so the UI has time to paint the loading toast before heavy sync work begins
    await new Promise(resolve => setTimeout(resolve, 50))

    try {
      const onProgress = (msg: string, pct?: number) => {
        setProgressMsg(msg)
        setProgressPct(pct)
      }
      
      const assets = await assembleExportAssets(layout!, matrix!.palette, split!, config.embossing, { packTilesAtOrigin: true, bedWidth: config.bedWidth, onProgress })
      const blob = await build3MF(assets, { bedWidth: config.bedWidth, bedId: config.bedId, onProgress })
      downloadBlob(blob, "pixel-puzzle.3mf")
      const uniqueColorsCount = new Set(assets.tiles.map(t => t.color)).size
      toast.success("Exported pixel-puzzle.3mf", {
        description: `${uniqueColorsCount} color materials locked for multi-material slicing.`,
      })
    } catch (err) {
      console.log("[v0] 3mf export error:", err)
      toast.error("3MF export failed")
    } finally {
      setBusy(null)
    }
  }

  async function exportZip() {
    if (disabled) return
    setBusy("zip")
    setProgressMsg("Preparing ZIP export...")
    setProgressPct(undefined)

    // Yield to the event loop so the UI has time to paint the loading toast before heavy sync work begins
    await new Promise(resolve => setTimeout(resolve, 50))

    try {
      const onProgress = (msg: string, pct?: number) => {
        setProgressMsg(msg)
        setProgressPct(pct)
      }
      
      const assets = await assembleExportAssets(layout!, matrix!.palette, split!, config.embossing, { packTilesAtOrigin: true, bedWidth: config.bedWidth, onProgress })
      const blob = await build3MFZip(assets, { onProgress })
      downloadBlob(blob, "pixel-puzzle-separated.zip")
      toast.success("Exported pixel-puzzle-separated.zip", {
        description: split!.needsSplit
          ? `${split!.subBoards.length} boards + color tiles separated into .3mf files.`
          : "Tray + color-sorted tiles separated into .3mf files.",
      })
    } catch (err) {
      console.log("[v0] zip export error:", err)
      toast.error("Separated 3MF export failed")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {busy && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border bg-card p-6 text-center shadow-lg">
            <Loader2 className="size-10 animate-spin text-primary" />
            <div className="w-full space-y-3">
              <h3 className="font-semibold leading-none tracking-tight">Exporting 3D Files</h3>
              <p className="text-sm text-muted-foreground min-h-5">
                {progressMsg || "This might take a minute..."}
              </p>
              
              {/* Progress Bar Container */}
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div 
                  className="h-full bg-primary transition-all duration-300 ease-out" 
                  style={{ width: `${progressPct === undefined ? 0 : Math.max(5, progressPct)}%` }} 
                />
              </div>
              
            </div>
          </div>
        </div>
      )}

      <Button
        className="h-11 w-full justify-start gap-2 text-sm font-semibold"
        disabled={disabled || busy !== null}
        onClick={exportThreeMF}
      >
        <Box className="size-4" aria-hidden="true" />
        {busy === "3mf" ? "Exporting…" : "Export Multi-Color 3MF"}
      </Button>
      <Button
        variant="secondary"
        className="h-11 w-full justify-start gap-2 text-sm font-medium"
        disabled={disabled || busy !== null}
        onClick={exportZip}
      >
        <Package className="size-4" aria-hidden="true" />
        {busy === "zip" ? "Packaging…" : "Export Separated Plates (.zip)"}
      </Button>
      {split?.needsSplit && (
        <p className="flex items-start gap-1.5 px-1 text-xs text-muted-foreground">
          <Layers className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span>{split.reason} Auto-split into {split.subBoards.length} boards.</span>
        </p>
      )}
      {layout && layout.placements.length > 2000 && (
        <p className="flex items-start gap-1.5 px-1 text-xs text-orange-400">
          <Box className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>Warning: High tile count ({layout.placements.length}). Multi-color 3MF export will produce massive filament waste due to toolhead changes. Consider exporting the Monolithic STL Zip to print each color separately.</span>
        </p>
      )}
    </div>
  )
}
