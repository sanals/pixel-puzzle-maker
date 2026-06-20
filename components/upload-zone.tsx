"use client"

import { ImageUp, RefreshCw } from "lucide-react"
import { useCallback, useRef, useState } from "react"
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop"
import "react-image-crop/dist/ReactCrop.css"

import { Button } from "@/components/ui/button"
import { usePuzzle } from "@/components/puzzle-context"
import { cn } from "@/lib/utils"

export function UploadZone() {
  const { loadFile, fileName, imageUrl, reset } = usePuzzle()
  const inputRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  const [dragging, setDragging] = useState(false)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [cropUrl, setCropUrl] = useState<string>("")
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()

  const handleSelectedFile = useCallback((file: File) => {
    if (!file.type.match(/image\/(png|jpeg|jpg)/)) return
    setCropFile(file)
    setCropUrl(URL.createObjectURL(file))
    setCrop(undefined)
    setCompletedCrop(undefined)
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

  const confirmCrop = useCallback(() => {
    if (completedCrop && completedCrop.width > 0 && completedCrop.height > 0 && imgRef.current && cropFile) {
      const img = imgRef.current
      const canvas = document.createElement("canvas")
      const scaleX = img.naturalWidth / img.width
      const scaleY = img.naturalHeight / img.height
      canvas.width = completedCrop.width * scaleX
      canvas.height = completedCrop.height * scaleY
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.drawImage(
          img,
          completedCrop.x * scaleX,
          completedCrop.y * scaleY,
          completedCrop.width * scaleX,
          completedCrop.height * scaleY,
          0,
          0,
          canvas.width,
          canvas.height
        )
        canvas.toBlob((blob) => {
          if (blob) {
            const newFile = new File([blob], cropFile.name, { type: cropFile.type })
            loadFile(newFile)
            setCropUrl("")
            setCropFile(null)
          }
        }, cropFile.type)
        return
      }
    }
    // Bypass crop if no area selected
    if (cropFile) {
      loadFile(cropFile)
      setCropUrl("")
      setCropFile(null)
    }
  }, [completedCrop, cropFile, loadFile])

  return (
    <>
      {cropUrl && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] max-w-[90vw] flex-col gap-4 rounded-xl bg-card p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Frame your image</h2>
              <span className="text-xs text-muted-foreground">Select an area or use full image</span>
            </div>
            <div className="overflow-auto rounded-lg bg-black/20">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img ref={imgRef} src={cropUrl} alt="Crop preview" className="max-h-[60vh] object-contain" />
              </ReactCrop>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setCropUrl(""); setCropFile(null) }}>Cancel</Button>
              <Button onClick={confirmCrop}>
                {completedCrop?.width ? "Confirm Crop" : "Use Full Image"}
              </Button>
            </div>
          </div>
        </div>
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
