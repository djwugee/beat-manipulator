/**
 * Pattern Parser
 * Parses beatswap patterns like "1, 2>0.5, 3, 4>0.5" into executable beat instructions
 * Full port of the Python parse.py with all features
 */

// Character constants matching the Python implementation
export const C_SLICE = ':><'; // 0 - range, 1 - first, 2 - last
export const C_JOIN = ',;~&^$}'; // 0 - append, 1 - first length, 2 - cut, 3 - maximum, 4 - sidechain multiply, 5 - sidechain add, 6 - first length add
export const C_MISC = "'\"`i@_?%#![]"; 
// 0 ',1 " - sample, 2 ` - sample uncut, 3 i - current, 4 @ - random, 
// 5 _ - random sep, 6 ? - not count, 7 % - create variable, 8 # - shuffle, 9 ! skip
// 10, 11 [] - song
export const C_MATH = '+-*/.';
export const C_MATH_STRICT = '.+-*/';

export interface ParsedBeat {
  beat: string | string[] | null; // Beat number(s) or slice
  effects: Array<[string, string | null]>; // Effect type and value
  isSample?: boolean;
  sampleName?: string;
}

export interface ParseResult {
  beats: ParsedBeat[];
  operators: string[];
  patternLength: number;
  shuffleGroups: string[];
  shuffleBeats: number[];
}

/**
 * Safely evaluate a math expression string
 */
export function saferEval(str: string | number): number {
  if (typeof str === 'number') return str;
  if (typeof str !== 'string') return 1;
  
  try {
    // Remove special characters that shouldn't be in math expressions
    for (const char of [C_MISC[4], C_MISC[7], C_MISC[8]]) {
      if (str.includes(char)) {
        str = str.substring(0, str.indexOf(char));
      }
    }
    
    // Replace curly braces
    str = str.replace(/{/g, '<').replace(/}/g, '>');
    
    // Only keep valid math characters
    const cleaned = str.split('').filter(c => 
      /\d/.test(c) || C_MATH.includes(c)
    ).join('');
    
    if (!cleaned) return 1;
    
    // Safe evaluation using Function constructor
    const result = Function(`"use strict"; return (${cleaned})`)();
    return typeof result === 'number' && !isNaN(result) ? result : 1;
  } catch {
    return 1;
  }
}

/**
 * Get number and advance cursor
 */
function getNum(pattern: string, cur: number, symbols = '+-*/'): [string, number] {
  let number = '';
  while (cur < pattern.length && (/\d/.test(pattern[cur]) || symbols.includes(pattern[cur]) || pattern[cur] === '.')) {
    number += pattern[cur];
    cur++;
  }
  return [number, cur - 1];
}

/**
 * Parse a beatswap pattern into structured instructions
 */
