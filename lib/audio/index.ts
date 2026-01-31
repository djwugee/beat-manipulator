/**
 * Audio Engine Module Exports
 * Central export point for all audio processing functionality
 */

// Core audio engine
export { AudioEngine, audioEngine, type AudioData, type BeatInfo } from "./audio-engine"

// Beat detection
export {
  BeatDetector,
  beatDetector,
  type BeatDetectionOptions,
  type BeatMap,
} from "./beat-detector"

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
  type EffectFunction,
} from "./effects"

// Pattern parsing
export {
  PatternParser,
  patternParser,
  PRESET_PATTERNS,
  type ParsedSegment,
  type EffectSpec,
  type PatternToken,
} from "./pattern-parser"

// Beatswap engine
export {
  BeatswapEngine,
  beatswapEngine,
  type BeatswapOptions,
  type LoadedSample,
} from "./beatswap"

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
  type ExportOptions,
} from "./export"
