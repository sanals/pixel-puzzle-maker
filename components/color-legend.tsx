"use client"

import { useEffect, useRef, useState } from "react"
import { usePuzzle } from "@/components/puzzle-context"
import { contrastText } from "@/lib/image-processing"
import { Plus, Eye, EyeOff, GitMerge } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { PaletteColor } from "@/lib/types"

function ColorLegendRow({ c }: { readonly c: PaletteColor }) {
  const { paintMode, activeColorIndex, setActiveColorIndex, updatePaletteColor, toggleColorVisibility, mergeColors, matrix } = usePuzzle()
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
      <td className="px-1.5 py-2">
        <div className="flex items-center gap-1.5">
          <div
            className="relative flex size-6 items-center justify-center overflow-hidden rounded-md border border-border/60 transition-colors text-xs font-bold tabular-nums cursor-pointer"
            style={{ backgroundColor: localHex, color: contrastText(...c.rgb) }}
            title="Click to edit color"
          >
            {c.label}
            <input
              type="color"
              value={localHex}
              onChange={handleChange}
              className="absolute -inset-2 size-10 cursor-pointer appearance-none bg-transparent opacity-0"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <code className="text-[11px] text-muted-foreground tracking-tighter">{localHex.toUpperCase()}</code>
        </div>
      </td>
      <td className="px-1.5 py-2 text-right tabular-nums text-muted-foreground">
        {c.count.toLocaleString()}
      </td>
      <td className="px-1.5 py-2 text-right tabular-nums font-medium">
        {(c.coverage * 100).toFixed(1)}%
      </td>
      <td className="px-1.5 py-2">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleColorVisibility(c.index)
            }}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            title={c.ignored ? "Show tiles" : "Hide tiles (skip printing)"}
          >
            {c.ignored ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
          
          <DropdownMenu>
            <DropdownMenuTrigger 
              onClick={(e) => e.stopPropagation()}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground border-none bg-transparent cursor-pointer"
              title="Merge into another color"
            >
              <GitMerge className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[180px]">
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Merge into...</div>
              {matrix?.palette.filter(target => target.index !== c.index).map((target) => (
                <DropdownMenuItem
                  key={target.index}
                  onClick={(e) => {
                    e.stopPropagation()
                    mergeColors(c.index, target.index)
                  }}
                  className="gap-2 text-xs cursor-pointer"
                >
                  <span
                    className="size-3 rounded-full border border-border/60"
                    style={{ backgroundColor: target.hex }}
                  />
                  {target.label} ({target.hex.toUpperCase()})
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
      <div className="overflow-x-auto overflow-y-hidden rounded-lg border scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-1.5 py-2 font-medium">Color</th>
              <th className="px-1.5 py-2 text-right font-medium">Pixels</th>
              <th className="px-1.5 py-2 text-right font-medium">Cover</th>
              <th className="px-1.5 py-2 text-right font-medium">Actions</th>
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