export function parsePattern(
  pattern: string,
  patternLengthOverride: number | null = null
): ParseResult {
  const cSlice = C_SLICE;
  const cJoin = C_JOIN;
  const cMisc = C_MISC;
  
  const separator = cJoin[0];
  
  // Preprocess pattern
  if (!pattern.includes(' ')) {
    pattern = pattern.replace(/ /g, ''); // Remove spaces if no space in join chars
  }
  
  // Remove consecutive separators
  for (const sep of cJoin) {
    while (pattern.includes(sep + sep)) {
      pattern = pattern.replace(new RegExp(`\\${sep}\\${sep}`, 'g'), sep);
    }
    while (pattern.startsWith(sep)) pattern = pattern.substring(1);
    while (pattern.endsWith(sep)) pattern = pattern.slice(0, -1);
  }
  
  // Create separated list for checking ! (skip) character
  let separated = pattern;
  for (const sep of cJoin) {
    separated = separated.split(sep).join(cJoin[0]);
  }
  const separatedBeats = separated.split(cJoin[0]);
  
  // Remove ? (not count) from pattern for processing
  pattern = pattern.replace(new RegExp(`\\${cMisc[6]}`, 'g'), '');
  
  // Parsing state
  let length = 0;
  let num = '';
  let cur = 0;
  const beats: ParsedBeat[] = [];
  const operators: string[] = [separator];
  const shuffleBeats: number[] = [];
  const shuffleGroups: string[] = [];
  let currentBeat = 0;
  let effect: string | null = null;
  
  pattern += ' '; // Add trailing space for parsing
  
  // Main parsing loop
  while (cur < pattern.length) {
    let char = pattern[cur];
    
    // Replace 'i' with current beat number
    if (char === cMisc[3]) {
      char = String(currentBeat + 1);
    }
    
    // Handle math characters, slice characters, and special characters
    if (/\d/.test(char) || C_MATH.includes(char) || cSlice.includes(char) || 
        cMisc.substring(4, 8).includes(char) || char === cMisc[9]) {
      num += char;
      
      // If character is % and beat hasn't been created, get next char too
      if (char === cMisc[7] && beats.length === currentBeat) {
        cur++;
        if (cur < pattern.length) {
          num += pattern[cur];
        }
      }
    }
    // Handle shuffle character #
    else if (char === cMisc[8]) {
      cur++;
      const [number, newCur] = getNum(pattern, cur);
      cur = newCur;
      shuffleBeats.push(currentBeat);
      shuffleGroups.push(number);
    }
    // Handle non-math characters
    else {
      // If beat hasn't been added yet and we have a number
      if (beats.length === currentBeat && num.length > 0) {
        // Check for slice characters
        let sliceChar: string | null = null;
        for (const c of cSlice) {
          if (num.includes(c)) {
            const parts = num.split(c);
            num = parts.slice(0, 2).join(c);
            sliceChar = c;
            
            // Update pattern length if not counting (?)
            if (patternLengthOverride === null && !separatedBeats[currentBeat]?.includes(cMisc[6])) {
              const num0 = saferEval(parts[0]);
              const num1 = saferEval(parts[1]);
              
              if (c === cSlice[0]) { // :
                length = Math.max(num0, num1, length);
              } else if (c === cSlice[1]) { // >
                length = Math.max(num0 - 1, num0 + num1 - 1, length);
              } else if (c === cSlice[2]) { // <
                length = Math.max(num0 - num1, num0, length);
              }
            }
            break;
          }
        }
        
        // Single beat (no slice)
        if (!sliceChar) {
          if (!separatedBeats[currentBeat]?.includes(cMisc[6])) {
            length = Math.max(saferEval(num), length);
          }
        }
        
        // Add beat
        if (sliceChar) {
          const parts = num.split(sliceChar);
          beats.push({
            beat: [parts[0], parts[1], sliceChar],
            effects: []
          });
        } else {
          beats.push({
            beat: num,
            effects: []
          });
        }
      }
      // Empty beat for samples without numbers
      else if (beats.length === currentBeat && num.length === 0) {
        beats.push({
          beat: null,
          effects: []
        });
      }
      
      // Parse effects
      if (beats.length === currentBeat + 1) {
        // If we have an effect pending, add it
        if (effect !== null) {
          beats[currentBeat].effects.push([effect, num || null]);
          effect = null;
        }
        
        // If current character is a letter, it's an effect
        if (/[a-zA-Z]/.test(char) && effect === null) {
          effect = char;
        }
      }
      
      // Handle beat separator
      if (cJoin.includes(char) && beats.length === currentBeat + 1) {
        currentBeat++;
        effect = null;
        operators.push(char);
      }
      
      num = '';
    }
    
    cur++;
  }
  
  const patternLength = patternLengthOverride ?? Math.ceil(length);
  
  return {
    beats,
    operators,
    patternLength: patternLength || 8,
    shuffleGroups,
    shuffleBeats
  };
}

/**
 * Handle random beat replacement (@)
 */
export function handleRandom(
  beat: string,
  patternLength: number,
  rChar = C_MISC[4],
  sChar = C_MISC[5]
): string {
  let result = beat + ' ';
  
  while (result.includes(rChar)) {
    const randIndex = result.indexOf(rChar) + 1;
    let char = result[randIndex] || '';
    let number = '';
    let endIndex = randIndex;
    
    // Get start number
    while (/\d|[.+\-*/]/.test(char)) {
      number += char;
      endIndex++;
      char = result[endIndex] || '';
    }
    
    let start = number ? saferEval(number) : 0;
    let stop = patternLength;
    let step = 1;
    
    // Check for separator (stop value)
    if (char === sChar) {
      endIndex++;
      char = result[endIndex] || '';
      number = '';
      
      while (/\d|[.+\-*/]/.test(char)) {
        number += char;
        endIndex++;
        char = result[endIndex] || '';
      }
      
      stop = number ? saferEval(number) : patternLength;
      
      // Check for second separator (step value)
      if (char === sChar) {
        endIndex++;
        char = result[endIndex] || '';
        number = '';
        
        while (/\d|[.+\-*/]/.test(char)) {
          number += char;
          endIndex++;
          char = result[endIndex] || '';
        }
        
        step = number ? saferEval(number) : 1;
      }
    }
    
    // Generate choices
    const choices: number[] = [];
    while (start <= stop) {
      choices.push(start);
      start += step;
    }
    
    // Pick random
    const randomChoice = choices[Math.floor(Math.random() * choices.length)] ?? 1;
    
    // Replace in string
    const beforeRand = result.substring(0, result.indexOf(rChar));
    const afterRand = result.substring(endIndex);
    result = beforeRand + String(randomChoice) + afterRand;
  }
  
  return result.trim();
}

