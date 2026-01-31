/**
 * Beatswap Processor
 * Core beat manipulation engine - full port of Python main.py beatswap functionality
 */

import { 
  parsePattern, 
  saferEval, 
  handleRandom, 
  shufflePattern, 
  C_SLICE, 
  C_JOIN, 
  C_MISC,
  ParsedBeat 
} from './pattern-parser';
import { applyEffect, EFFECTS } from './effects';

export interface BeatswapOptions {
  pattern: string;
  scale?: number;
  shift?: number;
  length?: number | null;
  smoothing?: number;
  adjust?: number;
  limitBeats?: number;
  limitLength?: number;
}

export interface BeatswapResult {
  audio: Float32Array[];
  beatmap: number[];
}

/**
 * Get a slice of audio between two sample positions
 */
function getAudioSlice(
  audio: Float32Array[],
  start: number,
  end: number,
  reverse = false
): Float32Array[] {
  const startSample = Math.max(0, Math.min(start, audio[0].length));
  const endSample = Math.max(0, Math.min(end, audio[0].length));
  
  if (startSample >= endSample) {
    return [new Float32Array(0), new Float32Array(0)];
  }
  
  const length = endSample - startSample;
  const result: Float32Array[] = [];
  
  for (let ch = 0; ch < audio.length; ch++) {
    const slice = new Float32Array(length);
    if (reverse) {
      for (let i = 0; i < length; i++) {
        slice[i] = audio[ch][endSample - 1 - i];
      }
    } else {
      slice.set(audio[ch].subarray(startSample, endSample));
    }
    result.push(slice);
  }
  
  return result;
}

/**
 * Get beat audio from beatmap
 */
function getBeat(
  audio: Float32Array[],
  beatmap: number[],
  beatIndex: number,
  patternN: number,
  patternLength: number
): Float32Array[] {
  const actualBeat = beatIndex + patternLength * patternN;
  
  if (actualBeat < 0 || actualBeat >= beatmap.length) {
    return [new Float32Array(0), new Float32Array(0)];
  }
  
  const start = beatmap[actualBeat];
  const end = actualBeat + 1 < beatmap.length ? beatmap[actualBeat + 1] : audio[0].length;
  
  return getAudioSlice(audio, start, end);
}

/**
 * Get a range of beats
 */
function getBeatRange(
  audio: Float32Array[],
  beatmap: number[],
  startBeat: number,
  endBeat: number,
  patternN: number,
  patternLength: number,
  sliceType: string
): Float32Array[] {
  const actualStart = startBeat + patternLength * patternN;
  const actualEnd = endBeat + patternLength * patternN;
  
  let start: number;
  let end: number;
  
  if (sliceType === C_SLICE[0]) { // : range
    start = Math.min(actualStart, actualEnd);
    end = Math.max(actualStart, actualEnd);
  } else if (sliceType === C_SLICE[1]) { // > first N
    start = actualStart - 1;
    end = actualStart - 1 + actualEnd;
  } else { // < last N
    start = actualStart - actualEnd;
    end = actualStart;
  }
  
  if (start < 0) start = 0;
  if (end >= beatmap.length) end = beatmap.length - 1;
  
  const startSample = beatmap[Math.floor(start)] || 0;
  const endSample = beatmap[Math.floor(end)] || audio[0].length;
  
  // Handle fractional beats
  let actualStartSample = startSample;
  let actualEndSample = endSample;
  
  if (start % 1 !== 0 && Math.floor(start) + 1 < beatmap.length) {
    const frac = start % 1;
    const nextBeat = beatmap[Math.floor(start) + 1];
    actualStartSample = Math.round(startSample + frac * (nextBeat - startSample));
  }
  
  if (end % 1 !== 0 && Math.floor(end) + 1 < beatmap.length) {
    const frac = end % 1;
    const baseBeat = beatmap[Math.floor(end)];
    const nextBeat = beatmap[Math.floor(end) + 1] || audio[0].length;
    actualEndSample = Math.round(baseBeat + frac * (nextBeat - baseBeat));
  }
  
  const isReversed = actualStart > actualEnd;
  return getAudioSlice(audio, actualStartSample, actualEndSample, isReversed);
}

