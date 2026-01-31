"use client"

import { useState, useMemo } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface PresetSelectorProps {
  presets: Record<string, string>
  selectedPreset: string | null
  onSelectPreset: (name: string) => void
}

const PRESET_CATEGORIES: Record<string, string[]> = {
  "Basic": ["normal", "reverse", "reverse beats", "shuffle", "halftime", "doubletime"],
  "Beat Manipulation": ["reverse every other", "stutter first", "drop first", "drop last"],
  "Speed Effects": ["speed up", "slow down", "speed ramp"],
  "Volume Effects": ["fade in", "fade out", "pulse volume"],
  "Creative": ["backspin", "stutter", "gate effect", "bitcrush", "downsample"],
  "Complex": ["glitch", "slice and dice", "reverse slices"],
  "DJ Style": ["build up", "breakdown", "drop"],
}

export function PresetSelector({
  presets,
  selectedPreset,
  onSelectPreset,
}: PresetSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredCategories = useMemo(() => {
    if (!searchQuery) return PRESET_CATEGORIES

    const query = searchQuery.toLowerCase()
    const filtered: Record<string, string[]> = {}

    for (const [category, presetNames] of Object.entries(PRESET_CATEGORIES)) {
      const matchingPresets = presetNames.filter(
        (name) =>
          name.toLowerCase().includes(query) ||
          presets[name]?.toLowerCase().includes(query)
      )
      if (matchingPresets.length > 0) {
        filtered[category] = matchingPresets
      }
    }

    return filtered
  }, [searchQuery, presets])

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search presets..."
          className="pl-9"
        />
      </div>

      {/* Preset list */}
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-6">
          {Object.entries(filteredCategories).map(([category, presetNames]) => (
            <div key={category} className="space-y-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {category}
              </h3>
              <div className="grid gap-2">
                {presetNames.map((name) => {
                  const pattern = presets[name]
                  if (!pattern) return null

                  return (
                    <button
                      key={name}
                      onClick={() => onSelectPreset(name)}
                      className={cn(
                        "preset-card text-left",
                        selectedPreset === name && "selected"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium capitalize">{name}</span>
                        {selectedPreset === name && (
                          <span className="text-xs text-primary">Active</span>
                        )}
                      </div>
                      <code className="text-xs font-mono text-muted-foreground mt-1 block truncate">
                        {pattern}
                      </code>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {Object.keys(filteredCategories).length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No presets found matching "{searchQuery}"</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
