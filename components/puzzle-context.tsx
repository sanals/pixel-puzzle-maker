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
  loadCroppedImage: (url: string, fileName: string) => void
  updateConfig: (patch: Partial<PuzzleConfig>) => void
  reset: () => void
}

const PuzzleContext = createContext<PuzzleContextValue | null>(null)

export function usePuzzle(): PuzzleContextValue {
  const ctx = useContext(PuzzleContext)
  if (!ctx) throw new Error("usePuzzle must be used within PuzzleProvider")
  return ctx
}

export function PuzzleProvider({ children }: { children: React.ReactNode }) {
  const [fileName, setFileName] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageData, setImageData] = useState<ImageData | null>(null)
  const [matrix, setMatrix] = useState<VoxelMatrix | null>(null)
  const [processing, setProcessing] = useState(false)
  const [config, setConfig] = useState<PuzzleConfig>(DEFAULT_CONFIG)

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

  const reset = useCallback(() => {
    setMatrix(null)
    setImageData(null)
    setFileName(null)
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
    loadCroppedImage,
    updateConfig,
    reset,
  }

  return <PuzzleContext.Provider value={value}>{children}</PuzzleContext.Provider>
}
