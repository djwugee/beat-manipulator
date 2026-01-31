"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import {
  audioEngine,
  beatDetector,
  beatswapEngine,
  type AudioData,
  type BeatMap,
  downloadAudio,
  formatDuration,
  estimateFileSize,
  PRESET_PATTERNS,
} from "@/lib/audio"

export interface ProcessingState {
  isLoading: boolean
  isProcessing: boolean
  isPlaying: boolean
  progress: number
  error: string | null
}

export interface AudioState {
  audioData: AudioData | null
  beatMap: BeatMap | null
  processedSamples: Float32Array[] | null
  fileName: string | null
}

export interface PatternState {
  pattern: string
  slicesPerBeat: number
  selectedPreset: string | null
}

export interface PlaybackState {
  currentTime: number
  duration: number
  volume: number
}

export function useBeatManipulator() {
  // Processing state
  const [processing, setProcessing] = useState<ProcessingState>({
    isLoading: false,
    isProcessing: false,
    isPlaying: false,
    progress: 0,
    error: null,
  })

  // Audio state
  const [audio, setAudio] = useState<AudioState>({
    audioData: null,
    beatMap: null,
    processedSamples: null,
    fileName: null,
  })

  // Pattern state
  const [patternState, setPatternState] = useState<PatternState>({
    pattern: "0:n",
    slicesPerBeat: 4,
    selectedPreset: "normal",
  })

  // Playback state
  const [playback, setPlayback] = useState<PlaybackState>({
    currentTime: 0,
    duration: 0,
    volume: 1,
  })

  // Refs
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const processedBufferRef = useRef<AudioBuffer | null>(null)

  // Load audio file
  const loadAudioFile = useCallback(async (file: File) => {
    setProcessing((prev) => ({ ...prev, isLoading: true, error: null, progress: 0 }))

    try {
      // Load audio data
      setProcessing((prev) => ({ ...prev, progress: 20 }))
      const audioData = await audioEngine.loadAudioFile(file)

      // Detect beats
      setProcessing((prev) => ({ ...prev, progress: 50 }))
      const beatMap = await beatDetector.detectBeats(audioData)

      // Update state
      setAudio({
        audioData,
        beatMap,
        processedSamples: null,
        fileName: file.name,
      })

      setPlayback((prev) => ({
        ...prev,
        duration: audioData.duration,
        currentTime: 0,
      }))

      setProcessing((prev) => ({ ...prev, progress: 100, isLoading: false }))

      // Process with default pattern
      setTimeout(() => processPattern(audioData, beatMap), 100)
    } catch (error) {
      setProcessing((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to load audio file",
      }))
    }
  }, [])

  // Process pattern
  const processPattern = useCallback(
    async (
      audioDataParam?: AudioData | null,
      beatMapParam?: BeatMap | null,
      patternParam?: string,
      slicesParam?: number
    ) => {
      const audioData = audioDataParam ?? audio.audioData
      const beatMap = beatMapParam ?? audio.beatMap
      const pattern = patternParam ?? patternState.pattern
      const slicesPerBeat = slicesParam ?? patternState.slicesPerBeat

      if (!audioData || !beatMap) return

      setProcessing((prev) => ({ ...prev, isProcessing: true, error: null }))

      try {
        // Use setTimeout to avoid blocking UI
        await new Promise((resolve) => setTimeout(resolve, 0))

        const processedSamples = beatswapEngine.process(audioData, beatMap, {
          pattern,
          slicesPerBeat,
          normalizeOutput: true,
          crossfadeMs: 5,
        })

        // Create audio buffer for playback
        const buffer = audioEngine.createBufferFromSamples(processedSamples, audioData.sampleRate)
        processedBufferRef.current = buffer

        setAudio((prev) => ({ ...prev, processedSamples }))
        setPlayback((prev) => ({
          ...prev,
          duration: buffer.duration,
          currentTime: 0,
        }))

        setProcessing((prev) => ({ ...prev, isProcessing: false }))
      } catch (error) {
        setProcessing((prev) => ({
          ...prev,
          isProcessing: false,
          error: error instanceof Error ? error.message : "Failed to process pattern",
        }))
      }
    },
    [audio.audioData, audio.beatMap, patternState.pattern, patternState.slicesPerBeat]
  )

  // Set pattern
  const setPattern = useCallback(
    (pattern: string) => {
      setPatternState((prev) => ({ ...prev, pattern, selectedPreset: null }))
    },
    []
  )

  // Set slices per beat
  const setSlicesPerBeat = useCallback((slices: number) => {
    setPatternState((prev) => ({ ...prev, slicesPerBeat: slices }))
  }, [])

  // Apply preset
  const applyPreset = useCallback(
    (presetName: string) => {
      const presetPattern = PRESET_PATTERNS[presetName]
      if (presetPattern) {
        setPatternState((prev) => ({
          ...prev,
          pattern: presetPattern,
          selectedPreset: presetName,
        }))
      }
    },
    []
  )

  // Play/Pause
  const togglePlayback = useCallback(() => {
    if (processing.isPlaying) {
      // Pause
      audioEngine.pause()
      setProcessing((prev) => ({ ...prev, isPlaying: false }))

      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current)
        playbackIntervalRef.current = null
      }
    } else {
      // Play
      if (processedBufferRef.current) {
        audioEngine.play(processedBufferRef.current, playback.currentTime, playback.volume)
        setProcessing((prev) => ({ ...prev, isPlaying: true }))

        // Update playback position
        playbackIntervalRef.current = setInterval(() => {
          const currentTime = audioEngine.getCurrentTime()
          const isPlaying = audioEngine.getIsPlaying()

          setPlayback((prev) => ({ ...prev, currentTime }))

          if (!isPlaying) {
            setProcessing((prev) => ({ ...prev, isPlaying: false }))
            setPlayback((prev) => ({ ...prev, currentTime: 0 }))
            if (playbackIntervalRef.current) {
              clearInterval(playbackIntervalRef.current)
              playbackIntervalRef.current = null
            }
          }
        }, 50)
      }
    }
  }, [processing.isPlaying, playback.currentTime, playback.volume])

  // Stop
  const stopPlayback = useCallback(() => {
    audioEngine.stop()
    setProcessing((prev) => ({ ...prev, isPlaying: false }))
    setPlayback((prev) => ({ ...prev, currentTime: 0 }))

    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current)
      playbackIntervalRef.current = null
    }
  }, [])

  // Seek
  const seekTo = useCallback(
    (time: number) => {
      const wasPlaying = processing.isPlaying

      if (wasPlaying) {
        audioEngine.stop()
      }

      setPlayback((prev) => ({ ...prev, currentTime: time }))

      if (wasPlaying && processedBufferRef.current) {
        audioEngine.play(processedBufferRef.current, time, playback.volume)
      }
    },
    [processing.isPlaying, playback.volume]
  )

  // Set volume
  const setVolume = useCallback((vol: number) => {
    audioEngine.setVolume(vol)
    setPlayback((prev) => ({ ...prev, volume: vol }))
  }, [])

  // Export audio
  const exportAudio = useCallback(() => {
    if (!audio.processedSamples || !audio.audioData) return

    const baseName = audio.fileName?.replace(/\.[^/.]+$/, "") || "output"
    downloadAudio(audio.processedSamples, {
      sampleRate: audio.audioData.sampleRate,
      bitDepth: 16,
      filename: `${baseName}_beatswap`,
    })
  }, [audio.processedSamples, audio.audioData, audio.fileName])

  // Get formatted duration
  const getFormattedDuration = useCallback(
    (time: number) => formatDuration(time),
    []
  )

  // Get estimated file size
  const getEstimatedFileSize = useCallback(() => {
    if (!audio.audioData || !audio.processedSamples) return 0
    return estimateFileSize(
      audio.processedSamples[0].length / audio.audioData.sampleRate,
      audio.audioData.sampleRate,
      audio.processedSamples.length,
      16
    )
  }, [audio.audioData, audio.processedSamples])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioEngine.stop()
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current)
      }
    }
  }, [])

  return {
    // State
    processing,
    audio,
    patternState,
    playback,

    // Actions
    loadAudioFile,
    processPattern,
    setPattern,
    setSlicesPerBeat,
    applyPreset,
    togglePlayback,
    stopPlayback,
    seekTo,
    setVolume,
    exportAudio,

    // Utilities
    getFormattedDuration,
    getEstimatedFileSize,
    presets: PRESET_PATTERNS,
  }
}
