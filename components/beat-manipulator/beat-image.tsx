"use client"

import { useRef, useEffect, useCallback, useState } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { AudioData, BeatMap } from "@/lib/audio"

interface BeatImageProps {
  audioData: AudioData | null
  beatMap: BeatMap | null
  height?: number
}

export function BeatImage({ audioData, beatMap, height = 200 }: BeatImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  const generateImage = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !audioData || !beatMap) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // High resolution image
    const width = 1920
    canvas.width = width
    canvas.height = height * 2

    // Background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
    bgGradient.addColorStop(0, "hsl(0, 0%, 5%)")
    bgGradient.addColorStop(1, "hsl(0, 0%, 8%)")
    ctx.fillStyle = bgGradient
    ctx.fillRect(0, 0, width, canvas.height)

    // Get mono audio
    const samples = audioData.samples
    const mono =
      samples.length > 1
        ? samples[0].map((v, i) => (v + samples[1][i]) / 2)
        : samples[0]

    const totalSamples = mono.length
    const samplesPerPixel = totalSamples / width
    const centerY = canvas.height / 2

    // Draw waveform with beat-based coloring
    for (let x = 0; x < width; x++) {
      const startSample = Math.floor(x * samplesPerPixel)
      const endSample = Math.floor((x + 1) * samplesPerPixel)

      let min = 0
      let max = 0

      for (let i = startSample; i < endSample && i < mono.length; i++) {
        const sample = mono[i]
        if (sample < min) min = sample
        if (sample > max) max = sample
      }

      // Find which beat this position belongs to
      const time = (x / width) * audioData.duration
      let beatIndex = -1
      for (let i = beatMap.beats.length - 1; i >= 0; i--) {
        if (time >= beatMap.beats[i].time) {
          beatIndex = i
          break
        }
      }

      // Color based on beat position
      const hue = beatIndex >= 0 ? (beatIndex * 30) % 360 : 165
      const saturation = 70
      const lightness = 50

      const yMin = centerY - max * (canvas.height * 0.4)
      const yMax = centerY - min * (canvas.height * 0.4)

      // Draw gradient bar
      const gradient = ctx.createLinearGradient(x, yMin, x, yMax)
      gradient.addColorStop(0, `hsla(${hue}, ${saturation}%, ${lightness}%, 0.8)`)
      gradient.addColorStop(0.5, `hsla(${hue}, ${saturation}%, ${lightness + 20}%, 1)`)
      gradient.addColorStop(1, `hsla(${hue}, ${saturation}%, ${lightness}%, 0.8)`)

      ctx.fillStyle = gradient
      ctx.fillRect(x, yMin, 1, yMax - yMin)
    }

    // Draw beat markers
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"
    ctx.lineWidth = 1

    for (const beat of beatMap.beats) {
      const x = (beat.time / audioData.duration) * width
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvas.height)
      ctx.stroke()
    }

    // Add info text
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)"
    ctx.font = "24px system-ui, sans-serif"
    ctx.fillText(`${beatMap.tempo.toFixed(1)} BPM - ${beatMap.beats.length} beats`, 20, 40)

    // Generate data URL
    const url = canvas.toDataURL("image/png")
    setImageUrl(url)
  }, [audioData, beatMap, height])

  useEffect(() => {
    generateImage()
  }, [generateImage])

  const downloadImage = useCallback(() => {
    if (!imageUrl) return

    const link = document.createElement("a")
    link.href = imageUrl
    link.download = "beat-visualization.png"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [imageUrl])

  return (
    <div className="space-y-4">
      <div className="relative rounded-lg overflow-hidden border border-border">
        <canvas
          ref={canvasRef}
          className="w-full"
          style={{ height: `${height}px` }}
        />
        {!audioData && (
          <div className="absolute inset-0 flex items-center justify-center bg-card">
            <p className="text-muted-foreground">Load audio to generate visualization</p>
          </div>
        )}
      </div>

      {imageUrl && (
        <Button variant="outline" onClick={downloadImage} className="w-full gap-2">
          <Download className="h-4 w-4" />
          Download Beat Image
        </Button>
      )}
    </div>
  )
}
