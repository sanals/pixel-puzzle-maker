"use client"

import { ImageUp, RefreshCw } from "lucide-react"
import { useCallback, useRef, useState } from "react"
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop"
import "react-image-crop/dist/ReactCrop.css"

import { Button } from "@/components/ui/button"
import { usePuzzle } from "@/components/puzzle-context"
import { cn } from "@/lib/utils"
import { CropModal } from "./crop-modal"
import { type CropRatio } from "@/lib/types"

export function UploadZone() {
  const { loadCroppedImage, fileName, imageUrl, updateConfig, reset } = usePuzzle()
  const inputRef = useRef<HTMLInputElement>(null)

  const [dragging, setDragging] = useState(false)
  const [cropFile, setCropFile] = useState<File | null>(null)

  const handleSelectedFile = useCallback((file: File) => {
    if (!file.type.match(/image\/(png|jpeg|jpg)/)) return
    setCropFile(file)
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) handleSelectedFile(file)
    },
    [handleSelectedFile],
  )

  const handleCropComplete = useCallback((dataUrl: string, ratio: CropRatio) => {
    if (cropFile) {
      updateConfig({ cropRatio: ratio })
      loadCroppedImage(dataUrl, cropFile.name)
      setCropFile(null)
    }
  }, [cropFile, loadCroppedImage, updateConfig])

  const handleCropCancel = useCallback(() => {
    setCropFile(null)
  }, [])

  return (
    <>
      {cropFile && (
        <CropModal
          file={cropFile}
          onCancel={handleCropCancel}
          onComplete={handleCropComplete}
        />
      )}

      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleSelectedFile(file)
            e.target.value = ""
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          aria-label="Upload a PNG or JPEG image"
          className={cn(
            "group relative flex aspect-square w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/40 p-4 text-center transition-colors hover:border-primary/60 hover:bg-muted/70",
            dragging && "border-primary bg-primary/10",
          )}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl || "/placeholder.svg"}
              alt={fileName ? `Preview of ${fileName}` : "Uploaded preview"}
              className="absolute inset-0 size-full object-cover opacity-90"
            />
          ) : (
            <>
              <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ImageUp className="size-6" aria-hidden="true" />
              </span>
              <span className="text-sm font-medium text-foreground">Drop a photo here</span>
              <span className="text-xs text-muted-foreground">PNG or JPEG, click to browse</span>
            </>
          )}
        </button>

        {fileName && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2">
            <span className="truncate text-xs text-muted-foreground" title={fileName}>
              {fileName}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 gap-1 px-2 text-xs"
              onClick={reset}
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Replace
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
