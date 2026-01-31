"use client"

import { useRef, useEffect, useCallback, useState } from "react"
import type { AudioData, BeatMap } from "@/lib/audio"

interface WaveformDisplayProps {
  audioData: AudioData | null
  beatMap: BeatMap | null
  processedSamples: Float32Array[] | null
  currentTime: number
  duration: number
  onSeek: (time: number) => void
  isPlaying: boolean
  showBeats?: boolean
  showProcessed?: boolean
}

export function WaveformDisplay({
  audioData,
  beatMap,
  processedSamples,
  currentTime,
  duration,
  onSeek,
  isPlaying,
  showBeats = true,
  showProcessed = true,
}: WaveformDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 160 })
  const animationFrameRef = useRef<number>()

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({
          width: Math.floor(rect.width * window.devicePixelRatio),
          height: Math.floor(rect.height * window.devicePixelRatio),
        })
      }
    }

    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [])

  // Draw waveform
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { width, height } = dimensions
    canvas.width = width
    canvas.height = height

    // Clear canvas
    ctx.fillStyle = "hsl(0, 0%, 5%)"
    ctx.fillRect(0, 0, width, height)

    // Draw center line
    ctx.strokeStyle = "hsl(0, 0%, 15%)"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, height / 2)
    ctx.lineTo(width, height / 2)
    ctx.stroke()

    // Get samples to display
    const samplesToShow = showProcessed && processedSamples ? processedSamples : audioData?.samples
    const sampleRate = audioData?.sampleRate || 44100
    const totalDuration = showProcessed && processedSamples
      ? processedSamples[0].length / sampleRate
      : audioData?.duration || 0

    if (!samplesToShow || samplesToShow[0].length === 0) {
      // Draw placeholder text
      ctx.fillStyle = "hsl(0, 0%, 30%)"
      ctx.font = `${14 * window.devicePixelRatio}px system-ui, sans-serif`
      ctx.textAlign = "center"
      ctx.fillText("Drop an audio file here to get started", width / 2, height / 2)
      return
    }

    // Calculate samples per pixel
    const totalSamples = samplesToShow[0].length
    const samplesPerPixel = totalSamples / width

    // Draw waveform
    ctx.beginPath()
    ctx.strokeStyle = "hsl(165, 80%, 45%)"
    ctx.lineWidth = 1

    const mono =
      samplesToShow.length > 1
        ? samplesToShow[0].map((v, i) => (v + samplesToShow[1][i]) / 2)
        : samplesToShow[0]

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

      const yMin = ((1 - max) / 2) * height
      const yMax = ((1 - min) / 2) * height

      if (x === 0) {
        ctx.moveTo(x, yMin)
      }
      ctx.lineTo(x, yMin)
      ctx.lineTo(x, yMax)
    }

    ctx.stroke()

    // Draw filled waveform
    ctx.fillStyle = "hsl(165, 80%, 45%, 0.15)"
    ctx.beginPath()

    // Top half
    for (let x = 0; x < width; x++) {
      const startSample = Math.floor(x * samplesPerPixel)
      const endSample = Math.floor((x + 1) * samplesPerPixel)

      let max = 0
      for (let i = startSample; i < endSample && i < mono.length; i++) {
        const sample = mono[i]
        if (sample > max) max = sample
      }

      const y = ((1 - max) / 2) * height
      if (x === 0) {
        ctx.moveTo(x, height / 2)
      }
      ctx.lineTo(x, y)
    }

    ctx.lineTo(width, height / 2)
    ctx.closePath()
    ctx.fill()

    // Bottom half
    ctx.beginPath()
    for (let x = 0; x < width; x++) {
      const startSample = Math.floor(x * samplesPerPixel)
      const endSample = Math.floor((x + 1) * samplesPerPixel)

      let min = 0
      for (let i = startSample; i < endSample && i < mono.length; i++) {
        const sample = mono[i]
        if (sample < min) min = sample
      }

      const y = ((1 - min) / 2) * height
      if (x === 0) {
        ctx.moveTo(x, height / 2)
      }
      ctx.lineTo(x, y)
    }

    ctx.lineTo(width, height / 2)
    ctx.closePath()
    ctx.fill()

    // Draw beat markers
    if (showBeats && beatMap && !showProcessed) {
      ctx.fillStyle = "hsl(165, 80%, 45%, 0.4)"

      for (const beat of beatMap.beats) {
        const x = (beat.time / totalDuration) * width
        ctx.fillRect(x - 1, 0, 2, height)
      }
    }

    // Draw playhead
    if (totalDuration > 0) {
      const playheadX = (currentTime / totalDuration) * width

      // Playhead line
      ctx.strokeStyle = "hsl(0, 0%, 95%)"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(playheadX, 0)
      ctx.lineTo(playheadX, height)
      ctx.stroke()

      // Playhead glow
      const gradient = ctx.createLinearGradient(playheadX - 20, 0, playheadX + 20, 0)
      gradient.addColorStop(0, "transparent")
      gradient.addColorStop(0.5, "hsl(165, 80%, 45%, 0.3)")
      gradient.addColorStop(1, "transparent")
      ctx.fillStyle = gradient
      ctx.fillRect(playheadX - 20, 0, 40, height)
    }

    // Request next frame if playing
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(drawWaveform)
    }
  }, [
    audioData,
    processedSamples,
    beatMap,
    currentTime,
    duration,
    isPlaying,
    dimensions,
    showBeats,
    showProcessed,
  ])

  // Draw on changes
  useEffect(() => {
    drawWaveform()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [drawWaveform])

  // Handle click to seek
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!duration) return

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const seekTime = (x / rect.width) * duration

      onSeek(Math.max(0, Math.min(duration, seekTime)))
    },
    [duration, onSeek]
  )

  return (
    <div ref={containerRef} className="waveform-container w-full h-40 cursor-pointer">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        className="waveform-canvas"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  )
}
