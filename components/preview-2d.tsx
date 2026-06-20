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

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const display = Math.min(canvas.parentElement?.clientWidth ?? 480, 560)
    const cell = Math.max(2, Math.floor(display / matrix.width))
    const dim = cell * matrix.width

    canvas.width = dim * dpr
    canvas.height = dim * dpr
    canvas.style.width = `${dim}px`
    canvas.style.height = `${dim}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, dim, dim)

    const drawLabels = showLabels && cell >= 14
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.font = `${Math.floor(cell * 0.55)}px ui-monospace, monospace`

    for (let y = 0; y < matrix.height; y++) {
      for (let x = 0; x < matrix.width; x++) {
        const c = matrix.cells[x][y]
        ctx.fillStyle = c.hexColor
        ctx.fillRect(x * cell, y * cell, cell, cell)
        if (drawLabels) {
          const pal = matrix.palette[c.colorIndex]
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
      <button
        type="button"
        onClick={() => setShowLabels((s) => !s)}
        className="self-end rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-accent"
      >
        {showLabels ? "Hide labels" : "Show labels"}
      </button>
      <div className="flex flex-1 items-center justify-center overflow-auto">
        <canvas
          ref={canvasRef}
          className="rounded-md shadow-lg ring-1 ring-border"
          aria-label="2D pixel map preview"
        />
      </div>
    </div>
  )
}
