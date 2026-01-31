"use client"

import { useState, useCallback } from "react"
import { Info, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

interface PatternEditorProps {
  pattern: string
  slicesPerBeat: number
  totalBeats: number
  onPatternChange: (pattern: string) => void
  onSlicesChange: (slices: number) => void
  onProcess: () => void
  isProcessing: boolean
}

const PATTERN_HELP = [
  { syntax: "0:n", description: "Play all beats in order (n = total beats)" },
  { syntax: "0:8:2", description: "Every other beat from 0 to 7" },
  { syntax: "0r", description: "Reverse beat 0" },
  { syntax: "0v0.5", description: "Beat 0 at 50% volume" },
  { syntax: "0s2", description: "Beat 0 at 2x speed" },
  { syntax: "0.0", description: "First slice of beat 0" },
  { syntax: "0*4", description: "Repeat beat 0 four times" },
  { syntax: "!0:8", description: "Shuffle beats 0-7" },
  { syntax: "_", description: "Insert silence" },
  { syntax: "(0,1)r", description: "Group with effect" },
]

const EFFECT_CHIPS = [
  { code: "r", name: "Reverse", description: "Reverse the segment" },
  { code: "v0.5", name: "Volume 50%", description: "Reduce volume by half" },
  { code: "s2", name: "Speed 2x", description: "Double speed" },
  { code: "s0.5", name: "Speed 0.5x", description: "Half speed" },
  { code: "d4", name: "Downsample", description: "Lo-fi quality reduction" },
  { code: "b4", name: "Bitcrush", description: "Bit reduction effect" },
  { code: "g0,1", name: "Fade In", description: "Volume gradient 0 to 1" },
  { code: "g1,0", name: "Fade Out", description: "Volume gradient 1 to 0" },
  { code: "fi", name: "Fade In", description: "Smooth fade in" },
  { code: "fo", name: "Fade Out", description: "Smooth fade out" },
]

export function PatternEditor({
  pattern,
  slicesPerBeat,
  totalBeats,
  onPatternChange,
  onSlicesChange,
  onProcess,
  isProcessing,
}: PatternEditorProps) {
  const [showHelp, setShowHelp] = useState(false)
  const [cursorPosition, setCursorPosition] = useState<number | null>(null)

  const handlePatternInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onPatternChange(e.target.value)
    },
    [onPatternChange]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        onProcess()
      }
    },
    [onProcess]
  )

  const insertEffect = useCallback(
    (effectCode: string) => {
      // Insert effect at cursor or append to end
      const newPattern = pattern + effectCode
      onPatternChange(newPattern)
    },
    [pattern, onPatternChange]
  )

  const insertQuickPattern = useCallback(
    (quickPattern: string) => {
      onPatternChange(quickPattern.replace(/n/g, totalBeats.toString()))
    },
    [totalBeats, onPatternChange]
  )

  return (
    <div className="space-y-4">
      {/* Pattern input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="pattern" className="text-sm font-medium">
            Pattern
          </Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHelp(!showHelp)}
            className="h-7 text-xs gap-1 text-muted-foreground"
          >
            <Info className="h-3 w-3" />
            Syntax Help
          </Button>
        </div>

        <textarea
          id="pattern"
          value={pattern}
          onChange={handlePatternInput}
          onKeyDown={handleKeyDown}
          placeholder="Enter pattern (e.g., 0:n for all beats)"
          className="pattern-input w-full min-h-[100px] resize-y"
          spellCheck={false}
        />

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Total beats: <span className="font-mono text-foreground">{totalBeats}</span>
          </span>
          <span>Press Ctrl+Enter to process</span>
        </div>
      </div>

      {/* Syntax help collapsible */}
      <Collapsible open={showHelp} onOpenChange={setShowHelp}>
        <CollapsibleContent className="space-y-3">
          <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Pattern Syntax Reference
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {PATTERN_HELP.map(({ syntax, description }) => (
                <button
                  key={syntax}
                  onClick={() => insertQuickPattern(syntax)}
                  className="text-left p-2 rounded bg-background/50 hover:bg-background transition-colors"
                >
                  <code className="text-xs font-mono text-primary">{syntax}</code>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                </button>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Effect chips */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Quick Effects</Label>
        <div className="flex flex-wrap gap-2">
          {EFFECT_CHIPS.map(({ code, name, description }) => (
            <button
              key={code}
              onClick={() => insertEffect(code)}
              className="effect-chip"
              title={description}
            >
              <span className="text-muted-foreground">{name}</span>
              <code className="text-primary">{code}</code>
            </button>
          ))}
        </div>
      </div>

      {/* Slices per beat */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Slices per Beat</Label>
          <span className="text-sm font-mono text-muted-foreground">{slicesPerBeat}</span>
        </div>
        <Slider
          value={[slicesPerBeat]}
          min={1}
          max={16}
          step={1}
          onValueChange={([value]) => onSlicesChange(value)}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Higher values allow finer control with slice notation (e.g., 0.0, 0.1, 0.2...)
        </p>
      </div>

      {/* Process button */}
      <Button
        onClick={onProcess}
        disabled={isProcessing || totalBeats === 0}
        className="w-full"
      >
        {isProcessing ? (
          <>
            <span className="spinner mr-2" />
            Processing...
          </>
        ) : (
          "Apply Pattern"
        )}
      </Button>
    </div>
  )
}
