/**
 * Beat Detection System
 * Implements onset detection using spectral flux analysis and dynamic programming
 * for beat tracking - a client-side alternative to madmom
 */

export interface BeatDetectionOptions {
  hopSize?: number;
  frameSize?: number;
  sensitivity?: number;
  minBPM?: number;
  maxBPM?: number;
  variableBPM?: boolean;
}

export interface BeatDetectionResult {
  beatmap: number[];
  bpm: number;
  confidence: number;
}

/**
 * Compute Short-Time Fourier Transform magnitude spectrum
 */
function computeSTFT(
  signal: Float32Array,
  frameSize: number,
  hopSize: number
): Float32Array[] {
  const numFrames = Math.floor((signal.length - frameSize) / hopSize) + 1;
  const spectra: Float32Array[] = [];
  
  // Hann window
  const window = new Float32Array(frameSize);
  for (let i = 0; i < frameSize; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (frameSize - 1)));
  }
  
  for (let i = 0; i < numFrames; i++) {
    const start = i * hopSize;
    const frame = new Float32Array(frameSize);
    
    // Apply window
    for (let j = 0; j < frameSize; j++) {
      frame[j] = (signal[start + j] || 0) * window[j];
    }
    
    // Compute FFT magnitude (real FFT approximation using DFT)
    const spectrum = computeFFTMagnitude(frame);
    spectra.push(spectrum);
  }
  
  return spectra;
}

/**
 * Compute FFT magnitude spectrum using optimized DFT
 */
function computeFFTMagnitude(signal: Float32Array): Float32Array {
  const N = signal.length;
  const halfN = Math.floor(N / 2);
  const magnitude = new Float32Array(halfN);
  
  // Use a simplified but fast DFT for the positive frequencies only
  for (let k = 0; k < halfN; k++) {
    let real = 0;
    let imag = 0;
    const angle = (-2 * Math.PI * k) / N;
    
    for (let n = 0; n < N; n++) {
      real += signal[n] * Math.cos(angle * n);
      imag += signal[n] * Math.sin(angle * n);
    }
    
    magnitude[k] = Math.sqrt(real * real + imag * imag);
  }
  
  return magnitude;
}

/**
 * Compute spectral flux (onset detection function)
 */
function computeSpectralFlux(spectra: Float32Array[]): Float32Array {
  const flux = new Float32Array(spectra.length);
  
  for (let i = 1; i < spectra.length; i++) {
    let sum = 0;
    const current = spectra[i];
    const previous = spectra[i - 1];
    
    for (let j = 0; j < current.length; j++) {
      // Half-wave rectified difference (only positive changes)
      const diff = current[j] - previous[j];
      if (diff > 0) {
        sum += diff * diff;
      }
    }
    
    flux[i] = Math.sqrt(sum);
  }
  
  return flux;
}

/**
 * Normalize array to 0-1 range
 */
function normalize(arr: Float32Array): Float32Array {
  const max = Math.max(...arr);
  const min = Math.min(...arr);
  const range = max - min || 1;
  
  const normalized = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    normalized[i] = (arr[i] - min) / range;
  }
  
  return normalized;
}

/**
 * Adaptive threshold for peak picking
 */
function adaptiveThreshold(
  signal: Float32Array,
  windowSize: number,
  multiplier: number
): Float32Array {
  const threshold = new Float32Array(signal.length);
  const halfWindow = Math.floor(windowSize / 2);
  
  for (let i = 0; i < signal.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(signal.length, i + halfWindow);
    
    let sum = 0;
    for (let j = start; j < end; j++) {
      sum += signal[j];
    }
    
    const mean = sum / (end - start);
    threshold[i] = mean * multiplier;
  }
  
  return threshold;
}

/**
 * Pick peaks from onset detection function
 */
function pickPeaks(
  odf: Float32Array,
  threshold: Float32Array,
  minDistance: number
): number[] {
  const peaks: number[] = [];
  
  for (let i = 1; i < odf.length - 1; i++) {
    // Local maximum
    if (odf[i] > odf[i - 1] && odf[i] >= odf[i + 1]) {
      // Above threshold
      if (odf[i] > threshold[i]) {
        // Check minimum distance from last peak
        if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDistance) {
          peaks.push(i);
        } else if (odf[i] > odf[peaks[peaks.length - 1]]) {
          // Replace last peak if this one is stronger
          peaks[peaks.length - 1] = i;
        }
      }
    }
  }
  
  return peaks;
}

