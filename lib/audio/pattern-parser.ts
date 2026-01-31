/**
 * Pattern Parser for Beat Manipulator
 * Full port of Python pattern syntax to TypeScript
 *
 * Pattern Syntax:
 * - Numbers: Beat indices (0-indexed)
 * - Ranges: 0:4 (beats 0-3), 0:8:2 (every 2nd beat from 0-7)
 * - Effects: 0r (reverse), 0v0.5 (volume), 0s2 (speed 2x)
 * - Slices: 0.0 (first slice of beat 0), 0.0:4 (slices 0-3 of beat 0)
 * - Shuffle: ? (random beat), !0:4 (shuffle beats 0-3)
 * - Repeat: 0*4 (repeat beat 0 four times)
 * - Samples: #kick (use loaded sample named "kick")
 * - Groups: (0,1,2) (group for applying effects)
 * - Variables: $x=0:4 (define), $x (use)
 */

import { effectRegistry, type EffectFunction } from "./effects"

export interface ParsedSegment {
  type: "beat" | "slice" | "sample" | "silence"
  beatIndex?: number
  sliceIndex?: number
  sliceCount?: number
  sampleName?: string
  effects: EffectSpec[]
  repeat: number
}

export interface EffectSpec {
  name: string
  args: number[]
}

export interface PatternToken {
  type:
    | "number"
    | "range"
    | "effect"
    | "slice"
    | "shuffle"
    | "repeat"
    | "sample"
    | "group_start"
    | "group_end"
    | "separator"
    | "variable_def"
    | "variable_ref"
    | "silence"
  value: string
  args?: number[]
}

interface Variable {
  name: string
  value: string
}

export class PatternParser {
  private variables: Map<string, string> = new Map()
  private slicesPerBeat: number

  constructor(slicesPerBeat = 4) {
    this.slicesPerBeat = slicesPerBeat
  }

  setSlicesPerBeat(count: number): void {
    this.slicesPerBeat = Math.max(1, count)
  }

  /**
   * Parse a complete pattern string into segments
   */
  parse(pattern: string, totalBeats: number): ParsedSegment[] {
    // Reset variables for new parse
    this.variables.clear()

    // Preprocess: expand variables and macros
    let expanded = this.expandVariables(pattern)
    expanded = this.expandMacros(expanded, totalBeats)

    // Tokenize
    const tokens = this.tokenize(expanded)

    // Parse tokens into segments
    return this.parseTokens(tokens, totalBeats)
  }

  /**
   * Expand variable definitions and references
   */
  private expandVariables(pattern: string): string {
    let result = pattern

    // Find and process variable definitions: $name=value
    const defRegex = /\$(\w+)=([^,\s\$]+)/g
    let match

    while ((match = defRegex.exec(pattern)) !== null) {
      const [full, name, value] = match
      this.variables.set(name, value)
      result = result.replace(full, "")
    }

    // Replace variable references: $name
    for (const [name, value] of this.variables) {
      result = result.replace(new RegExp(`\\$${name}(?!=)`, "g"), value)
    }

    return result.replace(/,+/g, ",").replace(/^,|,$/g, "")
  }

  /**
   * Expand macros and special syntax
   */
  private expandMacros(pattern: string, totalBeats: number): string {
    let result = pattern

    // Replace 'n' with total beats
    result = result.replace(/\bn\b/g, totalBeats.toString())

    // Expand range syntax: 0:4 -> 0,1,2,3
    result = this.expandRanges(result, totalBeats)

    // Expand shuffle syntax: !0:4 -> shuffled sequence
    result = this.expandShuffles(result, totalBeats)

    // Expand random beat: ? -> random beat index
    result = result.replace(/\?/g, () => Math.floor(Math.random() * totalBeats).toString())

    return result
  }

