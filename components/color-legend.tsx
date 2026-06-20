"use client"

import { usePuzzle } from "@/components/puzzle-context"
import { contrastText } from "@/lib/image-processing"

export function ColorLegend() {
  const { matrix } = usePuzzle()

  if (!matrix) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
        Palette appears here once an image is processed.
      </div>
    )
  }

  return (
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
            <tr key={c.index} className="border-b last:border-0">
              <td className="px-2 py-2">
                <span
                  className="flex size-6 items-center justify-center rounded-md text-xs font-bold tabular-nums"
                  style={{ backgroundColor: c.hex, color: contrastText(...c.rgb) }}
                >
                  {c.label}
                </span>
              </td>
              <td className="px-2 py-2">
                <div className="flex items-center gap-2">
                  <span
                    className="size-4 rounded-sm border border-border/60"
                    style={{ backgroundColor: c.hex }}
                    aria-hidden="true"
                  />
                  <code className="text-xs text-muted-foreground">{c.hex.toUpperCase()}</code>
                </div>
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                {c.count.toLocaleString()}
              </td>
              <td className="px-2 py-2 text-right tabular-nums font-medium">
                {(c.coverage * 100).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
