/**
 * Beatswap Engine
 * Core beat manipulation logic - arranges audio segments according to patterns
 */

import { type AudioData, AudioEngine } from "./audio-engine"
import { type BeatMap } from "./beat-detector"
import { type ParsedSegment, PatternParser } from "./pattern-parser"
import { effectRegistry } from "./effects"

export interface BeatswapOptions {
  pattern: string
  slicesPerBeat: number
  normalizeOutput: boolean
  crossfadeMs: number
}

export interface LoadedSample {
  name: string
  samples: Float32Array[]
  sampleRate: number
}

const DEFAULT_OPTIONS: BeatswapOptions = {
  pattern: "0:n",
  slicesPerBeat: 4,
  normalizeOutput: true,
  crossfadeMs: 5,
}

export class BeatswapEngine {
  private parser: PatternParser
  private loadedSamples: Map<string, LoadedSample> = new Map()

  constructor() {
    this.parser = new PatternParser()
  }

  /**
   * Load a sample for use in patterns
   */
  loadSample(name: string, samples: Float32Array[], sampleRate: number): void {
    this.loadedSamples.set(name, { name, samples, sampleRate })
  }

  /**
   * Remove a loaded sample
   */
  unloadSample(name: string): void {
    this.loadedSamples.delete(name)
  }

  /**
   * Get list of loaded sample names
   */
  getSampleNames(): string[] {
    return Array.from(this.loadedSamples.keys())
  }

  /**
   * Process audio according to pattern
   */
  process(
    audioData: AudioData,
    beatMap: BeatMap,
    options: Partial<BeatswapOptions> = {}
  ): Float32Array[] {
    const opts = { ...DEFAULT_OPTIONS, ...options }
    this.parser.setSlicesPerBeat(opts.slicesPerBeat)

    // Parse the pattern
    const totalBeats = beatMap.beats.length
    const segments = this.parser.parse(opts.pattern, totalBeats)

    // Extract beat and slice segments from audio
    const beatSegments = this.extractBeatSegments(audioData, beatMap)
    const sliceSegments = this.extractSliceSegments(audioData, beatMap, opts.slicesPerBeat)

    // Build output by assembling segments
    const outputChunks: Float32Array[][] = []

    for (const segment of segments) {
      for (let rep = 0; rep < segment.repeat; rep++) {
        let samples: Float32Array[] | null = null

        switch (segment.type) {
          case "beat":
            if (segment.beatIndex !== undefined && segment.beatIndex < beatSegments.length) {
              samples = beatSegments[segment.beatIndex].map((ch) => ch.slice())
            }
            break

          case "slice":
            if (segment.beatIndex !== undefined && segment.sliceIndex !== undefined) {
              const sliceKey = `${segment.beatIndex}_${segment.sliceIndex}`
              const slice = sliceSegments.get(sliceKey)
              if (slice) {
                samples = slice.map((ch) => ch.slice())
              }
            }
            break

          case "sample":
            if (segment.sampleName) {
              const sample = this.loadedSamples.get(segment.sampleName)
              if (sample) {
                // Resample if necessary
                if (sample.sampleRate !== audioData.sampleRate) {
                  samples = AudioEngine.resample(
                    sample.samples.map((ch) => ch.slice()),
                    sample.sampleRate,
                    audioData.sampleRate
                  )
                } else {
                  samples = sample.samples.map((ch) => ch.slice())
                }
              }
            }
            break

          case "silence":
            // Create silence matching average beat length
            const avgBeatLength = Math.round(
              beatSegments.reduce((sum, seg) => sum + seg[0].length, 0) / beatSegments.length
            )
            samples = audioData.samples.map(() => new Float32Array(avgBeatLength))
            break
        }

        if (samples) {
          // Apply effects
          samples = this.applyEffects(samples, audioData.sampleRate, segment.effects)
          outputChunks.push(samples)
        }
      }
    }

    // Concatenate all chunks with optional crossfade
    const output = this.concatenateChunks(outputChunks, audioData.sampleRate, opts.crossfadeMs)

    // Normalize if requested
    if (opts.normalizeOutput) {
      return AudioEngine.normalize(output)
    }

    return output
  }

  /**
   * Extract beat segments from audio
   */
  private extractBeatSegments(audioData: AudioData, beatMap: BeatMap): Float32Array[][] {
    const segments: Float32Array[][] = []
    const positions = beatMap.beatPositions

    for (let i = 0; i < positions.length; i++) {
      const start = positions[i]
      const end = i < positions.length - 1 ? positions[i + 1] : audioData.samples[0].length

      const segment = audioData.samples.map((channel) => channel.slice(start, end))
      segments.push(segment)
    }

    return segments
  }

