"use client"

import { useMemo, useState, useCallback } from "react"
import { Play, Volume2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { BeatMap, AudioData } from "@/lib/audio"
import { audioEngine } from "@/lib/audio"

interface BeatGridProps {
  beatMap: BeatMap | null
  audioData: AudioData | null
  currentTime: number
  slicesPerBeat: number
  onBeatClick: (beatIndex: number) => void
  isPlaying: boolean
}

export function BeatGrid({
  beatMap,
  audioData,
  currentTime,
  slicesPerBeat,
  onBeatClick,
  isPlaying,
}: BeatGridProps) {
  const [playingBeat, setPlayingBeat] = useState<number | null>(null)

  // Calculate which beat is currently playing
  const currentBeatIndex = useMemo(() => {
    if (!beatMap || !isPlaying) return -1

    for (let i = beatMap.beats.length - 1; i >= 0; i--) {
      if (currentTime >= beatMap.beats[i].time) {
        return i
      }
    }
    return -1
  }, [beatMap, currentTime, isPlaying])

  // Preview a single beat
  const previewBeat = useCallback(
    (beatIndex: number) => {
      if (!beatMap || !audioData) return

      const beatStart = beatMap.beatPositions[beatIndex]
      const beatEnd =
        beatIndex < beatMap.beatPositions.length - 1
          ? beatMap.beatPositions[beatIndex + 1]
          : audioData.samples[0].length

      const beatSamples = audioData.samples.map((ch) => ch.slice(beatStart, beatEnd))
      const buffer = audioEngine.createBufferFromSamples(beatSamples, audioData.sampleRate)

      setPlayingBeat(beatIndex)
      audioEngine.play(buffer, 0, 1)

      // Reset playing state after beat duration
      const duration = buffer.duration * 1000
      setTimeout(() => setPlayingBeat(null), duration)
    },
    [beatMap, audioData]
  )

  if (!beatMap || beatMap.beats.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-8 text-center text-muted-foreground">
        <p>Load an audio file to see the beat grid</p>
      </div>
    )
  }

  // Group beats into measures (assuming 4/4 time)
  const beatsPerMeasure = 4
  const measures = Math.ceil(beatMap.beats.length / beatsPerMeasure)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Beat Grid</h3>
        <span className="text-xs text-muted-foreground">
          {beatMap.beats.length} beats in {measures} measures
        </span>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4">
          {Array.from({ length: measures }).map((_, measureIndex) => (
            <div key={measureIndex} className="flex-shrink-0">
              <div className="text-xs text-muted-foreground mb-2 text-center">
                {measureIndex + 1}
              </div>
              <div className="flex gap-1">
                {Array.from({ length: beatsPerMeasure }).map((_, beatInMeasure) => {
                  const beatIndex = measureIndex * beatsPerMeasure + beatInMeasure

                  if (beatIndex >= beatMap.beats.length) {
                    return (
                      <div
                        key={beatIndex}
                        className="w-10 h-10 rounded bg-secondary/30"
                      />
                    )
                  }

                  const beat = beatMap.beats[beatIndex]
                  const isCurrentBeat = beatIndex === currentBeatIndex
                  const isPreviewPlaying = beatIndex === playingBeat
                  const isStrongBeat = beatInMeasure === 0

                  return (
                    <button
                      key={beatIndex}
                      onClick={() => previewBeat(beatIndex)}
                      className={cn(
                        "beat-cell w-10 h-10 relative group",
                        isCurrentBeat && "playing",
                        isPreviewPlaying && "active",
                        isStrongBeat && "ring-1 ring-primary/30"
                      )}
                      title={`Beat ${beatIndex + 1} (${beat.time.toFixed(3)}s)`}
                    >
                      {/* Beat number */}
                      <span className="text-xs font-mono opacity-50 group-hover:opacity-100">
                        {beatIndex}
                      </span>

                      {/* Strength indicator */}
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-primary/40"
                        style={{ height: `${Math.min(100, beat.strength * 100)}%` }}
                      />

                      {/* Play indicator on hover */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="h-4 w-4 text-primary" />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Slice grid for selected beat */}
      {slicesPerBeat > 1 && (
        <div className="text-xs text-muted-foreground">
          Each beat divided into {slicesPerBeat} slices for fine-grained control
        </div>
      )}
    </div>
  )
}
