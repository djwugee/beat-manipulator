/**
 * Advanced Beat Detection Engine
 * Uses spectral flux onset detection with adaptive thresholding
 * Implements dynamic beat tracking similar to madmom/librosa
 */

import { AudioEngine, type AudioData, type BeatInfo } from "./audio-engine"

export interface BeatDetectionOptions {
  // Onset detection parameters
  hopSize: number // Samples between analysis frames
  frameSize: number // FFT frame size
  onsetThreshold: number // Onset detection sensitivity (0-1)

  // Beat tracking parameters
  minBPM: number
  maxBPM: number
  tempoWeight: number // Weight for tempo continuity

  // Post-processing
  smoothing: number // Beat position smoothing
  minBeatInterval: number // Minimum time between beats in seconds
}

export interface BeatMap {
  beats: BeatInfo[]
  tempo: number
  beatPositions: number[] // Sample positions
  confidence: number
}

const DEFAULT_OPTIONS: BeatDetectionOptions = {
  hopSize: 512,
  frameSize: 2048,
  onsetThreshold: 0.1,
  minBPM: 60,
  maxBPM: 200,
  tempoWeight: 1.0,
  smoothing: 0.1,
  minBeatInterval: 0.2,
}

export class BeatDetector {
  private options: BeatDetectionOptions

