"use client"

import { Play, Pause, Square, SkipBack, SkipForward, Volume2, Download, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

interface TransportControlsProps {
  isPlaying: boolean
  isProcessing: boolean
  canPlay: boolean
  canExport: boolean
  currentTime: number
  duration: number
  volume: number
  onTogglePlay: () => void
  onStop: () => void
  onSeek: (time: number) => void
  onVolumeChange: (volume: number) => void
  onExport: () => void
  onReprocess: () => void
  formatTime: (time: number) => string
}

export function TransportControls({
  isPlaying,
  isProcessing,
  canPlay,
  canExport,
  currentTime,
  duration,
  volume,
  onTogglePlay,
  onStop,
  onSeek,
  onVolumeChange,
  onExport,
  onReprocess,
  formatTime,
}: TransportControlsProps) {
  return (
    <div className="flex items-center gap-6 p-4 bg-card rounded-lg border border-border">
      {/* Main transport buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onSeek(0)}
          disabled={!canPlay}
          className="h-10 w-10 rounded-full"
        >
          <SkipBack className="h-4 w-4" />
        </Button>

        <Button
          variant={isPlaying ? "secondary" : "default"}
          size="icon"
          onClick={onTogglePlay}
          disabled={!canPlay || isProcessing}
          className={cn(
            "h-12 w-12 rounded-full",
            !isPlaying && canPlay && "bg-primary hover:bg-primary/90 text-primary-foreground"
          )}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onStop}
          disabled={!canPlay}
          className="h-10 w-10 rounded-full"
        >
          <Square className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => onSeek(duration)}
          disabled={!canPlay}
          className="h-10 w-10 rounded-full"
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>

      {/* Time display */}
      <div className="flex items-center gap-2 min-w-[160px]">
        <span className="text-sm font-mono text-foreground">{formatTime(currentTime)}</span>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-mono text-muted-foreground">{formatTime(duration)}</span>
      </div>

      {/* Progress bar */}
      <div className="flex-1">
        <Slider
          value={[currentTime]}
          max={duration || 1}
          step={0.01}
          onValueChange={([value]) => onSeek(value)}
          disabled={!canPlay}
          className="w-full"
        />
      </div>

      {/* Volume control */}
      <div className="flex items-center gap-2 min-w-[120px]">
        <Volume2 className="h-4 w-4 text-muted-foreground" />
        <Slider
          value={[volume * 100]}
          max={100}
          step={1}
          onValueChange={([value]) => onVolumeChange(value / 100)}
          className="w-20"
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={onReprocess}
          disabled={!canPlay || isProcessing}
          className="h-10 w-10"
          title="Reprocess pattern"
        >
          <RefreshCw className={cn("h-4 w-4", isProcessing && "animate-spin")} />
        </Button>

        <Button
          variant="default"
          onClick={onExport}
          disabled={!canExport || isProcessing}
          className="h-10 gap-2"
        >
          <Download className="h-4 w-4" />
          Export WAV
        </Button>
      </div>
    </div>
  )
}
