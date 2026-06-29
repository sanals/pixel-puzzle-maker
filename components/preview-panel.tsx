"use client"

import { Box, Grid3x3, ImageIcon, Loader2, Undo, Redo } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePuzzle } from "@/components/puzzle-context"
import { Preview2D } from "@/components/preview-2d"
import { Preview3D } from "@/components/preview-3d"

export function PreviewPanel() {
  const { matrix, layout, processing, config, split, hasImage, undo, redo, canUndo, canRedo } = usePuzzle()

  if (!hasImage || !matrix || !layout) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
          <ImageIcon className="h-8 w-8" />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-medium text-foreground">No image yet</p>
          <p className="max-w-sm text-pretty text-sm text-muted-foreground">
            Upload a PNG or JPEG to generate a pixel-quantized, 3D-printable puzzle tray and tiles.
          </p>
        </div>
      </div>
    )
  }

  const dims = `${Math.round(layout.boardWidth)} × ${Math.round(layout.boardDepth)} mm`

  return (
    <div className="flex h-full flex-col">
      <Tabs defaultValue="3d" className="flex h-full flex-col gap-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <TabsList>
              <TabsTrigger value="3d" className="gap-1.5">
                <Box className="h-4 w-4" /> 3D Preview
              </TabsTrigger>
              <TabsTrigger value="2d" className="gap-1.5">
                <Grid3x3 className="h-4 w-4" /> Pixel Map
              </TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-1 border-l pl-2 ml-1">
              <button
                onClick={undo}
                disabled={!canUndo}
                className="rounded p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Undo (Ctrl+Z)"
              >
                <Undo className="size-4" />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className="rounded p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Redo (Ctrl+Y)"
              >
                <Redo className="size-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {processing && (
              <span className="flex items-center gap-1.5 text-primary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Quantizing…
              </span>
            )}
            <span>
              {config.resolutionMultiplier * config.basePlateSize * config.cropRatio.w}×{config.resolutionMultiplier * config.basePlateSize * config.cropRatio.h} grid · {dims}
            </span>
          </div>
        </div>

        <div className="relative min-h-0 flex-1">
          <TabsContent value="3d" keepMounted className="absolute inset-0 m-0 data-[state=inactive]:hidden">
            <Preview3D layout={layout} palette={matrix.palette} embossing={config.embossing} />
          </TabsContent>
          <TabsContent value="2d" keepMounted className="absolute inset-0 m-0 overflow-auto data-[state=inactive]:hidden">
            <Preview2D matrix={matrix} />
          </TabsContent>
        </div>

        {split && (
          <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            <span className={split.needsSplit ? "text-primary" : "text-foreground"}>
              {split.needsSplit
                ? `Tiles into ${split.subBoards.length} boards (${split.gridCols}×${split.gridRows}) · ${split.connectorCount} connector pegs`
                : "Fits bed in one piece"}
            </span>
            <span className="mx-2 text-border">|</span>
            {split.reason}
          </div>
        )}
      </Tabs>
    </div>
  )
}
