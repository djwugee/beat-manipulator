/**
 * Audio Export Utilities
 * Handles WAV encoding and file download for processed audio
 */

export interface ExportOptions {
  sampleRate: number
  bitDepth: 16 | 24 | 32
  normalize: boolean
  filename: string
}

const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  sampleRate: 44100,
  bitDepth: 16,
  normalize: true,
  filename: "beatswap_output",
}

/**
 * Encode audio samples to WAV format
 */
export function encodeWAV(
  samples: Float32Array[],
  sampleRate: number,
  bitDepth: 16 | 24 | 32 = 16
): ArrayBuffer {
  const numChannels = samples.length
  const numSamples = samples[0].length
  const bytesPerSample = bitDepth / 8
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = numSamples * blockAlign
  const bufferSize = 44 + dataSize

  const buffer = new ArrayBuffer(bufferSize)
  const view = new DataView(buffer)

  // RIFF header
  writeString(view, 0, "RIFF")
  view.setUint32(4, bufferSize - 8, true)
  writeString(view, 8, "WAVE")

  // fmt chunk
  writeString(view, 12, "fmt ")
  view.setUint32(16, 16, true) // Subchunk1Size (16 for PCM)
  view.setUint16(20, bitDepth === 32 ? 3 : 1, true) // AudioFormat (1 = PCM, 3 = IEEE float)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitDepth, true)

  // data chunk
  writeString(view, 36, "data")
  view.setUint32(40, dataSize, true)

  // Write interleaved samples
  let offset = 44

  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, samples[ch][i]))

      switch (bitDepth) {
        case 16: {
          const int16 = Math.round(sample * 32767)
          view.setInt16(offset, int16, true)
          offset += 2
          break
        }
        case 24: {
          const int24 = Math.round(sample * 8388607)
          view.setUint8(offset, int24 & 0xff)
          view.setUint8(offset + 1, (int24 >> 8) & 0xff)
          view.setUint8(offset + 2, (int24 >> 16) & 0xff)
          offset += 3
          break
        }
        case 32: {
          view.setFloat32(offset, sample, true)
          offset += 4
          break
        }
      }
    }
  }

  return buffer
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}

/**
 * Create a downloadable blob URL from audio samples
 */
export function createAudioBlob(
  samples: Float32Array[],
  sampleRate: number,
  bitDepth: 16 | 24 | 32 = 16
): Blob {
  const wavBuffer = encodeWAV(samples, sampleRate, bitDepth)
  return new Blob([wavBuffer], { type: "audio/wav" })
}

/**
 * Download audio as WAV file
 */
export function downloadAudio(
  samples: Float32Array[],
  options: Partial<ExportOptions> = {}
): void {
  const opts = { ...DEFAULT_EXPORT_OPTIONS, ...options }

  const blob = createAudioBlob(samples, opts.sampleRate, opts.bitDepth)
  const url = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.href = url
  link.download = `${opts.filename}.wav`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Clean up blob URL after a short delay
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Create an audio URL for playback
 */
export function createPlaybackUrl(samples: Float32Array[], sampleRate: number): string {
  const blob = createAudioBlob(samples, sampleRate, 16)
  return URL.createObjectURL(blob)
}

/**
 * Calculate audio statistics
 */
export function calculateAudioStats(samples: Float32Array[]): {
  peakAmplitude: number
  rmsLevel: number
  dcOffset: number
  dynamicRange: number
} {
  let peak = 0
  let sumSquares = 0
  let sum = 0
  let min = 1
  let max = -1
  let count = 0

  for (const channel of samples) {
    for (let i = 0; i < channel.length; i++) {
      const sample = channel[i]
      const abs = Math.abs(sample)
      if (abs > peak) peak = abs
      sumSquares += sample * sample
      sum += sample
      if (sample < min) min = sample
      if (sample > max) max = sample
      count++
    }
  }

  const rms = Math.sqrt(sumSquares / count)
  const dcOffset = sum / count
  const dynamicRange = peak > 0 ? 20 * Math.log10(peak / (rms || 0.0001)) : 0

  return {
    peakAmplitude: peak,
    rmsLevel: rms,
    dcOffset,
    dynamicRange,
  }
}

/**
 * Format duration as MM:SS.ms
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Estimate WAV file size
 */
export function estimateFileSize(
  durationSeconds: number,
  sampleRate: number,
  numChannels: number,
  bitDepth: number
): number {
  const bytesPerSample = bitDepth / 8
  const dataSize = Math.ceil(durationSeconds * sampleRate * numChannels * bytesPerSample)
  return dataSize + 44 // Add WAV header size
}
