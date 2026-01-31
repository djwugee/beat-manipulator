/**
 * Audio Engine Module Exports
 * Central export point for all audio processing functionality
 */

// Core audio engine
export { AudioEngine, audioEngine } from "./audio-engine"
export type { AudioData, BeatInfo } from "./audio-engine"

// Beat detection
export { BeatDetector, beatDetector } from "./beat-detector"
export type { BeatDetectionOptions, BeatMap } from "./beat-detector"

// Effects
export {
  effectRegistry,
  reverse,
  volume,
  speed,
  pitchShift,
  downsample,
  bitcrush,
  gradient,
  fadeIn,
  fadeOut,
  channel,
  delay,
  reverb,
  distortion,
  lowpass,
  highpass,
  stutter,
  gate,
  normalize,
  trimSilence,
} from "./effects"
export type { EffectFunction } from "./effects"

// Pattern parsing
export { PatternParser, patternParser, PRESET_PATTERNS } from "./pattern-parser"
export type { ParsedSegment, EffectSpec, PatternToken } from "./pattern-parser"

// Beatswap engine
export { BeatswapEngine, beatswapEngine } from "./beatswap"
export type { BeatswapOptions, LoadedSample } from "./beatswap"

// Export utilities
export {
  encodeWAV,
  createAudioBlob,
  downloadAudio,
  createPlaybackUrl,
  calculateAudioStats,
  formatDuration,
  formatFileSize,
  estimateFileSize,
} from "./export"
export type { ExportOptions } from "./export"
