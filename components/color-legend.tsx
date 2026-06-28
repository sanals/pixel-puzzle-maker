"use client"

import { useEffect, useRef, useState } from "react"
import { usePuzzle } from "@/components/puzzle-context"
import { contrastText } from "@/lib/image-processing"
import { Plus } from "lucide-react"
import type { PaletteColor } from "@/lib/types"

function ColorLegendRow({ c }: { c: PaletteColor }) {
  const { paintMode, activeColorIndex, setActiveColorIndex, updatePaletteColor } = usePuzzle()
  const [localHex, setLocalHex] = useState(c.hex)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Keep local state in sync if the color changes externally (e.g. new image load)
  useEffect(() => {
    setLocalHex(c.hex)
  }, [c.hex])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setLocalHex(val)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      updatePaletteColor(c.index, val)
    }, 150)
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const isActive = paintMode && activeColorIndex === c.index

  return (
    <tr
      className={`border-b last:border-0 transition-colors ${
        isActive ? "bg-primary/10" : ""
      } ${paintMode ? "cursor-pointer hover:bg-muted/50" : ""}`}
      onClick={() => {
        if (paintMode) {
          setActiveColorIndex(c.index)
        }
      }}
    >
      <td className="px-2 py-2">
        <span
          className="flex size-6 items-center justify-center rounded-md text-xs font-bold tabular-nums transition-colors"
          style={{ backgroundColor: localHex, color: contrastText(...c.rgb) }}
        >
          {c.label}
        </span>
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-2">
          <div
            className="relative size-5 overflow-hidden rounded-sm border border-border/60 transition-colors"
            style={{ backgroundColor: localHex }}
            title="Click to edit color"
          >
            <input
              type="color"
              value={localHex}
              onChange={handleChange}
              className="absolute -inset-2 size-10 cursor-pointer appearance-none bg-transparent opacity-0"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <code className="text-xs text-muted-foreground">{localHex.toUpperCase()}</code>
        </div>
      </td>
      <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
        {c.count.toLocaleString()}
      </td>
      <td className="px-2 py-2 text-right tabular-nums font-medium">
        {(c.coverage * 100).toFixed(1)}%
      </td>
    </tr>
  )
}

export function ColorLegend() {
  const { matrix, addPaletteColor } = usePuzzle()

  if (!matrix) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
        Palette appears here once an image is processed.
      </div>
    )
  }

  const handleAddColor = () => {
    const r = Math.floor(Math.random() * 255)
    const g = Math.floor(Math.random() * 255)
    const b = Math.floor(Math.random() * 255)
    const h = (n: number) => n.toString(16).padStart(2, "0")
    addPaletteColor(`#${h(r)}${h(g)}${h(b)}`)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-2 py-2 font-medium">Key</th>
              <th className="px-2 py-2 font-medium">Color</th>
              <th className="px-2 py-2 text-right font-medium">Pixels</th>
              <th className="px-2 py-2 text-right font-medium">Cover</th>
            </tr>
          </thead>
          <tbody>
            {matrix.palette.map((c) => (
              <ColorLegendRow key={c.index} c={c} />
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={handleAddColor}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed py-2 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
      >
        <Plus className="h-3 w-3" /> Add Custom Color
      </button>
    </div>
  )
}
