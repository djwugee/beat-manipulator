/**
 * Audio Effects Engine
 * Full port of Python beat_manipulator effects to TypeScript
 * All processing done client-side using typed arrays
 */

export type EffectFunction = (
  samples: Float32Array[],
  sampleRate: number,
  ...args: number[]
) => Float32Array[]

/**
 * Reverse audio samples
 */
export function reverse(samples: Float32Array[]): Float32Array[] {
  return samples.map((channel) => {
    const reversed = new Float32Array(channel.length)
    for (let i = 0; i < channel.length; i++) {
      reversed[i] = channel[channel.length - 1 - i]
    }
    return reversed
  })
}

/**
 * Change volume (amplitude scaling)
 */
export function volume(samples: Float32Array[], gain: number): Float32Array[] {
  return samples.map((channel) => {
    const scaled = new Float32Array(channel.length)
    for (let i = 0; i < channel.length; i++) {
      scaled[i] = channel[i] * gain
    }
    return scaled
  })
}

/**
 * Speed change using linear interpolation resampling
 * speed > 1 = faster, speed < 1 = slower
 */
export function speed(samples: Float32Array[], speedFactor: number): Float32Array[] {
  if (speedFactor <= 0) speedFactor = 1
  const newLength = Math.round(samples[0].length / speedFactor)

  return samples.map((channel) => {
    const resampled = new Float32Array(newLength)
    for (let i = 0; i < newLength; i++) {
      const srcIndex = i * speedFactor
      const srcFloor = Math.floor(srcIndex)
      const srcCeil = Math.min(srcFloor + 1, channel.length - 1)
      const t = srcIndex - srcFloor
      resampled[i] = channel[srcFloor] * (1 - t) + channel[srcCeil] * t
    }
    return resampled
  })
}

/**
 * Pitch shift using speed change with length preservation
 * Uses overlap-add with Hann windows for better quality
 */
export function pitchShift(
  samples: Float32Array[],
  sampleRate: number,
  semitones: number
): Float32Array[] {
  const pitchFactor = Math.pow(2, semitones / 12)
  const stretchedLength = samples[0].length

  // Phase vocoder-style pitch shifting
  const frameSize = 2048
  const hopSize = frameSize / 4
  const window = createHannWindow(frameSize)

  return samples.map((channel) => {
    // First speed up/slow down
    const speedChanged = speedChannel(channel, pitchFactor)

    // Then time-stretch back to original length using overlap-add
    return timeStretch(speedChanged, stretchedLength, frameSize, hopSize, window)
  })
}

function speedChannel(channel: Float32Array, speedFactor: number): Float32Array {
  const newLength = Math.round(channel.length / speedFactor)
  const resampled = new Float32Array(newLength)

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * speedFactor
    const srcFloor = Math.floor(srcIndex)
    const srcCeil = Math.min(srcFloor + 1, channel.length - 1)
    const t = srcIndex - srcFloor
    resampled[i] = channel[srcFloor] * (1 - t) + channel[srcCeil] * t
  }

  return resampled
}

function timeStretch(
  channel: Float32Array,
  targetLength: number,
  frameSize: number,
  hopSize: number,
  window: Float32Array
): Float32Array {
  const output = new Float32Array(targetLength)
  const ratio = channel.length / targetLength

  const numOutputFrames = Math.floor((targetLength - frameSize) / hopSize) + 1

  for (let i = 0; i < numOutputFrames; i++) {
    const outputPos = i * hopSize
    const inputPos = Math.floor(outputPos * ratio)

    for (let j = 0; j < frameSize; j++) {
      const inputIdx = inputPos + j
      const outputIdx = outputPos + j

      if (inputIdx < channel.length && outputIdx < targetLength) {
        output[outputIdx] += channel[inputIdx] * window[j]
      }
    }
  }

  // Normalize by window overlap
  const windowSum = new Float32Array(targetLength)
  for (let i = 0; i < numOutputFrames; i++) {
    const pos = i * hopSize
    for (let j = 0; j < frameSize; j++) {
      if (pos + j < targetLength) {
        windowSum[pos + j] += window[j] * window[j]
      }
    }
  }

  for (let i = 0; i < targetLength; i++) {
    if (windowSum[i] > 0.001) {
      output[i] /= windowSum[i]
    }
  }

  return output
}

