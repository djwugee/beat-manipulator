/**
 * Core Audio Engine for Beat Manipulator
 * Handles audio loading, playback, and buffer management
 * All processing done client-side using Web Audio API
 */

export interface AudioData {
  buffer: AudioBuffer
  sampleRate: number
  duration: number
  numberOfChannels: number
  samples: Float32Array[]
}

export interface BeatInfo {
  time: number
  strength: number
  index: number
}

export class AudioEngine {
  private audioContext: AudioContext | null = null
  private currentSource: AudioBufferSourceNode | null = null
  private gainNode: GainNode | null = null
  private analyserNode: AnalyserNode | null = null
  private isPlaying = false
  private startTime = 0
  private pauseTime = 0

  getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext()
    }
    return this.audioContext
  }

  async loadAudioFile(file: File): Promise<AudioData> {
    const context = this.getContext()
    const arrayBuffer = await file.arrayBuffer()
    const audioBuffer = await context.decodeAudioData(arrayBuffer)

    const samples: Float32Array[] = []
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      samples.push(audioBuffer.getChannelData(channel))
    }

    return {
      buffer: audioBuffer,
      sampleRate: audioBuffer.sampleRate,
      duration: audioBuffer.duration,
      numberOfChannels: audioBuffer.numberOfChannels,
      samples,
    }
  }

  async loadAudioFromUrl(url: string): Promise<AudioData> {
    const context = this.getContext()
    const response = await fetch(url)
    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = await context.decodeAudioData(arrayBuffer)

    const samples: Float32Array[] = []
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      samples.push(audioBuffer.getChannelData(channel))
    }

    return {
      buffer: audioBuffer,
      sampleRate: audioBuffer.sampleRate,
      duration: audioBuffer.duration,
      numberOfChannels: audioBuffer.numberOfChannels,
      samples,
    }
  }

  createBufferFromSamples(samples: Float32Array[], sampleRate: number): AudioBuffer {
    const context = this.getContext()
    const length = samples[0].length
    const buffer = context.createBuffer(samples.length, length, sampleRate)

    for (let channel = 0; channel < samples.length; channel++) {
      buffer.copyToChannel(samples[channel], channel)
    }

    return buffer
  }

  play(buffer: AudioBuffer, offset = 0, volume = 1): void {
    this.stop()
    const context = this.getContext()

    this.currentSource = context.createBufferSource()
    this.gainNode = context.createGain()
    this.analyserNode = context.createAnalyser()

    this.currentSource.buffer = buffer
    this.gainNode.gain.value = volume

    this.currentSource.connect(this.gainNode)
    this.gainNode.connect(this.analyserNode)
    this.analyserNode.connect(context.destination)

    this.startTime = context.currentTime - offset
    this.currentSource.start(0, offset)
    this.isPlaying = true

    this.currentSource.onended = () => {
      this.isPlaying = false
    }
  }

  stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop()
      } catch {
        // Already stopped
      }
      this.currentSource.disconnect()
      this.currentSource = null
    }
    this.isPlaying = false
    this.pauseTime = 0
  }

  pause(): number {
    if (this.isPlaying && this.audioContext) {
      this.pauseTime = this.audioContext.currentTime - this.startTime
      this.stop()
      return this.pauseTime
    }
    return this.pauseTime
  }

  getCurrentTime(): number {
    if (this.isPlaying && this.audioContext) {
      return this.audioContext.currentTime - this.startTime
    }
    return this.pauseTime
  }

  getIsPlaying(): boolean {
    return this.isPlaying
  }

  getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode
  }

  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(2, volume))
    }
  }

  /**
   * Convert stereo to mono by averaging channels
   */
  static toMono(samples: Float32Array[]): Float32Array {
    if (samples.length === 1) {
      return samples[0]
    }

    const length = samples[0].length
    const mono = new Float32Array(length)

    for (let i = 0; i < length; i++) {
      let sum = 0
      for (let ch = 0; ch < samples.length; ch++) {
        sum += samples[ch][i]
      }
      mono[i] = sum / samples.length
    }

    return mono
  }

  /**
   * Normalize audio to peak amplitude
   */
  static normalize(samples: Float32Array[], targetPeak = 0.95): Float32Array[] {
    let maxAmp = 0
    for (const channel of samples) {
      for (let i = 0; i < channel.length; i++) {
        const abs = Math.abs(channel[i])
        if (abs > maxAmp) maxAmp = abs
      }
    }

    if (maxAmp === 0) return samples

    const scale = targetPeak / maxAmp
    return samples.map((channel) => {
      const normalized = new Float32Array(channel.length)
      for (let i = 0; i < channel.length; i++) {
        normalized[i] = channel[i] * scale
      }
      return normalized
    })
  }

  /**
   * Resample audio to target sample rate using linear interpolation
   */
  static resample(samples: Float32Array[], fromRate: number, toRate: number): Float32Array[] {
    if (fromRate === toRate) return samples

    const ratio = fromRate / toRate
    const newLength = Math.round(samples[0].length / ratio)

    return samples.map((channel) => {
      const resampled = new Float32Array(newLength)
      for (let i = 0; i < newLength; i++) {
        const srcIndex = i * ratio
        const srcIndexFloor = Math.floor(srcIndex)
        const srcIndexCeil = Math.min(srcIndexFloor + 1, channel.length - 1)
        const t = srcIndex - srcIndexFloor
        resampled[i] = channel[srcIndexFloor] * (1 - t) + channel[srcIndexCeil] * t
      }
      return resampled
    })
  }
}

export const audioEngine = new AudioEngine()