/**
 * Estimate tempo using autocorrelation
 */
function estimateTempo(
  odf: Float32Array,
  sampleRate: number,
  hopSize: number,
  minBPM: number,
  maxBPM: number
): { bpm: number; confidence: number } {
  const fps = sampleRate / hopSize;
  const minLag = Math.floor((60 * fps) / maxBPM);
  const maxLag = Math.floor((60 * fps) / minBPM);
  
  // Compute autocorrelation
  const autocorr = new Float32Array(maxLag + 1);
  
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    let count = 0;
    
    for (let i = 0; i < odf.length - lag; i++) {
      sum += odf[i] * odf[i + lag];
      count++;
    }
    
    autocorr[lag] = count > 0 ? sum / count : 0;
  }
  
  // Find best tempo (highest autocorrelation peak)
  let bestLag = minLag;
  let bestValue = autocorr[minLag];
  
  for (let lag = minLag + 1; lag <= maxLag; lag++) {
    // Weight towards more common tempos (80-160 BPM)
    const bpm = (60 * fps) / lag;
    let weight = 1;
    
    if (bpm >= 80 && bpm <= 160) {
      weight = 1.5;
    } else if (bpm >= 60 && bpm <= 180) {
      weight = 1.2;
    }
    
    if (autocorr[lag] * weight > bestValue) {
      bestValue = autocorr[lag] * weight;
      bestLag = lag;
    }
  }
  
  const bpm = (60 * fps) / bestLag;
  const maxCorr = Math.max(...autocorr);
  const confidence = maxCorr > 0 ? bestValue / maxCorr : 0;
  
  return { bpm, confidence };
}

/**
 * Quantize beats to a regular grid using dynamic programming
 */
function quantizeBeats(
  onsets: number[],
  odf: Float32Array,
  expectedInterval: number,
  tolerance: number
): number[] {
  if (onsets.length === 0) return [];
  
  const beats: number[] = [];
  let currentBeat = onsets[0];
  beats.push(currentBeat);
  
  // Forward pass: find beats at expected intervals
  while (currentBeat + expectedInterval < odf.length) {
    const expectedNext = currentBeat + expectedInterval;
    const searchStart = Math.max(0, Math.floor(expectedNext - tolerance));
    const searchEnd = Math.min(odf.length - 1, Math.floor(expectedNext + tolerance));
    
    // Find strongest onset in search window
    let bestPos = Math.round(expectedNext);
    let bestScore = -Infinity;
    
    for (let i = searchStart; i <= searchEnd; i++) {
      // Score based on ODF strength and proximity to expected position
      const proximityScore = 1 - Math.abs(i - expectedNext) / tolerance;
      const score = odf[i] * 0.7 + proximityScore * 0.3;
      
      if (score > bestScore) {
        bestScore = score;
        bestPos = i;
      }
    }
    
    beats.push(bestPos);
    currentBeat = bestPos;
  }
  
  return beats;
}

/**
 * Main beat detection function
 */