function createHannWindow(size: number): Float32Array {
  const window = new Float32Array(size)
  for (let i = 0; i < size; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)))
  }
  return window
}

/**
 * Downsample (reduce quality)
 * factor = number of samples to merge
 */
export function downsample(samples: Float32Array[], factor: number): Float32Array[] {
  factor = Math.max(1, Math.round(factor))
  if (factor === 1) return samples

  return samples.map((channel) => {
    const newLength = Math.ceil(channel.length / factor)
    const downsampled = new Float32Array(channel.length)

    for (let i = 0; i < newLength; i++) {
      const start = i * factor
      let sum = 0
      let count = 0

      for (let j = start; j < Math.min(start + factor, channel.length); j++) {
        sum += channel[j]
        count++
      }

      const avgValue = sum / count

      // Repeat the averaged value for the original length portion
      for (let j = start; j < Math.min(start + factor, channel.length); j++) {
        downsampled[j] = avgValue
      }
    }

    return downsampled
  })
}

/**
 * Bitcrush effect - reduce bit depth
 */
export function bitcrush(samples: Float32Array[], bits: number): Float32Array[] {
  bits = Math.max(1, Math.min(16, Math.round(bits)))
  const levels = Math.pow(2, bits)

  return samples.map((channel) => {
    const crushed = new Float32Array(channel.length)
    for (let i = 0; i < channel.length; i++) {
      // Quantize to specified bit depth
      const normalized = (channel[i] + 1) / 2 // 0 to 1
      const quantized = Math.round(normalized * (levels - 1)) / (levels - 1)
      crushed[i] = quantized * 2 - 1 // Back to -1 to 1
    }
    return crushed
  })
}

/**
 * Gradient volume effect
 * Fade from startVol to endVol across the sample
 */
export function gradient(samples: Float32Array[], startVol: number, endVol: number): Float32Array[] {
  return samples.map((channel) => {
    const faded = new Float32Array(channel.length)
    for (let i = 0; i < channel.length; i++) {
      const t = i / (channel.length - 1)
      const vol = startVol + (endVol - startVol) * t
      faded[i] = channel[i] * vol
    }
    return faded
  })
}

/**
 * Fade in effect
 */
export function fadeIn(samples: Float32Array[], duration?: number): Float32Array[] {
  return samples.map((channel) => {
    const fadeLength = duration ? Math.min(duration, channel.length) : channel.length
    const faded = new Float32Array(channel.length)

    for (let i = 0; i < channel.length; i++) {
      if (i < fadeLength) {
        faded[i] = channel[i] * (i / fadeLength)
      } else {
        faded[i] = channel[i]
      }
    }

    return faded
  })
}

/**
 * Fade out effect
 */
export function fadeOut(samples: Float32Array[], duration?: number): Float32Array[] {
  return samples.map((channel) => {
    const fadeLength = duration ? Math.min(duration, channel.length) : channel.length
    const faded = new Float32Array(channel.length)
    const fadeStart = channel.length - fadeLength

    for (let i = 0; i < channel.length; i++) {
      if (i >= fadeStart) {
        faded[i] = channel[i] * ((channel.length - 1 - i) / fadeLength)
      } else {
        faded[i] = channel[i]
      }
    }

    return faded
  })
}

/**
 * Channel manipulation
 * mode: 0 = left only, 1 = right only, 2 = swap, 3 = mono
 */
export function channel(samples: Float32Array[], mode: number): Float32Array[] {
  if (samples.length < 2) return samples

  switch (mode) {
    case 0: // Left only
      return [samples[0], samples[0].slice()]
    case 1: // Right only
      return [samples[1].slice(), samples[1]]
    case 2: // Swap
      return [samples[1].slice(), samples[0].slice()]
    case 3: // Mono
      const mono = new Float32Array(samples[0].length)
      for (let i = 0; i < mono.length; i++) {
        mono[i] = (samples[0][i] + samples[1][i]) / 2
      }
      return [mono, mono.slice()]
    default:
      return samples
  }
}

/**
 * Delay/echo effect
 */
