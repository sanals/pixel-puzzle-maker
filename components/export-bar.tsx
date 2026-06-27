"use client"

import { Box, Package, Layers } from "lucide-react"
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
  const disabled = !hasImage || !layout || !matrix || !split

  async function exportThreeMF() {
    if (disabled) return
    setBusy("3mf")
    const id = toast.loading("Building multi-color 3MF…")
    try {
      const assets = await assembleExportAssets(layout!, matrix!.palette, split!, config.embossing, { packTilesAtOrigin: true })
      const blob = await build3MF(assets)
      downloadBlob(blob, "pixel-puzzle.3mf")
      toast.success("Exported pixel-puzzle.3mf", {
        id,
        description: `${assets.tiles.length} color materials locked for multi-material slicing.`,
      })
    } catch (err) {
      console.log("[v0] 3mf export error:", err)
      toast.error("3MF export failed", { id })
    } finally {
      setBusy(null)
    }
  }

  async function exportZip() {
    if (disabled) return
    setBusy("zip")
    const id = toast.loading("Packaging separated 3MF plates…")
    try {
      const assets = await assembleExportAssets(layout!, matrix!.palette, split!, config.embossing, { packTilesAtOrigin: true })
      const blob = await build3MFZip(assets)
      downloadBlob(blob, "pixel-puzzle-separated.zip")
      toast.success("Exported pixel-puzzle-separated.zip", {
        id,
        description: split!.needsSplit
          ? `${split!.subBoards.length} boards + color tiles separated into .3mf files.`
          : "Tray + color-sorted tiles separated into .3mf files.",
      })
    } catch (err) {
      console.log("[v0] zip export error:", err)
      toast.error("Separated 3MF export failed", { id })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
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
