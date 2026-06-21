// Phase 2: Dedicated Web Worker. Runs downscale + quantization off the UI thread.
/// <reference lib="webworker" />

import { buildMatrix, exactResample } from "./image-processing"
import type { ProcessRequest, WorkerOutbound } from "./types"

const ctx = self as unknown as DedicatedWorkerGlobalScope

ctx.addEventListener("message", (event: MessageEvent<ProcessRequest>) => {
  const data = event.data
  if (!data || data.type !== "process") return

  try {
    const down = exactResample(data.imageData, data.width, data.height)
    const matrix = buildMatrix(down, data.colorCount)
    const message: WorkerOutbound = { type: "result", matrix }
    ctx.postMessage(message)
  } catch (err) {
    const message: WorkerOutbound = {
      type: "error",
      message: err instanceof Error ? err.message : "Unknown processing error",
    }
    ctx.postMessage(message)
  }
})

export {}