/**
 * Get fractional beat
 */
function getFractionalBeat(
  audio: Float32Array[],
  beatmap: number[],
  beat: number,
  patternN: number,
  patternLength: number
): Float32Array[] {
  const actualBeat = beat + patternLength * patternN;
  
  if (actualBeat < 0) {
    return [new Float32Array(0), new Float32Array(0)];
  }
  
  const intBeat = Math.floor(actualBeat);
  const frac = actualBeat % 1;
  
  if (intBeat >= beatmap.length - 1) {
    return [new Float32Array(0), new Float32Array(0)];
  }
  
  const start = beatmap[intBeat];
  const nextBeat = beatmap[intBeat + 1] || audio[0].length;
  
  if (frac === 0) {
    return getAudioSlice(audio, start, nextBeat);
  }
  
  // Fractional: take portion of the beat
  const beatLength = nextBeat - start;
  const sliceEnd = Math.round(start + frac * beatLength);
  
  return getAudioSlice(audio, start, sliceEnd);
}

/**
 * Combine two audio segments with different join operations
 */
function combineAudio(
  prev: Float32Array[],
  current: Float32Array[],
  operator: string
): Float32Array[] {
  if (current[0].length === 0) return prev;
  if (prev[0].length === 0) return current;
  
  const cJoin = C_JOIN;
  
  // , - append (default)
  if (operator === cJoin[0]) {
    const result: Float32Array[] = [];
    for (let ch = 0; ch < prev.length; ch++) {
      const combined = new Float32Array(prev[ch].length + current[ch].length);
      combined.set(prev[ch]);
      combined.set(current[ch], prev[ch].length);
      result.push(combined);
    }
    return result;
  }
  
  // ; - first length, normalize volume
  if (operator === cJoin[1]) {
    const result: Float32Array[] = [];
    const targetLength = prev[0].length;
    
    for (let ch = 0; ch < prev.length; ch++) {
      const combined = new Float32Array(prev[ch]);
      const addLength = Math.min(current[ch].length, targetLength);
      
      for (let i = 0; i < addLength; i++) {
        combined[i] += current[ch][i];
      }
      
      // Normalize if too loud
      let max = 0;
      for (let i = 0; i < combined.length; i++) {
        max = Math.max(max, Math.abs(combined[i]));
      }
      if (max > 1.5) {
        const scale = 1 / (max * 0.75);
        for (let i = 0; i < combined.length; i++) {
          combined[i] *= scale;
        }
      }
      
      result.push(combined);
    }
    return result;
  }
  
  // ~ - cut to shortest
  if (operator === cJoin[2]) {
    const minLength = Math.min(prev[0].length, current[0].length);
    const result: Float32Array[] = [];
    
    for (let ch = 0; ch < prev.length; ch++) {
      const combined = new Float32Array(minLength);
      for (let i = 0; i < minLength; i++) {
        combined[i] = prev[ch][i] + current[ch][i];
      }
      result.push(combined);
    }
    return result;
  }
  
  // & - extend to longest
  if (operator === cJoin[3]) {
    const maxLength = Math.max(prev[0].length, current[0].length);
    const result: Float32Array[] = [];
    
    for (let ch = 0; ch < prev.length; ch++) {
      const combined = new Float32Array(maxLength);
      combined.set(prev[ch]);
      
      const addLength = Math.min(current[ch].length, maxLength);
      for (let i = 0; i < addLength; i++) {
        combined[i] += current[ch][i];
      }
      
      result.push(combined);
    }
    return result;
  }
  
  // ^ - multiply (sidechain)
  if (operator === cJoin[4]) {
    const result: Float32Array[] = [];
    const targetLength = prev[0].length;
    
    for (let ch = 0; ch < prev.length; ch++) {
      const combined = new Float32Array(prev[ch]);
      const multLength = Math.min(current[ch].length, targetLength);
      
      for (let i = 0; i < multLength; i++) {
        combined[i] *= current[ch][i];
      }
      
      result.push(combined);
    }
    return result;
  }
  
  // $ - sidechain and add
  if (operator === cJoin[5]) {
    const result: Float32Array[] = [];
    const targetLength = prev[0].length;
    
    for (let ch = 0; ch < prev.length; ch++) {
      const combined = new Float32Array(prev[ch]);
      const addLength = Math.min(current[ch].length, targetLength);
      
      // Create sidechain envelope from current
      const sidechain = new Float32Array(addLength);
      const windowSize = 1000;
      
      for (let i = 0; i < addLength; i++) {
        let sum = 0;
        const start = Math.max(0, i - windowSize / 2);
        const end = Math.min(addLength, i + windowSize / 2);
        
        for (let j = start; j < end; j++) {
          sum += Math.abs(current[ch][j]);
        }
        
        sidechain[i] = Math.abs(1 - sum / (end - start));
      }
      
      // Apply sidechain and add
      for (let i = 0; i < addLength; i++) {
        combined[i] = combined[i] * sidechain[i] + current[ch][i];
      }
      
      result.push(combined);
    }
    return result;
  }
  
  // } - first length, just add
  if (operator === cJoin[6]) {
    const result: Float32Array[] = [];
    const targetLength = prev[0].length;
    
    for (let ch = 0; ch < prev.length; ch++) {
      const combined = new Float32Array(prev[ch]);
      const addLength = Math.min(current[ch].length, targetLength);
      
      for (let i = 0; i < addLength; i++) {
        combined[i] += current[ch][i];
      }
      
      result.push(combined);
    }
    return result;
  }
  
  // Default: append
  const result: Float32Array[] = [];
  for (let ch = 0; ch < prev.length; ch++) {
    const combined = new Float32Array(prev[ch].length + current[ch].length);
    combined.set(prev[ch]);
    combined.set(current[ch], prev[ch].length);
    result.push(combined);
  }
  return result;
}