  /**
   * Expand range notation (start:end:step)
   */
  private expandRanges(pattern: string, totalBeats: number): string {
    // Match range patterns: digits:digits or digits:digits:digits
    // Also handle negative indices with 'n'
    const rangeRegex = /(\d+):(\d+)(?::(\d+))?/g

    return pattern.replace(rangeRegex, (match, startStr, endStr, stepStr) => {
      const start = parseInt(startStr)
      let end = parseInt(endStr)
      const step = stepStr ? parseInt(stepStr) : 1

      // Clamp to valid range
      end = Math.min(end, totalBeats)

      const beats: number[] = []
      for (let i = start; i < end; i += step) {
        if (i >= 0 && i < totalBeats) {
          beats.push(i)
        }
      }

      return beats.join(",")
    })
  }

  /**
   * Expand shuffle notation (!range)
   */
  private expandShuffles(pattern: string, totalBeats: number): string {
    // Match shuffle patterns: !start:end or !start:end:step
    const shuffleRegex = /!(\d+):(\d+)(?::(\d+))?/g

    return pattern.replace(shuffleRegex, (match, startStr, endStr, stepStr) => {
      const start = parseInt(startStr)
      let end = parseInt(endStr)
      const step = stepStr ? parseInt(stepStr) : 1

      end = Math.min(end, totalBeats)

      const beats: number[] = []
      for (let i = start; i < end; i += step) {
        if (i >= 0 && i < totalBeats) {
          beats.push(i)
        }
      }

      // Shuffle using Fisher-Yates
      for (let i = beats.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[beats[i], beats[j]] = [beats[j], beats[i]]
      }

      return beats.join(",")
    })
  }

  /**
   * Tokenize expanded pattern string
   */
  private tokenize(pattern: string): PatternToken[] {
    const tokens: PatternToken[] = []
    let i = 0

    while (i < pattern.length) {
      const char = pattern[i]

      // Skip whitespace
      if (/\s/.test(char)) {
        i++
        continue
      }

      // Separator
      if (char === ",") {
        tokens.push({ type: "separator", value: "," })
        i++
        continue
      }

      // Group start/end
      if (char === "(") {
        tokens.push({ type: "group_start", value: "(" })
        i++
        continue
      }
      if (char === ")") {
        tokens.push({ type: "group_end", value: ")" })
        i++
        continue
      }

      // Silence marker
      if (char === "_") {
        tokens.push({ type: "silence", value: "_" })
        i++
        continue
      }

      // Sample reference
      if (char === "#") {
        const nameMatch = pattern.slice(i + 1).match(/^(\w+)/)
        if (nameMatch) {
          tokens.push({ type: "sample", value: nameMatch[1] })
          i += 1 + nameMatch[1].length
          continue
        }
        i++
        continue
      }

      // Number with potential slice, effects, and repeat
      if (/\d/.test(char)) {
        let numStr = ""
        let j = i

        // Read the integer part
        while (j < pattern.length && /\d/.test(pattern[j])) {
          numStr += pattern[j]
          j++
        }

        // Check for slice notation (0.0)
        let sliceIndex: number | undefined
        if (pattern[j] === ".") {
          j++
          let sliceStr = ""
          while (j < pattern.length && /\d/.test(pattern[j])) {
            sliceStr += pattern[j]
            j++
          }
          if (sliceStr) {
            sliceIndex = parseInt(sliceStr)
          }
        }

        // Collect effects
        const effects: EffectSpec[] = []
        while (j < pattern.length) {
          const effectMatch = pattern.slice(j).match(/^([a-z]+)([\d.,-]*)/)
          if (effectMatch && effectRegistry[effectMatch[1]]) {
            const effectName = effectMatch[1]
            const argsStr = effectMatch[2]
            const args = argsStr
              ? argsStr
                  .split(/[,]/)
                  .filter(Boolean)
                  .map((a) => parseFloat(a))
              : []
            effects.push({ name: effectName, args })
            j += effectMatch[0].length
          } else {
            break
          }
        }

        // Check for repeat (*n)
        let repeat = 1
        if (pattern[j] === "*") {
          j++
          let repeatStr = ""
          while (j < pattern.length && /\d/.test(pattern[j])) {
            repeatStr += pattern[j]
            j++
          }
          if (repeatStr) {
            repeat = parseInt(repeatStr)
          }
        }

        if (sliceIndex !== undefined) {
          tokens.push({
            type: "slice",
            value: numStr,
            args: [sliceIndex, repeat, ...effects.flatMap((e) => [e.name as unknown as number, ...e.args])],
          })
        } else {
          tokens.push({ type: "number", value: numStr, args: [repeat] })
        }

        // Add effect tokens
        for (const effect of effects) {
          tokens.push({ type: "effect", value: effect.name, args: effect.args })
        }

        i = j
        continue
      }

      // Standalone effect (shouldn't happen normally, but handle it)
      if (/[a-z]/.test(char)) {
        const effectMatch = pattern.slice(i).match(/^([a-z]+)([\d.,-]*)/)
        if (effectMatch) {
          const argsStr = effectMatch[2]
          const args = argsStr
            ? argsStr
                .split(/[,]/)
                .filter(Boolean)
                .map((a) => parseFloat(a))
            : []
          tokens.push({ type: "effect", value: effectMatch[1], args })
          i += effectMatch[0].length
          continue
        }
      }

      i++
    }

    return tokens
  }

