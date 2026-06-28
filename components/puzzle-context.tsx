"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { planBoardSplit, type SplitPlan } from "@/lib/board-splitter"
import { computeLayout, type GridLayout } from "@/lib/grid-engine"
import {
  DEFAULT_CONFIG,
  PRINTER_BEDS,
  type PuzzleConfig,
  type VoxelMatrix,
  type WorkerOutbound,
} from "@/lib/types"

const MAX_SOURCE_EDGE = 1024

interface PuzzleContextValue {
  fileName: string | null
  imageUrl: string | null
  hasImage: boolean
  processing: boolean
  matrix: VoxelMatrix | null
  layout: GridLayout | null
  split: SplitPlan | null
  config: PuzzleConfig
  paintMode: boolean
  activeColorIndex: number
  setPaintMode: (mode: boolean) => void
  setActiveColorIndex: (index: number) => void
  updatePaletteColor: (index: number, hex: string) => void
  addPaletteColor: (hex: string) => void
  paintCell: (x: number, y: number, colorIndex: number) => void
  loadCroppedImage: (url: string, fileName: string) => void
  toggleColorVisibility: (index: number) => void
  mergeColors: (sourceIndex: number, targetIndex: number) => void
  updateConfig: (patch: Partial<PuzzleConfig>) => void
  reset: () => void
}

const PuzzleContext = createContext<PuzzleContextValue | null>(null)

export function usePuzzle(): PuzzleContextValue {
  const ctx = useContext(PuzzleContext)
  if (!ctx) throw new Error("usePuzzle must be used within PuzzleProvider")
  return ctx
}

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.substring(1)
  const rgb = parseInt(c, 16)
  return [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255]
}