  /**
   * Extract slice segments from audio
   */
  private extractSliceSegments(
    audioData: AudioData,
    beatMap: BeatMap,
    slicesPerBeat: number
  ): Map<string, Float32Array[]> {
    const segments = new Map<string, Float32Array[]>()
    const positions = beatMap.beatPositions

    for (let beatIdx = 0; beatIdx < positions.length; beatIdx++) {
      const beatStart = positions[beatIdx]
      const beatEnd = beatIdx < positions.length - 1 ? positions[beatIdx + 1] : audioData.samples[0].length
      const beatLength = beatEnd - beatStart

      for (let sliceIdx = 0; sliceIdx < slicesPerBeat; sliceIdx++) {
        const sliceStart = beatStart + Math.floor((sliceIdx * beatLength) / slicesPerBeat)
        const sliceEnd = beatStart + Math.floor(((sliceIdx + 1) * beatLength) / slicesPerBeat)

        const segment = audioData.samples.map((channel) => channel.slice(sliceStart, sliceEnd))
        segments.set(`${beatIdx}_${sliceIdx}`, segment)
      }
    }

    return segments
  }

  /**
   * Apply effects chain to samples
   */
  private applyEffects(
    samples: Float32Array[],
    sampleRate: number,
    effects: { name: string; args: number[] }[]
  ): Float32Array[] {
    let result = samples

    for (const effect of effects) {
      const effectFn = effectRegistry[effect.name]
      if (effectFn) {
        result = effectFn(result, sampleRate, ...effect.args)
      }
    }

    return result
  }

  /**
   * Concatenate audio chunks with crossfade
   */
  private concatenateChunks(
    chunks: Float32Array[][],
    sampleRate: number,
    crossfadeMs: number
  ): Float32Array[] {
    if (chunks.length === 0) {
      return [new Float32Array(0)]
    }

    if (chunks.length === 1) {
      return chunks[0]
    }

    const crossfadeSamples = Math.round((crossfadeMs / 1000) * sampleRate)
    const numChannels = chunks[0].length

    // Calculate total length
    let totalLength = 0
    for (const chunk of chunks) {
      totalLength += chunk[0].length
    }
    // Subtract crossfade overlaps
    totalLength -= crossfadeSamples * (chunks.length - 1)

    // Create output buffers
    const output: Float32Array[] = []
    for (let ch = 0; ch < numChannels; ch++) {
      output.push(new Float32Array(Math.max(0, totalLength)))
    }

    // Copy chunks with crossfade
    let writePos = 0

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const chunkLength = chunk[0].length

      for (let ch = 0; ch < numChannels; ch++) {
        const outputChannel = output[ch]
        const chunkChannel = chunk[ch] || chunk[0] // Fallback to mono

        for (let j = 0; j < chunkLength; j++) {
          const outIdx = writePos + j

          if (outIdx < 0 || outIdx >= outputChannel.length) continue

          let sample = chunkChannel[j]

          // Apply crossfade at boundaries
          if (i > 0 && j < crossfadeSamples) {
            // Fade in at start
            const fadeIn = j / crossfadeSamples
            sample *= fadeIn
          }

          if (i < chunks.length - 1 && j >= chunkLength - crossfadeSamples) {
            // Fade out at end
            const fadeOut = (chunkLength - j) / crossfadeSamples
            sample *= fadeOut
          }

          outputChannel[outIdx] += sample
        }
      }

      writePos += chunkLength - crossfadeSamples
    }

    return output
  }

  /**
   * Get beat segment audio for preview
   */
  getBeatPreview(audioData: AudioData, beatMap: BeatMap, beatIndex: number): Float32Array[] | null {
    const segments = this.extractBeatSegments(audioData, beatMap)
    if (beatIndex >= 0 && beatIndex < segments.length) {
      return segments[beatIndex]
    }
    return null
  }

  /**
   * Get slice segment audio for preview
   */
  getSlicePreview(
    audioData: AudioData,
    beatMap: BeatMap,
    beatIndex: number,
    sliceIndex: number,
    slicesPerBeat: number
  ): Float32Array[] | null {
    const segments = this.extractSliceSegments(audioData, beatMap, slicesPerBeat)
    const key = `${beatIndex}_${sliceIndex}`
    return segments.get(key) || null
  }

  /**
   * Estimate output duration based on pattern
   */
  estimateOutputDuration(
    audioData: AudioData,
    beatMap: BeatMap,
    options: Partial<BeatswapOptions>
  ): number {
    const opts = { ...DEFAULT_OPTIONS, ...options }
    this.parser.setSlicesPerBeat(opts.slicesPerBeat)

    const totalBeats = beatMap.beats.length
    const segments = this.parser.parse(opts.pattern, totalBeats)

    const avgBeatDuration = audioData.duration / totalBeats
    const avgSliceDuration = avgBeatDuration / opts.slicesPerBeat

    let totalDuration = 0

    for (const segment of segments) {
      let segmentDuration = 0

      switch (segment.type) {
        case "beat":
          segmentDuration = avgBeatDuration
          break
        case "slice":
          segmentDuration = avgSliceDuration
          break
        case "sample":
          const sample = this.loadedSamples.get(segment.sampleName || "")
          if (sample) {
            segmentDuration = sample.samples[0].length / sample.sampleRate
          }
          break
        case "silence":
          segmentDuration = avgBeatDuration
          break
      }

      // Apply speed effect if present
      for (const effect of segment.effects) {
        if (effect.name === "s" && effect.args[0]) {
          segmentDuration /= effect.args[0]
        }
      }

      totalDuration += segmentDuration * segment.repeat
    }

    return totalDuration
  }
}

export const beatswapEngine = new BeatswapEngine()