export function delay(
  samples: Float32Array[],
  sampleRate: number,
  delayTime: number,
  feedback: number,
  wet: number
): Float32Array[] {
  const delaySamples = Math.round(delayTime * sampleRate)
  feedback = Math.max(0, Math.min(0.99, feedback))
  wet = Math.max(0, Math.min(1, wet))
  const dry = 1 - wet

  return samples.map((channel) => {
    const output = new Float32Array(channel.length)
    const delayBuffer = new Float32Array(delaySamples)
    let writePos = 0

    for (let i = 0; i < channel.length; i++) {
      const delayedSample = delayBuffer[writePos]
      const inputWithFeedback = channel[i] + delayedSample * feedback

      output[i] = channel[i] * dry + delayedSample * wet
      delayBuffer[writePos] = inputWithFeedback

      writePos = (writePos + 1) % delaySamples
    }

    return output
  })
}

/**
 * Reverb effect using simple convolution with generated impulse response
 */
export function reverb(
  samples: Float32Array[],
  sampleRate: number,
  roomSize: number,
  damping: number,
  wet: number
): Float32Array[] {
  roomSize = Math.max(0.1, Math.min(1, roomSize))
  damping = Math.max(0, Math.min(1, damping))
  wet = Math.max(0, Math.min(1, wet))
  const dry = 1 - wet

  // Generate a simple exponential decay impulse response
  const irLength = Math.round(sampleRate * roomSize * 2)
  const impulseResponse = new Float32Array(irLength)

  for (let i = 0; i < irLength; i++) {
    const decay = Math.exp((-i * 3) / irLength) * (1 - damping * 0.8)
    impulseResponse[i] = (Math.random() * 2 - 1) * decay
  }

  return samples.map((channel) => {
    // Simple convolution with early reflections
    const output = new Float32Array(channel.length)

    // Allpass filters for diffusion
    const allpassDelays = [347, 113, 37, 59].map((d) => Math.round((d * sampleRate) / 44100))
    const allpassBuffers = allpassDelays.map((d) => new Float32Array(d))
    const allpassPositions = [0, 0, 0, 0]

    for (let i = 0; i < channel.length; i++) {
      let wet_signal = 0

      // Early reflections
      const earlyReflections = [0.1, 0.2, 0.3, 0.4, 0.5].map((t) =>
        Math.round(t * roomSize * sampleRate * 0.1)
      )

      for (const reflectionDelay of earlyReflections) {
        if (i >= reflectionDelay) {
          wet_signal += channel[i - reflectionDelay] * 0.15 * Math.exp(-reflectionDelay / (sampleRate * roomSize))
        }
      }

      // Pass through allpass filters
      let diffused = channel[i]
      for (let ap = 0; ap < allpassDelays.length; ap++) {
        const bufferPos = allpassPositions[ap]
        const delayed = allpassBuffers[ap][bufferPos]
        const g = 0.6
        const newVal = diffused + g * delayed
        allpassBuffers[ap][bufferPos] = newVal
        diffused = delayed - g * newVal
        allpassPositions[ap] = (bufferPos + 1) % allpassDelays[ap]
      }

      wet_signal += diffused * 0.3

      output[i] = channel[i] * dry + wet_signal * wet
    }

    return output
  })
}

/**
 * Distortion effect
 */
export function distortion(samples: Float32Array[], amount: number): Float32Array[] {
  amount = Math.max(0, Math.min(100, amount))
  const gain = 1 + amount * 0.5
  const threshold = 1 / gain

  return samples.map((channel) => {
    const distorted = new Float32Array(channel.length)
    for (let i = 0; i < channel.length; i++) {
      let sample = channel[i] * gain

      // Soft clipping using tanh
      sample = Math.tanh(sample * (1 + amount * 0.1))

      // Hard clipping
      sample = Math.max(-1, Math.min(1, sample))

      distorted[i] = sample
    }
    return distorted
  })
}

/**
 * Low-pass filter using simple moving average
 */
export function lowpass(samples: Float32Array[], sampleRate: number, cutoff: number): Float32Array[] {
  const rc = 1 / (2 * Math.PI * cutoff)
  const dt = 1 / sampleRate
  const alpha = dt / (rc + dt)

  return samples.map((channel) => {
    const filtered = new Float32Array(channel.length)
    filtered[0] = channel[0]

    for (let i = 1; i < channel.length; i++) {
      filtered[i] = filtered[i - 1] + alpha * (channel[i] - filtered[i - 1])
    }

    return filtered
  })
}

/**
 * High-pass filter
 */