  /**
   * Parse tokens into segment list
   */
  private parseTokens(tokens: PatternToken[], totalBeats: number): ParsedSegment[] {
    const segments: ParsedSegment[] = []
    let i = 0
    let currentEffects: EffectSpec[] = []
    let inGroup = false
    let groupSegments: ParsedSegment[] = []

    while (i < tokens.length) {
      const token = tokens[i]

      switch (token.type) {
        case "number": {
          const beatIndex = parseInt(token.value) % totalBeats
          const repeat = token.args?.[0] || 1

          // Collect following effects
          const effects: EffectSpec[] = [...currentEffects]
          let j = i + 1
          while (j < tokens.length && tokens[j].type === "effect") {
            effects.push({
              name: tokens[j].value,
              args: tokens[j].args || [],
            })
            j++
          }

          const segment: ParsedSegment = {
            type: "beat",
            beatIndex,
            effects,
            repeat,
          }

          if (inGroup) {
            groupSegments.push(segment)
          } else {
            segments.push(segment)
          }

          i = j
          break
        }

        case "slice": {
          const beatIndex = parseInt(token.value) % totalBeats
          const sliceIndex = token.args?.[0] || 0
          const repeat = token.args?.[1] || 1

          // Collect following effects
          const effects: EffectSpec[] = [...currentEffects]
          let j = i + 1
          while (j < tokens.length && tokens[j].type === "effect") {
            effects.push({
              name: tokens[j].value,
              args: tokens[j].args || [],
            })
            j++
          }

          const segment: ParsedSegment = {
            type: "slice",
            beatIndex,
            sliceIndex: sliceIndex % this.slicesPerBeat,
            sliceCount: this.slicesPerBeat,
            effects,
            repeat,
          }

          if (inGroup) {
            groupSegments.push(segment)
          } else {
            segments.push(segment)
          }

          i = j
          break
        }

        case "sample": {
          const segment: ParsedSegment = {
            type: "sample",
            sampleName: token.value,
            effects: [...currentEffects],
            repeat: 1,
          }

          // Collect following effects
          let j = i + 1
          while (j < tokens.length && tokens[j].type === "effect") {
            segment.effects.push({
              name: tokens[j].value,
              args: tokens[j].args || [],
            })
            j++
          }

          if (inGroup) {
            groupSegments.push(segment)
          } else {
            segments.push(segment)
          }

          i = j
          break
        }

        case "silence": {
          const segment: ParsedSegment = {
            type: "silence",
            effects: [],
            repeat: 1,
          }

          if (inGroup) {
            groupSegments.push(segment)
          } else {
            segments.push(segment)
          }

          i++
          break
        }

        case "group_start":
          inGroup = true
          groupSegments = []
          i++
          break

        case "group_end": {
          inGroup = false

          // Collect effects that apply to the whole group
          let j = i + 1
          const groupEffects: EffectSpec[] = []
          while (j < tokens.length && tokens[j].type === "effect") {
            groupEffects.push({
              name: tokens[j].value,
              args: tokens[j].args || [],
            })
            j++
          }

          // Apply group effects to all segments in the group
          for (const seg of groupSegments) {
            seg.effects.push(...groupEffects)
            segments.push(seg)
          }

          i = j
          break
        }

        case "effect":
          // Standalone effect - add to current effects stack
          currentEffects.push({
            name: token.value,
            args: token.args || [],
          })
          i++
          break

        case "separator":
          // Reset current effects on separator
          currentEffects = []
          i++
          break

        default:
          i++
      }
    }

    return segments
  }