/**
 * Shuffle pattern according to shuffle groups
 */
export function shufflePattern(
  beats: ParsedBeat[],
  shuffleBeats: number[],
  shuffleGroups: string[]
): ParsedBeat[] {
  const result = [...beats];
  const done: string[] = [];
  
  for (const group of shuffleGroups) {
    if (!done.includes(group)) {
      const indices = shuffleBeats
        .map((b, i) => shuffleGroups[i] === group ? b : -1)
        .filter(i => i >= 0);
      
      const shuffled = [...indices];
      // Fisher-Yates shuffle
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      
      // Apply shuffle
      const beatsCopy = beats.map(b => ({ ...b }));
      for (let i = 0; i < indices.length; i++) {
        if (indices[i] < result.length && shuffled[i] < beatsCopy.length) {
          result[indices[i]] = beatsCopy[shuffled[i]];
        }
      }
      
      done.push(group);
    }
  }
  
  return result;
}

/**
 * Built-in pattern presets
 */
export const PRESET_PATTERNS: Record<string, string> = {
  'test': '1;"cowbell"s3v2, 2;"cowbell"s2, 3;"cowbell", 4;"cowbell"s0.5, 5;"cowbell"s0.25, 6;"cowbell"s0.4, 7;"cowbell"s0.8, 8;"cowbell"s1.6',
  'reverse': 'reverse',
  'shuffle': 'shuffle',
  '2x speed': '1>0.5',
  '3x speed': '1>1/3',
  '4x speed': '1>0.25',
  'half-time': '1,2,4,5, | 3,6,8,7, | 9,11,12,13, | 15,13,14,16',
  'moombahton': '1>0.75, 2>0.25, 1>0.5, 4>0.5',
  'house': '1, 2, 3, 4, 1, 6, 7, 8, 1, 10, 11, 12, 1, 14, 15, 16',
  'drill': '1>0.75, 2>0.75, 2>0.5, 3>0.75, 4>0.75, 4>0.5, 5>0.75, 6>0.75, 6>0.5, 6, 7>0.75, 8<0.25',
  'jungle': '1, 2, 3, 4, 5, 7, 6, 8, | 11, 10, 11, 12, 13, 15, 14, 16',
  'dotted snares': '1, 2>0.5, 3, 4>0.5, 5, 6>0.5, 3, 4>0.5, 7, 8',
  '4-3': '1>2/3, 2>2/3, 2>2/3',
  '2 in 1': '1; 2',
  'reverse mix': '1;1r'
};

/**
 * Full preset configuration from Python presets.yaml
 */