export function PuzzleProvider({ children }: { children: React.ReactNode }) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageData, setImageData] = useState<ImageData | null>(null)
  const [matrix, setMatrix] = useState<VoxelMatrix | null>(null)
  const [processing, setProcessing] = useState(false)
  const [config, setConfig] = useState<PuzzleConfig>(DEFAULT_CONFIG)
  
  const [paintMode, setPaintMode] = useState(false)
  const [activeColorIndex, setActiveColorIndex] = useState(0)

  const workerRef = useRef<Worker | null>(null)
  const requestId = useRef(0)

  // Spin up the dedicated worker once.
  useEffect(() => {
    const worker = new Worker(new URL("../lib/image.worker.ts", import.meta.url))
    workerRef.current = worker
    worker.onmessage = (e: MessageEvent<WorkerOutbound>) => {
      const data = e.data
      setProcessing(false)
      if (data.type === "result") {
        setMatrix(data.matrix)
        setPaintMode(false)
        setActiveColorIndex(0)
      } else if (data.type === "error") {
        console.log("[v0] worker error:", data.message)
      }
    }
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  // Re-run quantization whenever the source or quantization params change.
  useEffect(() => {
    if (!imageData || !workerRef.current) return
    requestId.current += 1
    setProcessing(true)
    
    const w = config.resolutionMultiplier * config.basePlateSize * config.cropRatio.w
    const h = config.resolutionMultiplier * config.basePlateSize * config.cropRatio.h
    
    workerRef.current.postMessage({
      type: "process",
      imageData,
      width: w,
      height: h,
      colorCount: config.colorCount,
    })
  }, [
    imageData, 
    config.resolutionMultiplier, 
    config.basePlateSize, 
    config.cropRatio.w, 
    config.cropRatio.h, 
    config.colorCount
  ])

  const loadCroppedImage = useCallback((url: string, fileNameStr: string) => {
    setFileName(fileNameStr)
    setImageUrl((prev) => {
      // Don't revoke if it's not a blob URL, but just in case
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev)
      return url
    })

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      const scale = Math.min(1, MAX_SOURCE_EDGE / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      if (!ctx) return
      ctx.drawImage(img, 0, 0, w, h)
      setImageData(ctx.getImageData(0, 0, w, h))
    }
    img.src = url
  }, [])

  const updateConfig = useCallback((patch: Partial<PuzzleConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch }
      // Keep bed dimensions synced with the selected preset.
      if (patch.bedId && patch.bedId !== "custom") {
        const bed = PRINTER_BEDS.find((b) => b.id === patch.bedId)
        if (bed) {
          next.bedWidth = bed.width
          next.bedDepth = bed.depth
        }
      }
      return next
    })
  }, [])

  const updatePaletteColor = useCallback((index: number, hex: string) => {
    setMatrix((prev) => {
      if (!prev) return prev
      const newPalette = [...prev.palette]
      newPalette[index] = { ...newPalette[index], hex, rgb: hexToRgb(hex) }
      return { ...prev, palette: newPalette }
    })
  }, [])

  const addPaletteColor = useCallback((hex: string) => {
    setMatrix((prev) => {
      if (!prev) return prev
      const newPalette = [...prev.palette]
      const newIndex = newPalette.length
      
      // Basic label generator for custom colors: AA, AB, etc. if we exceed Z.
      // But we can just use the labelForIndex logic from image-processing if we had it exported,
      // or a simple inline one for now:
      let label = ""
      let n = newIndex
      do {
        label = String.fromCharCode(65 + (n % 26)) + label
        n = Math.floor(n / 26) - 1
      } while (n >= 0)

      newPalette.push({
        index: newIndex,
        label,
        hex,
        rgb: hexToRgb(hex),
        count: 0,
        coverage: 0,
      })
      return { ...prev, palette: newPalette }
    })
  }, [])

  const paintCell = useCallback((x: number, y: number, colorIndex: number) => {
    setMatrix((prev) => {
      if (!prev) return prev
      if (x < 0 || x >= prev.width || y < 0 || y >= prev.height) return prev

      const oldColorIndex = prev.cells[x][y].colorIndex
      if (oldColorIndex === colorIndex) return prev

      const newCells = [...prev.cells]
      newCells[x] = [...newCells[x]]
      newCells[x][y] = {
        ...newCells[x][y],
        colorIndex,
        hexColor: prev.palette[colorIndex].hex,
        label: prev.palette[colorIndex].label,
      }

      const newPalette = prev.palette.map((p) => ({ ...p }))
      newPalette[oldColorIndex].count--
      newPalette[colorIndex].count++
      
      const totalPixels = prev.width * prev.height
      newPalette[oldColorIndex].coverage = newPalette[oldColorIndex].count / totalPixels
      newPalette[colorIndex].coverage = newPalette[colorIndex].count / totalPixels

      return { ...prev, cells: newCells, palette: newPalette }
    })
  }, [])

  const toggleColorVisibility = useCallback((index: number) => {
    setMatrix((prev) => {
      if (!prev) return prev
      const newPalette = [...prev.palette]
      newPalette[index] = { ...newPalette[index], ignored: !newPalette[index].ignored }
      return { ...prev, palette: newPalette }
    })
  }, [])

  const mergeColors = useCallback((sourceIndex: number, targetIndex: number) => {
    if (sourceIndex === targetIndex) return
    setMatrix((prev) => {
      if (!prev) return prev
      
      const newCells = prev.cells.map(col => col.map(c => ({...c})))
      const targetHex = prev.palette[targetIndex].hex
      const targetLabel = prev.palette[targetIndex].label
      
      let movedCount = 0
      
      // Update cells
      for (let x = 0; x < prev.width; x++) {
        for (let y = 0; y < prev.height; y++) {
          if (newCells[x][y].colorIndex === sourceIndex) {
            newCells[x][y].colorIndex = targetIndex
            newCells[x][y].hexColor = targetHex
            newCells[x][y].label = targetLabel
            movedCount++
          } else if (newCells[x][y].colorIndex > sourceIndex) {
            // Shift color indices down for colors that come after the deleted source color
            newCells[x][y].colorIndex--
          }
        }
      }
      
      // Remove the source color from the palette completely
      const newPalette = prev.palette.filter((_, i) => i !== sourceIndex).map((p, i) => {
        // Re-index since we removed one
        const updated = { ...p, index: i }
        if (p.index === targetIndex || p.index === targetIndex - (targetIndex > sourceIndex ? 1 : 0)) {
          // Note: if targetIndex > sourceIndex, the target's index will shift down by 1 in the new array.
          // Wait, p.index here is the OLD index? No, we mapped it to `i`. 
        }
        return updated
      })
      
      // Update counts for the merged target
      const adjustedTargetIndex = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex
      newPalette[adjustedTargetIndex].count += movedCount
      
      // Recalculate coverage for all
      const totalPixels = prev.width * prev.height
      for (const p of newPalette) {
         p.coverage = p.count / totalPixels
      }
      
      // Fix activeColorIndex if it was pointing to the deleted one or one after it
      setActiveColorIndex(curr => {
        if (curr === sourceIndex) return adjustedTargetIndex
        if (curr > sourceIndex) return curr - 1
        return curr
      })
      
      return { ...prev, cells: newCells, palette: newPalette }
    })
  }, [])

  const reset = useCallback(() => {
    setMatrix(null)
    setImageData(null)
    setFileName(null)
    setPaintMode(false)
    setActiveColorIndex(0)
    setImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }, [])

  const layout = useMemo<GridLayout | null>(
    () => (matrix ? computeLayout(matrix, config) : null),
    [matrix, config],
  )
  const split = useMemo<SplitPlan | null>(
    () => (layout ? planBoardSplit(layout, config) : null),
    [layout, config],
  )

  const value: PuzzleContextValue = {
    fileName,
    imageUrl,
    hasImage: !!matrix,
    processing,
    matrix,
    layout,
    split,
    config,
    paintMode,
    activeColorIndex,
    setPaintMode,
    setActiveColorIndex,
    updatePaletteColor,
    addPaletteColor,
    paintCell,
    toggleColorVisibility,
    mergeColors,
    loadCroppedImage,
    updateConfig,
    reset,
  }

  return <PuzzleContext.Provider value={value}>{children}</PuzzleContext.Provider>
}
