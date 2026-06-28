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
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
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

  // --- History State for Undo/Redo ---
  const historyRef = useRef<VoxelMatrix[]>([])
  const historyIndexRef = useRef<number>(-1)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

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
        historyRef.current = [data.matrix]
        historyIndexRef.current = 0
        setCanUndo(false)
        setCanRedo(false)
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

  const applyMatrixUpdate = useCallback((updater: (prev: VoxelMatrix) => VoxelMatrix) => {
    const current = historyRef.current[historyIndexRef.current]
    if (!current) return
    const next = updater(current)
    if (next === current) return
    
    const currentIdx = historyIndexRef.current
    if (currentIdx < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, currentIdx + 1)
    }
    historyRef.current.push(next)
    if (historyRef.current.length > 20) {
      historyRef.current.shift()
    } else {
      historyIndexRef.current += 1
    }
    
    setCanUndo(historyIndexRef.current > 0)
    setCanRedo(false)
    setMatrix(next)
  }, [])

  const updatePaletteColor = useCallback((index: number, hex: string) => {
    applyMatrixUpdate((prev) => {
      const newPalette = [...prev.palette]
      newPalette[index] = { ...newPalette[index], hex, rgb: hexToRgb(hex) }
      return { ...prev, palette: newPalette }
    })
  }, [applyMatrixUpdate])

  const addPaletteColor = useCallback((hex: string) => {
    applyMatrixUpdate((prev) => {
      const newPalette = [...prev.palette]
      const newIndex = newPalette.length
      
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
  }, [applyMatrixUpdate])

  const paintCell = useCallback((x: number, y: number, colorIndex: number) => {
    applyMatrixUpdate((prev) => {
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
  }, [applyMatrixUpdate])

  const toggleColorVisibility = useCallback((index: number) => {
    applyMatrixUpdate((prev) => {
      const newPalette = [...prev.palette]
      newPalette[index] = { ...newPalette[index], ignored: !newPalette[index].ignored }
      return { ...prev, palette: newPalette }
    })
  }, [applyMatrixUpdate])

  const mergeColors = useCallback((sourceIndex: number, targetIndex: number) => {
    if (sourceIndex === targetIndex) return
    applyMatrixUpdate((prev) => {
      const newCells = prev.cells.map(col => col.map(c => ({...c})))
      const targetHex = prev.palette[targetIndex].hex
      const targetLabel = prev.palette[targetIndex].label
      
      let movedCount = 0
      
      for (let x = 0; x < prev.width; x++) {
        for (let y = 0; y < prev.height; y++) {
          if (newCells[x][y].colorIndex === sourceIndex) {
            newCells[x][y].colorIndex = targetIndex
            newCells[x][y].hexColor = targetHex
            newCells[x][y].label = targetLabel
            movedCount++
          } else if (newCells[x][y].colorIndex > sourceIndex) {
            newCells[x][y].colorIndex--
          }
        }
      }
      
      const newPalette = prev.palette.filter((_, i) => i !== sourceIndex).map((p, i) => {
        return { ...p, index: i }
      })
      
      const adjustedTargetIndex = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex
      newPalette[adjustedTargetIndex].count += movedCount
      
      const totalPixels = prev.width * prev.height
      for (const p of newPalette) {
         p.coverage = p.count / totalPixels
      }
      
      setActiveColorIndex(curr => {
        if (curr === sourceIndex) return adjustedTargetIndex
        if (curr > sourceIndex) return curr - 1
        return curr
      })
      
      return { ...prev, cells: newCells, palette: newPalette }
    })
  }, [applyMatrixUpdate])

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1
      setMatrix(historyRef.current[historyIndexRef.current])
      setCanUndo(historyIndexRef.current > 0)
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1)
    }
  }, [])

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1
      setMatrix(historyRef.current[historyIndexRef.current])
      setCanUndo(historyIndexRef.current > 0)
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1)
    }
  }, [])

  const reset = useCallback(() => {
    setMatrix(null)
    setImageData(null)
    setFileName(null)
    setPaintMode(false)
    setActiveColorIndex(0)
    historyRef.current = []
    historyIndexRef.current = -1
    setCanUndo(false)
    setCanRedo(false)
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
    canUndo,
    canRedo,
    undo,
    redo,
    loadCroppedImage,
    updateConfig,
    reset,
  }

  return <PuzzleContext.Provider value={value}>{children}</PuzzleContext.Provider>
}