export function detectBeats(
  audioData: Float32Array[],
  sampleRate: number,
  options: BeatDetectionOptions = {}
): BeatDetectionResult {
  const {
    hopSize = 512,
    frameSize = 2048,
    sensitivity = 1.5,
    minBPM = 60,
    maxBPM = 200,
    variableBPM = false
  } = options;
  
  // Mix to mono for analysis
  const mono = new Float32Array(audioData[0].length);
  for (let i = 0; i < mono.length; i++) {
    mono[i] = (audioData[0][i] + (audioData[1]?.[i] ?? audioData[0][i])) / 2;
  }
  
  // Compute spectral flux (onset detection function)
  const spectra = computeSTFT(mono, frameSize, hopSize);
  const odf = computeSpectralFlux(spectra);
  const normalizedODF = normalize(odf);
  
  // Estimate tempo
  const { bpm, confidence } = estimateTempo(normalizedODF, sampleRate, hopSize, minBPM, maxBPM);
  
  // Calculate expected beat interval in frames
  const fps = sampleRate / hopSize;
  const expectedInterval = (60 * fps) / bpm;
  
  // Adaptive threshold for onset detection
  const thresholdWindowSize = Math.round(expectedInterval * 2);
  const threshold = adaptiveThreshold(normalizedODF, thresholdWindowSize, sensitivity);
  
  // Pick onset peaks
  const minPeakDistance = Math.round(expectedInterval * 0.5);
  const onsets = pickPeaks(normalizedODF, threshold, minPeakDistance);
  
  let beatFrames: number[];
  
  if (variableBPM) {
    // Variable BPM: use raw onsets with some filtering
    beatFrames = onsets;
  } else {
    // Constant BPM: quantize to regular grid
    const tolerance = expectedInterval * 0.25;
    beatFrames = quantizeBeats(onsets, normalizedODF, expectedInterval, tolerance);
  }
  
  // Convert frame indices to sample positions
  const beatmap = beatFrames.map(frame => Math.round(frame * hopSize));
  
  // Ensure beatmap starts from 0 or near the beginning
  if (beatmap.length > 0 && beatmap[0] > hopSize * 10) {
    // Add beats before the first detected beat
    const firstBeat = beatmap[0];
    const interval = beatmap.length > 1 ? beatmap[1] - beatmap[0] : Math.round(expectedInterval * hopSize);
    const newBeats: number[] = [];
    let pos = firstBeat - interval;
    
    while (pos > 0) {
      newBeats.unshift(Math.round(pos));
      pos -= interval;
    }
    
    beatmap.unshift(...newBeats);
  }
  
  // Ensure we have a beat at or near position 0
  if (beatmap.length === 0 || beatmap[0] > hopSize * 2) {
    beatmap.unshift(0);
  }
  
  return {
    beatmap,
    bpm: Math.round(bpm * 10) / 10,
    confidence
  };
}

/**
 * Refine beatmap with user adjustments
 */
export function refineBeatmap(
  beatmap: number[],
  scale: number,
  shift: number
): number[] {
  let result = [...beatmap];
  
  // Apply scale
  if (scale !== 1 && scale > 0) {
    const scaled: number[] = [];
    let a = 0;
    
    while (a + 1 < result.length) {
      // Interpolate between beats
      const floor = Math.floor(a);
      const ceil = Math.min(floor + 1, result.length - 1);
      const t = a - floor;
      
      const interpolated = Math.round((1 - t) * result[floor] + t * result[ceil]);
      scaled.push(interpolated);
      
      a += scale;
    }
    
    result = scaled;
  }
  
  // Apply shift
  if (shift !== 0) {
    if (shift > 0) {
      // Positive shift: remove beats from beginning
      const fullBeats = Math.floor(shift);
      if (fullBeats > 0 && fullBeats < result.length) {
        result = result.slice(fullBeats);
      }
      
      // Decimal shift
      const decimalShift = shift % 1;
      if (decimalShift !== 0 && result.length > 1) {
        for (let i = 0; i < result.length - 1; i++) {
          result[i] = Math.round(result[i] + decimalShift * (result[i + 1] - result[i]));
        }
      }
    } else {
      // Negative shift: add beats at beginning
      const absShift = Math.abs(shift);
      const fullBeats = Math.floor(absShift);
      
      if (fullBeats > 0 && result.length > 1) {
        const interval = result[1] - result[0];
        const newBeats: number[] = [];
        
        for (let i = 0; i < fullBeats; i++) {
          const pos = result[0] - (fullBeats - i) * (interval / (fullBeats + 1));
          if (pos >= 0) {
            newBeats.push(Math.round(pos));
          }
        }
        
        result = [...newBeats, ...result];
      }
      
      // Decimal shift
      const decimalShift = absShift % 1;
      if (decimalShift !== 0 && result.length > 1) {
        for (let i = result.length - 1; i > 0; i--) {
          result[i] = Math.round(result[i] - decimalShift * (result[i] - result[i - 1]));
        }
      }
    }
  }
  
  return result;
}

/**
 * Adjust beatmap to start at a specific offset
 */
export function adjustBeatmap(beatmap: number[], adjust: number = 500): number[] {
  const adjusted = beatmap.map(b => Math.abs(b - adjust));
  adjusted.sort((a, b) => a - b);
  return adjusted;
}