/**
 * Apply smoothing between beat segments
 */
function applySmoothing(
  beats: Float32Array[][],
  smoothingFactor: number
): void {
  for (let i = 0; i < beats.length - 1; i++) {
    if (beats[i][0].length < 2 || beats[i + 1][0].length < 2) continue;
    
    const current1 = beats[i][0][beats[i][0].length - 2];
    const current2 = beats[i][0][beats[i][0].length - 1];
    const following1 = beats[i + 1][0][0];
    const following2 = beats[i + 1][0][1];
    
    const diff = (Math.abs(following1 - (current2 + (current2 - current1))) +
                  Math.abs(current2 - (following1 + (following1 - following2)))) / 2;
    
    if (diff > 0) {
      const num = Math.min(Math.round(smoothingFactor * diff), beats[i][0].length - 1);
      
      if (num > 3) {
        // Fade out end of current beat
        for (let ch = 0; ch < beats[i].length; ch++) {
          for (let j = 0; j < num; j++) {
            const idx = beats[i][ch].length - num + j;
            const fadeOut = Math.sqrt(1 - j / num);
            const fadeIn = 1 - fadeOut;
            
            beats[i][ch][idx] *= fadeOut;
            beats[i][ch][idx] += fadeIn * beats[i + 1][ch][0];
          }
        }
      }
    }
  }
}

/**
 * Generate random pattern
 */
