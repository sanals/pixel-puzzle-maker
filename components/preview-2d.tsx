"use client"

import { useEffect, useRef, useState } from "react"
import type { VoxelMatrix } from "@/lib/types"

interface Preview2DProps {
  matrix: VoxelMatrix
}

export function Preview2D({ matrix }: Preview2DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [showLabels, setShowLabels] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Draw the canvas at a fixed, high resolution internally.
    // CSS max-w-full and max-h-full will scale it down to fit the screen.
    const cell = 40 
    const dim = cell * matrix.width

    canvas.width = dim
    canvas.height = dim
    
    // Clear styles that might force it to be tiny
    canvas.style.width = ""
    canvas.style.height = ""
    
    ctx.clearRect(0, 0, dim, dim)

    const drawLabels = showLabels
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.font = `${Math.floor(cell * 0.55)}px ui-monospace, monospace`

    for (let y = 0; y < matrix.height; y++) {
      for (let x = 0; x < matrix.width; x++) {
        const c = matrix.cells[x][y]
        const pal = matrix.palette[c.colorIndex]
        
        if (pal.ignored) continue // Do not draw hidden tiles
        
        ctx.fillStyle = c.hexColor
        ctx.fillRect(x * cell, y * cell, cell, cell)
        if (drawLabels) {
          const lum =
            (0.2126 * pal.rgb[0] + 0.7152 * pal.rgb[1] + 0.0722 * pal.rgb[2]) / 255
          ctx.fillStyle = lum > 0.45 ? "#0b1020" : "#f8fafc"
          ctx.fillText(c.label, x * cell + cell / 2, y * cell + cell / 2 + 1)
        }
      }
    }
  }, [matrix, showLabels])

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-4">
      <div className="flex gap-2 self-end">
        <button
          type="button"
          onClick={() => setShowLabels((s) => !s)}
          className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent"
        >
          {showLabels ? "Hide labels" : "Show labels"}
        </button>
        <button
          type="button"
          onClick={() => {
            if (canvasRef.current) {
              const url = canvasRef.current.toDataURL("image/png")
              const a = document.createElement("a")
              a.href = url
              a.download = "pixel-puzzle-map.png"
              a.click()
            }
          }}
          className="rounded-md border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Download Map
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-auto w-full">
        <canvas
          ref={canvasRef}
          className="rounded-md shadow-lg ring-1 ring-border max-w-full max-h-full object-contain"
          aria-label="2D pixel map preview"
        />
      </div>
    </div>
  )
}
