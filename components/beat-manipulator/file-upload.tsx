"use client"

import { useCallback, useState } from "react"
import { Upload, Music, FileAudio, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface FileUploadProps {
  onFileSelect: (file: File) => void
  isLoading: boolean
  fileName: string | null
  progress: number
}

const ACCEPTED_FORMATS = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/ogg",
  "audio/flac",
  "audio/aac",
  "audio/m4a",
  "audio/webm",
]

const ACCEPTED_EXTENSIONS = [".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a", ".webm"]

export function FileUpload({ onFileSelect, isLoading, fileName, progress }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = e.dataTransfer.files
      if (files.length > 0) {
        const file = files[0]
        if (isValidAudioFile(file)) {
          onFileSelect(file)
        }
      }
    },
    [onFileSelect]
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        const file = files[0]
        if (isValidAudioFile(file)) {
          onFileSelect(file)
        }
      }
    },
    [onFileSelect]
  )

  const isValidAudioFile = (file: File): boolean => {
    const isValidType = ACCEPTED_FORMATS.includes(file.type)
    const hasValidExtension = ACCEPTED_EXTENSIONS.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    )
    return isValidType || hasValidExtension
  }

  if (isLoading) {
    return (
      <div className="drop-zone p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="spinner" />
          <div className="text-center">
            <p className="text-sm font-medium">Loading audio file...</p>
            <p className="text-xs text-muted-foreground mt-1">Detecting beats and analyzing</p>
          </div>
          <div className="w-full max-w-xs">
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">{progress}%</p>
          </div>
        </div>
      </div>
    )
  }

  if (fileName) {
    return (
      <div className="drop-zone p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileAudio className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium truncate max-w-[300px]">{fileName}</p>
              <p className="text-xs text-muted-foreground">Ready to manipulate</p>
            </div>
          </div>

          <label className="cursor-pointer">
            <input
              type="file"
              accept={ACCEPTED_EXTENSIONS.join(",")}
              onChange={handleFileInput}
              className="hidden"
            />
            <Button variant="outline" size="sm" asChild>
              <span>Change File</span>
            </Button>
          </label>
        </div>
      </div>
    )
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn("drop-zone p-12 cursor-pointer", isDragging && "active")}
    >
      <label className="cursor-pointer">
        <input
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          onChange={handleFileInput}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center">
            {isDragging ? (
              <Music className="h-8 w-8 text-primary" />
            ) : (
              <Upload className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium">
              {isDragging ? "Drop your audio file here" : "Drag and drop an audio file"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              or click to browse (MP3, WAV, OGG, FLAC supported)
            </p>
          </div>
        </div>
      </label>
    </div>
  )
}