export function highpass(samples: Float32Array[], sampleRate: number, cutoff: number): Float32Array[] {
  const rc = 1 / (2 * Math.PI * cutoff)
  const dt = 1 / sampleRate
  const alpha = rc / (rc + dt)

  return samples.map((channel) => {
    const filtered = new Float32Array(channel.length)
    filtered[0] = channel[0]
    let prev = channel[0]

    for (let i = 1; i < channel.length; i++) {
      filtered[i] = alpha * (filtered[i - 1] + channel[i] - prev)
      prev = channel[i]
    }

    return filtered
  })
}

/**
 * Stutter effect - repeat small sections
 */
export function stutter(
  samples: Float32Array[],
  sampleRate: number,
  stutterLength: number,
  repetitions: number
): Float32Array[] {
  const stutterSamples = Math.round(stutterLength * sampleRate)
  repetitions = Math.max(1, Math.round(repetitions))

  return samples.map((channel) => {
    const output: number[] = []

    for (let i = 0; i < channel.length; i += stutterSamples) {
      const chunk = channel.slice(i, Math.min(i + stutterSamples, channel.length))

      for (let r = 0; r < repetitions; r++) {
        for (let j = 0; j < chunk.length; j++) {
          output.push(chunk[j])
        }
      }
    }

    return new Float32Array(output)
  })
}

/**
 * Gate effect - silence below threshold
 */
export function gate(samples: Float32Array[], threshold: number): Float32Array[] {
  threshold = Math.max(0, Math.min(1, threshold))

  return samples.map((channel) => {
    const gated = new Float32Array(channel.length)

    for (let i = 0; i < channel.length; i++) {
      if (Math.abs(channel[i]) > threshold) {
        gated[i] = channel[i]
      } else {
        gated[i] = 0
      }
    }

    return gated
  })
}

/**
 * Normalize audio to peak amplitude
 */
export function normalize(samples: Float32Array[], targetPeak = 0.95): Float32Array[] {
  let maxAmp = 0
  for (const channel of samples) {
    for (let i = 0; i < channel.length; i++) {
      const abs = Math.abs(channel[i])
      if (abs > maxAmp) maxAmp = abs
    }
  }

  if (maxAmp === 0) return samples

  const scale = targetPeak / maxAmp
  return volume(samples, scale)
}

/**
 * Trim silence from start and end
 */
export function trimSilence(samples: Float32Array[], threshold = 0.001): Float32Array[] {
  if (samples.length === 0 || samples[0].length === 0) return samples

  let start = 0
  let end = samples[0].length - 1

  // Find start
  outer: for (let i = 0; i < samples[0].length; i++) {
    for (const channel of samples) {
      if (Math.abs(channel[i]) > threshold) {
        start = i
        break outer
      }
    }
  }

  // Find end
  outer2: for (let i = samples[0].length - 1; i >= 0; i--) {
    for (const channel of samples) {
      if (Math.abs(channel[i]) > threshold) {
        end = i
        break outer2
      }
    }
  }

  if (start >= end) return samples

  return samples.map((channel) => channel.slice(start, end + 1))
}

// Effect registry for pattern parser
export const effectRegistry: Record<string, EffectFunction> = {
  r: (s) => reverse(s),
  v: (s, sr, gain = 1) => volume(s, gain),
  s: (s, sr, factor = 1) => speed(s, factor),
  d: (s, sr, factor = 2) => downsample(s, factor),
  b: (s, sr, bits = 8) => bitcrush(s, bits),
  g: (s, sr, startVol = 0, endVol = 1) => gradient(s, startVol, endVol),
  c: (s, sr, mode = 0) => channel(s, mode),
  fi: (s) => fadeIn(s),
  fo: (s) => fadeOut(s),
  delay: (s, sr, time = 0.25, fb = 0.5, wet = 0.3) => delay(s, sr, time, fb, wet),
  reverb: (s, sr, size = 0.5, damp = 0.5, wet = 0.3) => reverb(s, sr, size, damp, wet),
  dist: (s, sr, amount = 50) => distortion(s, amount),
  lp: (s, sr, cutoff = 1000) => lowpass(s, sr, cutoff),
  hp: (s, sr, cutoff = 200) => highpass(s, sr, cutoff),
  stutter: (s, sr, len = 0.05, reps = 4) => stutter(s, sr, len, reps),
  gate: (s, sr, thresh = 0.1) => gate(s, thresh),
  norm: (s) => normalize(s),
  trim: (s) => trimSilence(s),
}