export const FULL_PRESETS: Record<string, { pattern: string; scale?: string; shift?: number; description?: string }> = {
  '2x speed': { pattern: '1>0.5', scale: '1, 0.5, 1/3, 0.25' },
  '3x speed': { pattern: '1>1/3', scale: '1, 0.5' },
  '4x speed': { pattern: '1>0.25', scale: '1, 0.5' },
  '6x speed': { pattern: '1>1/6', scale: '1, 0.5' },
  '8x speed': { pattern: '1>0.125', scale: '1, 0.5' },
  '1.33x faster': { pattern: '1>0.75', scale: '1, 2/3, 0.5, 1/3, 0.25' },
  '1.5x faster': { pattern: '1>2/3', scale: '1, 2/3' },
  '1.5x slower': { pattern: '1>0.5, 1<0.5r, 1<0.5', scale: '2, 1, 0.75, 0.5' },
  '1.33x slower': { pattern: '1>2/3, 1<1/3r, 1<1/3', scale: '2, 1' },
  'reverse': { pattern: 'reverse', scale: '8, 4, 2, 1, 0.5, 1/3, 0.25, 0.2, 1/7, 0.125' },
  'reverse 8 beats': { pattern: '8, 7, 6, 5, 4, 3, 2, 1', scale: '1, 0.5' },
  'shuffle': { pattern: 'shuffle' },
  'shuffle 4 beats': { pattern: '1#1, 2#1, 3#1, 4#1', scale: '2, 1, 0.75, 0.5, 0.25, 0.125' },
  'shuffle 8 beats': { pattern: '1#1, 2#1, 3#1, 4#1, 5#1, 6#1, 7#1, 8#1', scale: '2, 1, 0.75, 0.5, 0.25' },
  'random': { pattern: 'random', scale: '2, 1, 0.5, 0.25, 0.125', description: 'generates a new random pattern each time' },
  'half-time': { pattern: '1,2,4,5, | 3,6,8,7, | 9,11,12,13, | 15,13,14,16', scale: '1, 0.5', description: 'halves the BPM' },
  'quarter-time': { pattern: '1,2,4,5,|6,8,9,10,|11,12,13,14,|16,14,15,16', scale: '0.5', description: '4 times lower BPM' },
  'dotted snares 1': { pattern: '1, 2>0.5, 3, 4>0.5, 5, 6>0.5, 3, 4>0.5, 7, 8', scale: '2, 1', description: 'Plays 5 snares in a 4/3 syncopation' },
  'dotted snares 2': { pattern: '1, 2, 3, 4, | 5, 7, 6, 8, | 11, 10, 9, 11, | 13, 14, 15, 16', scale: '0.5' },
  '4-3': { pattern: '1>2/3, 2>2/3, 2>2/3', scale: '2, 1, 0.5', description: '4/3 time signature' },
  '3-4': { pattern: '1>0.75', scale: '8, 4, 3, 2', description: '3/4 time signature' },
  '4-7 1': { pattern: '1, 2, 3, 4>0.5', scale: '2, 1, 0.5, 0.25, 0.125', description: '4/7 time signature' },
  '4-13': { pattern: '1, 2, 3, 4>0.25', scale: '4, 2, 1, 0.5', description: '4/13 time signature' },
  'moombahton': { pattern: '1>0.75, 2>0.25, 1>0.5, 4>0.5', scale: '3, 2, 1', description: 'moombahton/dutch house rhythm' },
  'four-on-the-floor': { pattern: '1, 2, 1, 4, 1, 6, 1, 8, 1, 10, 1, 12, 1, 14, 1, 16', scale: '0.5', description: 'replaces snares with kicks' },
  'house 1': { pattern: '1, 2, 3, 4, 1, 6, 7, 8, 1, 10, 11, 12, 1, 14, 15, 16', scale: '0.5' },
  'house 2': { pattern: '1>0.5', scale: '4' },
  'drill': { pattern: '1>0.75, 2>0.75, 2>0.5, 3>0.75, 4>0.75, 4>0.5, 5>0.75, 6>0.75, 6>0.5, 6, 7>0.75, 8<0.25', scale: '1, 0.5, 0.25', description: 'drill rhythm with 4/3 syncopation' },
  'jungle 1': { pattern: '1, 2, 3, 4, 5, 7, 6, 8, | 11, 10, 11, 12, 13, 15, 14, 16, | 19, 18, 19, 20, 21, 23, 22, 24, | 27, 26, 27, 28, 29, 31, 30, 32', scale: '1.5, 0.75, 0.5' },
  'jungle 2': { pattern: '1, 2, 1, 2, | 3>0.5, 3>0.5, 1>0.5, 7>0.5, | 7>0.5, 7>0.5, 5>0.5, 11>0.5, | 11>0.5, 7>0.5, 0>0.5, 11>0.5, | 14>0.5, 11>0.5, 13>0.5, 15>0.5, 16!', scale: '0.5' },
  'drumfunk': { pattern: '1, 2, 3, 4, | 3, 4, 9, 7, | 8, 10, 11, 0>0.5, 11>0.5, | 0>0.5, 15>0.5, 14, 15, 16', scale: '1, 0.5' },
  'jazzy': { pattern: '1, 2>0.5, 3, 4>0.5, 5, 6>0.5, 3, 4>0.5, 7, 8', scale: '0.5, 0.25' },
  'darkstep': { pattern: '1,1,3,1, | 1,7,1,1, | 11,9,9,11, | 9,9,15,16', scale: '1, 0.5' },
  '2 in 1': { pattern: '1; 2', scale: '8, 6, 4, 3, 2, 1, 0.5, 0.25' },
  '3 in 1': { pattern: '1; 2; 3', scale: '4, 3, 1' },
  '4 in 1': { pattern: '1; 2; 3; 4', scale: '4, 1' },
  'reverse mix': { pattern: '1;1r', scale: '4, 1, 0.75, 0.5' },
  'tripple dotted': { pattern: '1>0.375, 1>0.375, 1>0.25', scale: '8, 4, 2, 1, 0.5' },
  'kicks only': { pattern: '1>0.5', scale: '2', description: 'plays only kicks' },
  'snares only': { pattern: '1<0.5', scale: '2', description: 'plays only snares' },
  'no main drums': { pattern: '1<0.5', scale: '1, 0.5, 0.25, 0.125', description: 'skips kicks and snares' },
  'test': { pattern: '1;"cowbell"s3v2, 2;"cowbell"s2, 3;"cowbell", 4;"cowbell"s0.5, 5;"cowbell"s0.25, 6;"cowbell"s0.4, 7;"cowbell"s0.8, 8;"cowbell"s1.6', description: 'puts cowbells on beats' }
};
