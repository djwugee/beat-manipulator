"use client"

import { Music, Clock, Activity, Layers, Zap } from "lucide-react"
import type { AudioData, BeatMap } from "@/lib/audio"
import { formatDuration, formatFileSize, estimateFileSize } from "@/lib/audio"

interface BeatInfoPanelProps {
  audioData: AudioData | null
  beatMap: BeatMap | null
  processedSamples: Float32Array[] | null
}

export function BeatInfoPanel({ audioData, beatMap, processedSamples }: BeatInfoPanelProps) {
  if (!audioData || !beatMap) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-card rounded-lg border border-border p-4 animate-pulse"
          >
            <div className="h-4 w-20 bg-secondary rounded mb-2" />
            <div className="h-8 w-16 bg-secondary rounded" />
          </div>
        ))}
      </div>
    )
  }

  const stats = [
    {
      icon: Activity,
      label: "Tempo",
      value: `${beatMap.tempo.toFixed(1)} BPM`,
      detail: `${beatMap.confidence.toFixed(0)}% confidence`,
    },
    {
      icon: Layers,
      label: "Beats Detected",
      value: beatMap.beats.length.toString(),
      detail: `${(beatMap.beats.length / (audioData.duration / 60)).toFixed(1)} per minute`,
    },
    {
      icon: Clock,
      label: "Duration",
      value: formatDuration(audioData.duration),
      detail: `${audioData.sampleRate / 1000}kHz ${audioData.numberOfChannels === 1 ? "Mono" : "Stereo"}`,
    },
    {
      icon: Zap,
      label: "Output",
      value: processedSamples
        ? formatDuration(processedSamples[0].length / audioData.sampleRate)
        : "--:--",
      detail: processedSamples
        ? formatFileSize(
            estimateFileSize(
              processedSamples[0].length / audioData.sampleRate,
              audioData.sampleRate,
              processedSamples.length,
              16
            )
          )
        : "Not processed",
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map(({ icon: Icon, label, value, detail }) => (
        <div
          key={label}
          className="bg-card rounded-lg border border-border p-4"
        >
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Icon className="h-4 w-4" />
            <span className="text-xs font-medium">{label}</span>
          </div>
          <p className="text-2xl font-bold font-mono">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{detail}</p>
        </div>
      ))}
    </div>
  )
}