  constructor(options: Partial<BeatDetectionOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Detect beats in audio data using spectral flux onset detection
   * and dynamic programming beat tracking
   */
  async detectBeats(audioData: AudioData): Promise<BeatMap> {
    const mono = AudioEngine.toMono(audioData.samples)
    const sampleRate = audioData.sampleRate

    // Step 1: Compute spectral flux onset strength envelope
    const onsetEnvelope = this.computeOnsetEnvelope(mono, sampleRate)

    // Step 2: Detect onset peaks
    const onsetPeaks = this.detectOnsetPeaks(onsetEnvelope, sampleRate)

    // Step 3: Estimate tempo using autocorrelation
    const tempo = this.estimateTempo(onsetEnvelope, sampleRate)

    // Step 4: Track beats using dynamic programming
    const beatFrames = this.trackBeats(onsetEnvelope, tempo, sampleRate)

    // Step 5: Convert to sample positions and build beat info
    const hopTime = this.options.hopSize / sampleRate
    const beats: BeatInfo[] = beatFrames.map((frame, index) => ({
      time: frame * hopTime,
      strength: onsetEnvelope[frame] || 0,
      index,
    }))

    const beatPositions = beats.map((b) => Math.round(b.time * sampleRate))

    // Calculate confidence based on onset strength variance at beat positions
    const avgStrength = beats.reduce((sum, b) => sum + b.strength, 0) / beats.length
    const confidence = Math.min(1, avgStrength * 2)

    return {
      beats,
      tempo,
      beatPositions,
      confidence,
    }
  }

  /**
   * Compute spectral flux onset strength envelope
   */
  private computeOnsetEnvelope(samples: Float32Array, sampleRate: number): Float32Array {
    const { hopSize, frameSize } = this.options
    const numFrames = Math.floor((samples.length - frameSize) / hopSize) + 1
    const envelope = new Float32Array(numFrames)

    // Mel filterbank parameters
    const numMelBands = 80
    const fMin = 30
    const fMax = Math.min(sampleRate / 2, 11000)
    const melFilterbank = this.createMelFilterbank(frameSize, sampleRate, numMelBands, fMin, fMax)

    // Window function (Hann window)
    const window = this.createHannWindow(frameSize)

    // Previous mel spectrum for flux calculation
    let prevMelSpectrum = new Float32Array(numMelBands)

    for (let frame = 0; frame < numFrames; frame++) {
      const start = frame * hopSize
      const frameData = new Float32Array(frameSize)

      // Extract and window the frame
      for (let i = 0; i < frameSize; i++) {
        frameData[i] = (samples[start + i] || 0) * window[i]
      }

      // Compute FFT magnitude spectrum
      const spectrum = this.computeFFTMagnitude(frameData)

      // Apply mel filterbank
      const melSpectrum = this.applyMelFilterbank(spectrum, melFilterbank)

      // Compute spectral flux (half-wave rectified difference)
      let flux = 0
      for (let i = 0; i < numMelBands; i++) {
        const diff = melSpectrum[i] - prevMelSpectrum[i]
        if (diff > 0) {
          flux += diff * diff
        }
      }

      envelope[frame] = Math.sqrt(flux)
      prevMelSpectrum = melSpectrum
    }

    // Normalize envelope
    const maxVal = Math.max(...envelope)
    if (maxVal > 0) {
      for (let i = 0; i < envelope.length; i++) {
        envelope[i] /= maxVal
      }
    }

    // Apply adaptive mean subtraction for better onset detection
    return this.adaptiveMeanSubtraction(envelope, Math.round(sampleRate / hopSize / 4))
  }

  /**
   * Create Hann window for spectral analysis
   */
  private createHannWindow(size: number): Float32Array {
    const window = new Float32Array(size)
    for (let i = 0; i < size; i++) {
      window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)))
    }
    return window
  }

  /**
   * Compute FFT magnitude spectrum using DFT
   * For production, this could be optimized with WebAssembly FFT
   */
  private computeFFTMagnitude(frame: Float32Array): Float32Array {
    const n = frame.length
    const spectrum = new Float32Array(n / 2 + 1)

    // Use radix-2 FFT for power-of-2 sizes
    const real = new Float32Array(n)
    const imag = new Float32Array(n)
    real.set(frame)

    this.fft(real, imag)

    for (let i = 0; i <= n / 2; i++) {
      spectrum[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i])
    }

    return spectrum
  }

  /**
   * In-place Cooley-Tukey FFT
   */
  private fft(real: Float32Array, imag: Float32Array): void {
    const n = real.length
    const levels = Math.log2(n)

    // Bit reversal permutation
    for (let i = 0; i < n; i++) {
      const j = this.reverseBits(i, levels)
      if (j > i) {
        ;[real[i], real[j]] = [real[j], real[i]]
        ;[imag[i], imag[j]] = [imag[j], imag[i]]
      }
    }

    // Cooley-Tukey iterative FFT
    for (let size = 2; size <= n; size *= 2) {
      const halfSize = size / 2
      const tableStep = n / size

      for (let i = 0; i < n; i += size) {
        for (let j = i, k = 0; j < i + halfSize; j++, k += tableStep) {
          const angle = (-2 * Math.PI * k) / n
          const cos = Math.cos(angle)
          const sin = Math.sin(angle)

          const tpre = real[j + halfSize] * cos - imag[j + halfSize] * sin
          const tpim = real[j + halfSize] * sin + imag[j + halfSize] * cos

          real[j + halfSize] = real[j] - tpre
          imag[j + halfSize] = imag[j] - tpim
          real[j] += tpre
          imag[j] += tpim
        }
      }
    }
  }

  private reverseBits(x: number, bits: number): number {
    let result = 0
    for (let i = 0; i < bits; i++) {
      result = (result << 1) | (x & 1)
      x >>= 1
    }
    return result
  }

  /**
   * Create mel filterbank matrix
   */
  private createMelFilterbank(
    fftSize: number,
    sampleRate: number,
    numBands: number,
    fMin: number,
    fMax: number
  ): Float32Array[] {
    const numBins = fftSize / 2 + 1

    // Convert to mel scale
    const melMin = this.hzToMel(fMin)
    const melMax = this.hzToMel(fMax)

    // Create mel points
    const melPoints = new Float32Array(numBands + 2)
    for (let i = 0; i < numBands + 2; i++) {
      melPoints[i] = melMin + (i * (melMax - melMin)) / (numBands + 1)
    }

    // Convert back to Hz and then to FFT bin indices
    const binPoints = new Float32Array(numBands + 2)
    for (let i = 0; i < numBands + 2; i++) {
      const hz = this.melToHz(melPoints[i])
      binPoints[i] = Math.floor(((fftSize + 1) * hz) / sampleRate)
    }

    // Create filterbank
    const filterbank: Float32Array[] = []
    for (let i = 0; i < numBands; i++) {
      const filter = new Float32Array(numBins)
      const startBin = Math.floor(binPoints[i])
      const centerBin = Math.floor(binPoints[i + 1])
      const endBin = Math.floor(binPoints[i + 2])

      // Rising edge
      for (let j = startBin; j < centerBin; j++) {
        if (j >= 0 && j < numBins) {
          filter[j] = (j - startBin) / (centerBin - startBin)
        }
      }

      // Falling edge
      for (let j = centerBin; j < endBin; j++) {
        if (j >= 0 && j < numBins) {
          filter[j] = (endBin - j) / (endBin - centerBin)
        }
      }

      filterbank.push(filter)
    }

    return filterbank
  }

  private hzToMel(hz: number): number {
    return 2595 * Math.log10(1 + hz / 700)
  }

  private melToHz(mel: number): number {
    return 700 * (Math.pow(10, mel / 2595) - 1)
  }

  /**
   * Apply mel filterbank to spectrum
   */
  private applyMelFilterbank(spectrum: Float32Array, filterbank: Float32Array[]): Float32Array {
    const melSpectrum = new Float32Array(filterbank.length)

    for (let i = 0; i < filterbank.length; i++) {
      let sum = 0
      for (let j = 0; j < spectrum.length && j < filterbank[i].length; j++) {
        sum += spectrum[j] * filterbank[i][j]
      }
      // Apply log compression
      melSpectrum[i] = Math.log(1 + sum * 10000)
    }

    return melSpectrum
  }

  /**
   * Adaptive mean subtraction for onset detection
   */
  private adaptiveMeanSubtraction(envelope: Float32Array, windowSize: number): Float32Array {
    const result = new Float32Array(envelope.length)
    const halfWindow = Math.floor(windowSize / 2)

    for (let i = 0; i < envelope.length; i++) {
      let sum = 0
      let count = 0

      for (let j = Math.max(0, i - halfWindow); j <= Math.min(envelope.length - 1, i + halfWindow); j++) {
        sum += envelope[j]
        count++
      }

      const mean = sum / count
      result[i] = Math.max(0, envelope[i] - mean)
    }

    return result
  }

  /**
   * Detect peaks in onset envelope
   */
  private detectOnsetPeaks(envelope: Float32Array, sampleRate: number): number[] {
    const { hopSize, onsetThreshold, minBeatInterval } = this.options
    const minFrameInterval = Math.round((minBeatInterval * sampleRate) / hopSize)
    const peaks: number[] = []

    for (let i = 1; i < envelope.length - 1; i++) {
      // Local maximum check
      if (
        envelope[i] > envelope[i - 1] &&
        envelope[i] >= envelope[i + 1] &&
        envelope[i] > onsetThreshold
      ) {
        // Check minimum interval from last peak
        if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minFrameInterval) {
          peaks.push(i)
        } else if (envelope[i] > envelope[peaks[peaks.length - 1]]) {
          // Replace last peak if this one is stronger
          peaks[peaks.length - 1] = i
        }
      }
    }

    return peaks
  }

  /**
   * Estimate tempo using autocorrelation of onset envelope
   */
  private estimateTempo(envelope: Float32Array, sampleRate: number): number {
    const { hopSize, minBPM, maxBPM } = this.options

    // Convert BPM range to lag range in frames
    const framesPerSecond = sampleRate / hopSize
    const minLag = Math.floor((60 * framesPerSecond) / maxBPM)
    const maxLag = Math.ceil((60 * framesPerSecond) / minBPM)

    // Compute autocorrelation
    const autocorr = new Float32Array(maxLag + 1)

    for (let lag = minLag; lag <= maxLag; lag++) {
      let sum = 0
      let count = 0

      for (let i = 0; i < envelope.length - lag; i++) {
        sum += envelope[i] * envelope[i + lag]
        count++
      }

      autocorr[lag] = sum / count
    }

    // Find the best tempo using weighted peak detection
    // Weight towards common tempos (120 BPM area)
    let bestLag = minLag
    let bestScore = 0

    for (let lag = minLag; lag <= maxLag; lag++) {
      const bpm = (60 * framesPerSecond) / lag

      // Tempo prior: prefer tempos near 120 BPM
      const tempoPrior = Math.exp(-Math.pow((bpm - 120) / 50, 2))

      // Also check half and double tempo for consistency
      const halfLag = lag * 2
      const doubleLag = Math.floor(lag / 2)

      let harmonicBonus = 0
      if (halfLag <= maxLag) {
        harmonicBonus += autocorr[halfLag] * 0.5
      }
      if (doubleLag >= minLag) {
        harmonicBonus += autocorr[doubleLag] * 0.5
      }

      const score = autocorr[lag] * (1 + this.options.tempoWeight * tempoPrior) + harmonicBonus * 0.3

      if (score > bestScore) {
        bestScore = score
        bestLag = lag
      }
    }

    const tempo = (60 * framesPerSecond) / bestLag

    // Round to reasonable BPM
    return Math.round(tempo * 10) / 10
  }

  /**
   * Track beats using dynamic programming
   */
  private trackBeats(envelope: Float32Array, tempo: number, sampleRate: number): number[] {
    const { hopSize } = this.options
    const framesPerSecond = sampleRate / hopSize
    const beatPeriod = (60 * framesPerSecond) / tempo

    // Dynamic programming beat tracking
    const numFrames = envelope.length
    const score = new Float32Array(numFrames)
    const predecessor = new Int32Array(numFrames)

    // Transition model: allow beats within ±20% of expected period
    const minPeriod = Math.floor(beatPeriod * 0.8)
    const maxPeriod = Math.ceil(beatPeriod * 1.2)

    // Initialize scores with onset strength
    for (let i = 0; i < numFrames; i++) {
      score[i] = envelope[i]
      predecessor[i] = -1
    }

    // Forward pass
    for (let i = maxPeriod; i < numFrames; i++) {
      let bestPrevScore = 0
      let bestPrev = -1

      for (let period = minPeriod; period <= maxPeriod; period++) {
        const prevIdx = i - period
        if (prevIdx >= 0) {
          // Transition cost based on deviation from expected period
          const deviation = Math.abs(period - beatPeriod) / beatPeriod
          const transitionScore = score[prevIdx] * (1 - deviation * 0.5)

          if (transitionScore > bestPrevScore) {
            bestPrevScore = transitionScore
            bestPrev = prevIdx
          }
        }
      }

      if (bestPrev >= 0) {
        score[i] = envelope[i] + bestPrevScore * 0.9
        predecessor[i] = bestPrev
      }
    }

    // Backtrack from the frame with highest score in the last section
    const lastSection = Math.floor(numFrames * 0.9)
    let bestEnd = lastSection
    for (let i = lastSection; i < numFrames; i++) {
      if (score[i] > score[bestEnd]) {
        bestEnd = i
      }
    }

    // Collect beat frames by backtracking
    const beatFrames: number[] = []
    let current = bestEnd

    while (current >= 0) {
      beatFrames.unshift(current)
      current = predecessor[current]
    }

    // Remove beats that are too close together
    const filteredBeats: number[] = []
    for (let i = 0; i < beatFrames.length; i++) {
      if (
        filteredBeats.length === 0 ||
        beatFrames[i] - filteredBeats[filteredBeats.length - 1] >= minPeriod * 0.9
      ) {
        filteredBeats.push(beatFrames[i])
      }
    }

    return filteredBeats
  }

  /**
   * Create beat segments from beat positions
   */
  getBeatSegments(
    audioData: AudioData,
    beatMap: BeatMap
  ): { start: number; end: number; samples: Float32Array[] }[] {
    const segments: { start: number; end: number; samples: Float32Array[] }[] = []
    const positions = beatMap.beatPositions

    for (let i = 0; i < positions.length; i++) {
      const start = positions[i]
      const end = i < positions.length - 1 ? positions[i + 1] : audioData.samples[0].length

      const segmentSamples: Float32Array[] = audioData.samples.map((channel) => {
        return channel.slice(start, end)
      })

      segments.push({ start, end, samples: segmentSamples })
    }

    return segments
  }

  /**
   * Create sub-beat segments (slices within beats)
   */
  getSliceSegments(
    audioData: AudioData,
    beatMap: BeatMap,
    slicesPerBeat: number
  ): { beatIndex: number; sliceIndex: number; start: number; end: number; samples: Float32Array[] }[] {
    const segments: {
      beatIndex: number
      sliceIndex: number
      start: number
      end: number
      samples: Float32Array[]
    }[] = []
    const positions = beatMap.beatPositions

    for (let beatIdx = 0; beatIdx < positions.length; beatIdx++) {
      const beatStart = positions[beatIdx]
      const beatEnd = beatIdx < positions.length - 1 ? positions[beatIdx + 1] : audioData.samples[0].length
      const beatLength = beatEnd - beatStart

      for (let sliceIdx = 0; sliceIdx < slicesPerBeat; sliceIdx++) {
        const sliceStart = beatStart + Math.floor((sliceIdx * beatLength) / slicesPerBeat)
        const sliceEnd = beatStart + Math.floor(((sliceIdx + 1) * beatLength) / slicesPerBeat)

        const sliceSamples: Float32Array[] = audioData.samples.map((channel) => {
          return channel.slice(sliceStart, sliceEnd)
        })

        segments.push({
          beatIndex: beatIdx,
          sliceIndex: sliceIdx,
          start: sliceStart,
          end: sliceEnd,
          samples: sliceSamples,
        })
      }
    }

    return segments
  }
}

export const beatDetector = new BeatDetector()
