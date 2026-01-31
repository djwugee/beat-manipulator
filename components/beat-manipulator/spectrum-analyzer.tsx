"use client"

import { useRef, useEffect, useCallback, useState } from "react"
import { audioEngine } from "@/lib/audio"

interface SpectrumAnalyzerProps {
  isPlaying: boolean
  height?: number
  barCount?: number
  smoothing?: number
}

export function SpectrumAnalyzer({
  isPlaying,
  height = 80,
  barCount = 64,
  smoothing = 0.8,
}: SpectrumAnalyzerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number>()
  const [dimensions, setDimensions] = useState({ width: 400, height })

  useEffect(() => {
    const updateDimensions = () => {
      if (canvasRef.current) {
        const rect = canvasRef.current.parentElement?.getBoundingClientRect()
        if (rect) {
          setDimensions({
            width: Math.floor(rect.width * window.devicePixelRatio),
            height: Math.floor(height * window.devicePixelRatio),
          })
        }
      }
    }

    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [height])

  const draw = useCallback(() => {
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

    const analyser = audioEngine.getAnalyserNode()

    if (!analyser || !isPlaying) {
      // Draw idle state
      const barWidth = width / barCount
      ctx.fillStyle = "hsl(0, 0%, 15%)"

      for (let i = 0; i < barCount; i++) {
        const x = i * barWidth
        const barHeight = 4
        ctx.fillRect(x + 1, height - barHeight, barWidth - 2, barHeight)
      }

      return
    }

    analyser.fftSize = 256
    analyser.smoothingTimeConstant = smoothing
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    analyser.getByteFrequencyData(dataArray)

    const barWidth = width / barCount
    const step = Math.floor(bufferLength / barCount)

    for (let i = 0; i < barCount; i++) {
      // Average multiple frequency bins for each bar
      let sum = 0
      for (let j = 0; j < step; j++) {
        sum += dataArray[i * step + j]
      }
      const average = sum / step

      const barHeight = (average / 255) * height * 0.9

      // Color gradient based on frequency
      const hue = 165 - (i / barCount) * 30 // Teal to green
      const saturation = 70 + (average / 255) * 30
      const lightness = 40 + (average / 255) * 20

      ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`

      const x = i * barWidth
      const y = height - barHeight
      const radius = Math.min(barWidth / 4, 4)

      // Draw rounded bar
      ctx.beginPath()
      ctx.moveTo(x + 1 + radius, y)
      ctx.lineTo(x + barWidth - 2 - radius, y)
      ctx.quadraticCurveTo(x + barWidth - 2, y, x + barWidth - 2, y + radius)
      ctx.lineTo(x + barWidth - 2, height)
      ctx.lineTo(x + 1, height)
      ctx.lineTo(x + 1, y + radius)
      ctx.quadraticCurveTo(x + 1, y, x + 1 + radius, y)
      ctx.fill()

      // Add glow effect for high amplitude bars
      if (average > 180) {
        ctx.shadowColor = `hsl(${hue}, 80%, 50%)`
        ctx.shadowBlur = 10
        ctx.fill()
        ctx.shadowBlur = 0
      }
    }

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(draw)
    }
  }, [isPlaying, dimensions, barCount, smoothing])

  useEffect(() => {
    draw()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [draw])

  return (
    <div className="w-full rounded-lg overflow-hidden bg-card border border-border">
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: `${height}px` }}
      />
    </div>
  )
}
