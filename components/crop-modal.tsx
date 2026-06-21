"use client"

import { useState, useRef, useEffect } from "react"
import ReactCrop, { centerCrop, makeAspectCrop, type Crop, type PixelCrop } from "react-image-crop"
import "react-image-crop/dist/ReactCrop.css"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { CROP_RATIOS, type CropRatio } from "@/lib/types"

interface CropModalProps {
  file: File | null
  onCancel: () => void
  onComplete: (dataUrl: string, ratio: CropRatio) => void
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: "%",
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

export function CropModal({ file, onCancel, onComplete }: CropModalProps) {
  const [imgSrc, setImgSrc] = useState("")
  const imgRef = useRef<HTMLImageElement>(null)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [scale, setScale] = useState(1)
  const [selectedRatio, setSelectedRatio] = useState<CropRatio>(CROP_RATIOS[0])

  useEffect(() => {
    if (file) {
      const reader = new FileReader()
      reader.addEventListener("load", () => setImgSrc(reader.result?.toString() || ""))
      reader.readAsDataURL(file)
    }
  }, [file])

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget
    setCrop(centerAspectCrop(width, height, selectedRatio.w / selectedRatio.h))
  }

  function handleRatioChange(ratio: CropRatio) {
    setSelectedRatio(ratio)
    if (imgRef.current) {
      setCrop(centerAspectCrop(imgRef.current.width, imgRef.current.height, ratio.w / ratio.h))
    }
  }

  async function handleComplete() {
    if (!completedCrop || !imgRef.current) return

    const image = imgRef.current
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height
    
    // Create a high-quality crop
    canvas.width = completedCrop.width * scaleX
    canvas.height = completedCrop.height * scaleY

    ctx.imageSmoothingQuality = "high"

    const cropX = completedCrop.x * scaleX
    const cropY = completedCrop.y * scaleY
    const cropWidth = completedCrop.width * scaleX
    const cropHeight = completedCrop.height * scaleY

    // Apply scale (zoom) from center
    const centerX = image.naturalWidth / 2
    const centerY = image.naturalHeight / 2
    
    ctx.save()
    // Translate to center of crop
    ctx.translate(canvas.width / 2, canvas.height / 2)
    // Scale
    ctx.scale(scale, scale)
    // Translate back to draw image correctly relative to crop window
    ctx.translate(-canvas.width / 2, -canvas.height / 2)
    
    ctx.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      canvas.width,
      canvas.height
    )
    
    ctx.restore()

    const base64Image = canvas.toDataURL("image/jpeg")
    onComplete(base64Image, selectedRatio)
  }

  if (!file) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-950 text-slate-200 w-full max-w-4xl rounded-xl border border-slate-800 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center shrink-0">
          <h2 className="text-xl font-semibold text-slate-100">Crop Image</h2>
          <Button variant="ghost" onClick={onCancel} className="text-slate-400 hover:text-white">
            Cancel
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-6 flex flex-col items-center bg-slate-900/50 min-h-0">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={selectedRatio.w / selectedRatio.h}
            className="max-h-[50vh]"
          >
            <img
              ref={imgRef}
              alt="Crop me"
              src={imgSrc || undefined}
              style={{ transform: `scale(${scale})`, transformOrigin: "center" }}
              onLoad={onImageLoad}
              className="max-w-full max-h-[50vh] object-contain"
            />
          </ReactCrop>
        </div>

        <div className="p-6 border-t border-slate-800 space-y-6 shrink-0 bg-slate-950">
          <div className="space-y-3">
            <Label className="text-slate-400">Aspect Ratio</Label>
            <div className="flex flex-wrap gap-2">
              {CROP_RATIOS.map((ratio) => (
                <Button
                  key={ratio.id}
                  variant={selectedRatio.id === ratio.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleRatioChange(ratio)}
                  className={selectedRatio.id === ratio.id ? "bg-indigo-600 hover:bg-indigo-700" : "border-slate-700"}
                >
                  {ratio.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <Label className="text-slate-400">Zoom inside crop</Label>
              <span className="text-sm text-slate-500">{scale.toFixed(1)}x</span>
            </div>
            <Slider
              value={[scale]}
              min={1}
              max={3}
              step={0.1}
              onValueChange={(v: any) => setScale(Array.isArray(v) ? v[0] : v)}
              className="py-2"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={handleComplete} size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white px-8">
              Confirm & Continue
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