function generateRandomPattern(): string {
  let pattern = '';
  let randLength = 0;
  let limit = 10000;
  
  const sliceChoices = ['', '>0.5', '>0.25', '<0.5', '<0.25', '<1/3', '<2/3', '>1/3', '>2/3', '<0.75', '>0.75'];
  const sliceWeights = [13, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
  
  const effectChoices = ['', 's0.5', 's2', 'r', 'v0.5', 'v2', 'v0', 'd8', 'g', 'c', 'c0', 'c1', 'b4'];
  const effectWeights = [30, 2, 2, 2, 1, 1, 2, 2, 1, 2, 2, 2, 1];
  
  const joinChoices = [', ', ';'];
  const joinWeights = [5, 1];
  
  function weightedRandom<T>(choices: T[], weights: number[]): T {
    const total = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * total;
    
    for (let i = 0; i < choices.length; i++) {
      random -= weights[i];
      if (random <= 0) return choices[i];
    }
    
    return choices[choices.length - 1];
  }
  
  while (limit > 0) {
    limit--;
    
    const randNum = Math.floor(1 + Math.random() * 15);
    const actualNum = Math.random() * randNum > randLength ? randLength + 1 : randNum;
    
    const randSlice = weightedRandom(sliceChoices, sliceWeights);
    const randEffect = weightedRandom(effectChoices, effectWeights);
    const randJoin = weightedRandom(joinChoices, joinWeights);
    
    pattern += `${actualNum}${randSlice}${randEffect}${randJoin}`;
    
    if (randJoin === ',') randLength++;
    
    if ([4, 8, 16].includes(randLength)) {
      if (Math.random() * 16 > 14) break;
    } else {
      if (Math.random() * 16 > 15.5) break;
    }
  }
  
  return pattern.replace(/, $/, '');
}

/**
 * Main beatswap function
 */
export function beatswap(
  audio: Float32Array[],
  beatmap: number[],
  sampleRate: number,
  options: BeatswapOptions
): BeatswapResult {
  const {
    pattern: inputPattern,
    scale = 1,
    shift = 0,
    length = null,
    smoothing = 100,
    adjust = 500,
    limitBeats = 10000,
    limitLength = 52920000
  } = options;
  
  // Adjust beatmap
  let workingBeatmap = beatmap.map(b => Math.abs(b - adjust));
  workingBeatmap.sort((a, b) => a - b);
  workingBeatmap.push(audio[0].length);
  
  // Apply shift and scale
  if (shift !== 0) {
    if (shift > 0) {
      const fullShift = Math.floor(shift);
      if (fullShift > 0 && fullShift < workingBeatmap.length) {
        workingBeatmap = workingBeatmap.slice(fullShift);
      }
    }
  }
  
  if (scale !== 1 && scale > 0) {
    const scaled: number[] = [];
    let a = 0;
    
    while (a + 1 < workingBeatmap.length) {
      const floor = Math.floor(a);
      const ceil = Math.min(floor + 1, workingBeatmap.length - 1);
      const t = a - floor;
      
      scaled.push(Math.round((1 - t) * workingBeatmap[floor] + t * workingBeatmap[ceil]));
      a += scale;
    }
    
    workingBeatmap = scaled;
    workingBeatmap.push(audio[0].length);
  }
  
  // Handle special patterns
  let pattern = inputPattern;
  
  // Reverse pattern
  if (pattern.toLowerCase() === 'reverse') {
    const result: Float32Array[] = [];
    for (let ch = 0; ch < audio.length; ch++) {
      const reversed = new Float32Array(audio[ch].length);
      for (let i = 0; i < audio[ch].length; i++) {
        reversed[i] = audio[ch][audio[ch].length - 1 - i];
      }
      result.push(reversed);
    }
    return { audio: result, beatmap };
  }
  
  // Shuffle pattern
  if (pattern.toLowerCase() === 'shuffle') {
    const beats = Array.from({ length: workingBeatmap.length - 1 }, (_, i) => i);
    for (let i = beats.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [beats[i], beats[j]] = [beats[j], beats[i]];
    }
    pattern = beats.join(',');
  }
  
  // Random pattern
  if (pattern.toLowerCase() === 'random') {
    pattern = generateRandomPattern();
  }
  
  // Parse pattern
  const parsed = parsePattern(pattern, length);
  let { beats: parsedBeats, operators, patternLength, shuffleGroups, shuffleBeats } = parsed;
  
  // Beatswap main loop
  const result: Float32Array[][] = [];
  let n = -1;
  let tries = 0;
  let stop = false;
  let totalLength = 0;
  
  // Add audio before first beat
  if (workingBeatmap[0] > 0) {
    result.push(getAudioSlice(audio, 0, workingBeatmap[0]));
  }
  
  while (n * patternLength <= workingBeatmap.length && !stop) {
    n++;
    
    // Shuffle beats if needed
    if (shuffleBeats.length > 0) {
      parsedBeats = shufflePattern(parsedBeats, shuffleBeats, shuffleGroups);
    }
    
    for (let num = 0; num < parsedBeats.length; num++) {
      if (limitBeats !== null && result.length >= limitBeats) {
        stop = true;
        break;
      }
      
      const b = parsedBeats[num];
      let beat = b.beat;
      
      // Skip ! beats
      if (beat && typeof beat === 'string' && beat.includes(C_MISC[9])) {
        continue;
      }
      
      let beatAudio: Float32Array[];
      
      try {
        // Handle random (@)
        if (typeof beat === 'string' && beat.includes(C_MISC[4])) {
          beat = handleRandom(beat, patternLength);
        } else if (Array.isArray(beat)) {
          beat = beat.map(part => {
            if (typeof part === 'string' && part.includes(C_MISC[4])) {
              return handleRandom(part, patternLength);
            }
            return part;
          });
        }
        
        // Get beat audio
        if (beat === null) {
          beatAudio = [new Float32Array(0), new Float32Array(0)];
        } else if (typeof beat === 'string') {
          const beatNum = saferEval(beat);
          if (beatNum % 1 === 0) {
            beatAudio = getBeat(audio, workingBeatmap, beatNum, n, patternLength);
          } else {
            beatAudio = getFractionalBeat(audio, workingBeatmap, beatNum, n, patternLength);
          }
        } else if (Array.isArray(beat) && beat.length >= 3) {
          const startBeat = saferEval(beat[0]);
          const endBeat = saferEval(beat[1]);
          const sliceType = beat[2];
          beatAudio = getBeatRange(audio, workingBeatmap, startBeat, endBeat, n, patternLength, sliceType);
        } else {
          beatAudio = [new Float32Array(0), new Float32Array(0)];
        }
        
        if (beatAudio[0].length === 0) {
          tries++;
          if (tries > 30) break;
          continue;
        }
        
        // Apply effects
        for (const [effectType, effectValue] of b.effects) {
          if (effectType in EFFECTS) {
            const value = effectValue !== null ? saferEval(effectValue) : null;
            beatAudio = applyEffect(beatAudio, effectType, value);
          }
        }
        
        // Clip to -1, 1
        for (let ch = 0; ch < beatAudio.length; ch++) {
          for (let i = 0; i < beatAudio[ch].length; i++) {
            beatAudio[ch][i] = Math.max(-1, Math.min(1, beatAudio[ch][i]));
          }
        }
        
        // Check length limit
        if (limitLength !== null) {
          totalLength += beatAudio[0].length;
          if (totalLength >= limitLength) {
            stop = true;
            break;
          }
        }
        
        // Add beat to result
        const operator = operators[num] || C_JOIN[0];
        
        if (operator === C_JOIN[0]) {
          result.push(beatAudio);
        } else if (result.length > 0 && tries < 2) {
          result[result.length - 1] = combineAudio(result[result.length - 1], beatAudio, operator);
        }
        
        tries = 0;
        
      } catch (e) {
        tries++;
        if (tries > 30) break;
      }
    }
  }
  
  // Apply smoothing
  if (smoothing > 0) {
    applySmoothing(result, smoothing);
  }
  
  // Concatenate all beats
  const totalSamples = result.reduce((sum, beat) => sum + beat[0].length, 0);
  const finalAudio: Float32Array[] = [
    new Float32Array(totalSamples),
    new Float32Array(totalSamples)
  ];
  
  let offset = 0;
  for (const beat of result) {
    for (let ch = 0; ch < finalAudio.length; ch++) {
      finalAudio[ch].set(beat[ch] || new Float32Array(0), offset);
    }
    offset += beat[0].length;
  }
  
  return {
    audio: finalAudio,
    beatmap
  };
}