  /**
   * Generate default pattern that plays all beats in order
   */
  static generateDefaultPattern(totalBeats: number): string {
    return `0:${totalBeats}`
  }

  /**
   * Generate reverse pattern
   */
  static generateReversePattern(totalBeats: number): string {
    const beats: number[] = []
    for (let i = totalBeats - 1; i >= 0; i--) {
      beats.push(i)
    }
    return beats.join(",")
  }

  /**
   * Generate shuffle pattern
   */
  static generateShufflePattern(totalBeats: number): string {
    return `!0:${totalBeats}`
  }

  /**
   * Generate halftime pattern (every other beat)
   */
  static generateHalftimePattern(totalBeats: number): string {
    return `0:${totalBeats}:2`
  }

  /**
   * Generate doubletime pattern (each beat twice)
   */
  static generateDoubletimePattern(totalBeats: number): string {
    const beats: string[] = []
    for (let i = 0; i < totalBeats; i++) {
      beats.push(`${i}*2`)
    }
    return beats.join(",")
  }
}

// Preset patterns from the Python version
export const PRESET_PATTERNS: Record<string, string> = {
  // Basic patterns
  normal: "0:n",
  reverse: "0:nr",
  "reverse beats": "n-1:-1:-1",
  shuffle: "!0:n",
  halftime: "0:n:2",
  doubletime: "0:n,0:n",

  // Beat manipulation
  "reverse every other": "0,1r,2,3r,4,5r,6,7r",
  "stutter first": "0*4,1:n",
  "drop first": "1:n",
  "drop last": "0:n-1",

  // Speed effects
  "speed up": "0:ns0.5,0:ns0.75,0:n",
  "slow down": "0:ns2,0:ns1.5,0:n",
  "speed ramp": "0:ns0.5,0:ns0.6,0:ns0.7,0:ns0.8,0:ns0.9,0:n",

  // Volume effects
  "fade in": "0:ng0,1",
  "fade out": "0:ng1,0",
  "pulse volume": "0v1,1v0.5,2v1,3v0.5,4v1,5v0.5,6v1,7v0.5",

  // Creative patterns
  backspin: "0:4,3r,2r,1r,0r,4:n",
  stutter: "0,0,0,0,1:n",
  "gate effect": "0:ngate0.1",
  bitcrush: "0:nb4",
  downsample: "0:nd4",

  // Complex patterns
  glitch: "0,0.0,0.1,1,2,2.2,2.3,3:n",
  "slice and dice": "0.0,1.2,2.1,3.3,4.0,5.2,6.1,7.3",
  "reverse slices": "0.3,0.2,0.1,0.0,1.3,1.2,1.1,1.0",

  // DJ-style patterns
  "build up": "0*8,0*4,1*4,0*2,1*2,2*2,3*2,0,1,2,3,4,5,6,7",
  breakdown: "0:4,_,_,_,_,4:n",
  "drop": "0:4s2,4:n",
}

export const patternParser = new PatternParser()
