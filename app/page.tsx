"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Music2, Sliders, Library, Waveform } from "lucide-react"
import { useBeatManipulator } from "@/hooks/use-beat-manipulator"
import {
  WaveformDisplay,
  TransportControls,
  PatternEditor,
  PresetSelector,
  FileUpload,
  BeatInfoPanel,
  BeatGrid,
} from "@/components/beat-manipulator"

export default function BeatManipulatorApp() {
  const {
    processing,
    audio,
    patternState,
    playback,
    loadAudioFile,
    processPattern,
    setPattern,
    setSlicesPerBeat,
    applyPreset,
    togglePlayback,
    stopPlayback,
    seekTo,
    setVolume,
    exportAudio,
    getFormattedDuration,
    getEstimatedFileSize,
    presets,
  } = useBeatManipulator()

  const [activeTab, setActiveTab] = useState("pattern")

  const handleApplyPreset = (presetName: string) => {
    applyPreset(presetName)
    // Auto-process when preset is applied
    setTimeout(() => processPattern(), 100)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Music2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Beat Manipulator</h1>
                <p className="text-xs text-muted-foreground">
                  Real-time audio beat processing in your browser
                </p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              100% Client-Side Processing
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Error display */}
        {processing.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{processing.error}</AlertDescription>
          </Alert>
        )}

        {/* File upload */}
        <FileUpload
          onFileSelect={loadAudioFile}
          isLoading={processing.isLoading}
          fileName={audio.fileName}
          progress={processing.progress}
        />

        {/* Audio info panel */}
        <BeatInfoPanel
          audioData={audio.audioData}
          beatMap={audio.beatMap}
          processedSamples={audio.processedSamples}
        />

        {/* Waveform display */}
        <Card>
          <CardContent className="p-4">
            <WaveformDisplay
              audioData={audio.audioData}
              beatMap={audio.beatMap}
              processedSamples={audio.processedSamples}
              currentTime={playback.currentTime}
              duration={playback.duration}
              onSeek={seekTo}
              isPlaying={processing.isPlaying}
              showProcessed={!!audio.processedSamples}
            />
          </CardContent>
        </Card>

        {/* Transport controls */}
        <TransportControls
          isPlaying={processing.isPlaying}
          isProcessing={processing.isProcessing}
          canPlay={!!audio.processedSamples}
          canExport={!!audio.processedSamples}
          currentTime={playback.currentTime}
          duration={playback.duration}
          volume={playback.volume}
          onTogglePlay={togglePlayback}
          onStop={stopPlayback}
          onSeek={seekTo}
          onVolumeChange={setVolume}
          onExport={exportAudio}
          onReprocess={() => processPattern()}
          formatTime={getFormattedDuration}
        />

        {/* Main editing interface */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pattern editor and presets */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Pattern Editor</CardTitle>
                      <CardDescription>
                        Create custom beat patterns using the pattern syntax
                      </CardDescription>
                    </div>
                    <TabsList>
                      <TabsTrigger value="pattern" className="gap-2">
                        <Sliders className="h-4 w-4" />
                        Editor
                      </TabsTrigger>
                      <TabsTrigger value="presets" className="gap-2">
                        <Library className="h-4 w-4" />
                        Presets
                      </TabsTrigger>
                      <TabsTrigger value="grid" className="gap-2">
                        <Waveform className="h-4 w-4" />
                        Beat Grid
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </CardHeader>

                <CardContent>
                  <TabsContent value="pattern" className="mt-0">
                    <PatternEditor
                      pattern={patternState.pattern}
                      slicesPerBeat={patternState.slicesPerBeat}
                      totalBeats={audio.beatMap?.beats.length || 0}
                      onPatternChange={setPattern}
                      onSlicesChange={setSlicesPerBeat}
                      onProcess={() => processPattern()}
                      isProcessing={processing.isProcessing}
                    />
                  </TabsContent>

                  <TabsContent value="presets" className="mt-0">
                    <PresetSelector
                      presets={presets}
                      selectedPreset={patternState.selectedPreset}
                      onSelectPreset={handleApplyPreset}
                    />
                  </TabsContent>

                  <TabsContent value="grid" className="mt-0">
                    <BeatGrid
                      beatMap={audio.beatMap}
                      audioData={audio.audioData}
                      currentTime={playback.currentTime}
                      slicesPerBeat={patternState.slicesPerBeat}
                      onBeatClick={(index) => {
                        setPattern((patternState.pattern ? patternState.pattern + "," : "") + index)
                      }}
                      isPlaying={processing.isPlaying}
                    />
                  </TabsContent>
                </Tabs>
              </Tabs>
            </Card>
          </div>

          {/* Quick reference */}
          <div className="lg:col-span-1">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-lg">Quick Reference</CardTitle>
                <CardDescription>Pattern syntax cheat sheet</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <QuickRefSection
                    title="Beat Selection"
                    items={[
                      { code: "0", desc: "Single beat" },
                      { code: "0:4", desc: "Beats 0-3" },
                      { code: "0:8:2", desc: "Every 2nd beat" },
                      { code: "n", desc: "Total beats" },
                    ]}
                  />

                  <QuickRefSection
                    title="Effects"
                    items={[
                      { code: "r", desc: "Reverse" },
                      { code: "v0.5", desc: "50% volume" },
                      { code: "s2", desc: "2x speed" },
                      { code: "d4", desc: "Downsample" },
                      { code: "b8", desc: "Bitcrush" },
                    ]}
                  />

                  <QuickRefSection
                    title="Modifiers"
                    items={[
                      { code: "*4", desc: "Repeat 4x" },
                      { code: "!0:8", desc: "Shuffle" },
                      { code: "?", desc: "Random" },
                      { code: "_", desc: "Silence" },
                    ]}
                  />

                  <QuickRefSection
                    title="Slices"
                    items={[
                      { code: "0.0", desc: "1st slice" },
                      { code: "0.1", desc: "2nd slice" },
                      { code: "0.2", desc: "3rd slice" },
                      { code: "0.3", desc: "4th slice" },
                    ]}
                  />
                </div>

                <div className="pt-4 border-t border-border">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Example Patterns
                  </h4>
                  <div className="space-y-2 text-xs">
                    <ExamplePattern
                      pattern="0:n"
                      desc="Play all beats"
                      onClick={() => setPattern("0:n")}
                    />
                    <ExamplePattern
                      pattern="0r,1,2r,3"
                      desc="Reverse odds"
                      onClick={() => setPattern("0r,1,2r,3")}
                    />
                    <ExamplePattern
                      pattern="0*4,1:n"
                      desc="Stutter start"
                      onClick={() => setPattern("0*4,1:n")}
                    />
                    <ExamplePattern
                      pattern="!0:ns0.5"
                      desc="Shuffle + speed"
                      onClick={() => setPattern("!0:ns0.5")}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12">
        <div className="container max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>
              Beat Manipulator - Client-side audio processing powered by Web Audio API
            </p>
            <div className="flex items-center gap-4">
              <span>All processing happens locally in your browser</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function QuickRefSection({
  title,
  items,
}: {
  title: string
  items: { code: string; desc: string }[]
}) {
  return (
    <div>
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        {title}
      </h4>
      <div className="grid grid-cols-2 gap-1">
        {items.map(({ code, desc }) => (
          <div key={code} className="flex items-center gap-2 text-xs">
            <code className="bg-secondary px-1.5 py-0.5 rounded font-mono text-primary">
              {code}
            </code>
            <span className="text-muted-foreground">{desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ExamplePattern({
  pattern,
  desc,
  onClick,
}: {
  pattern: string
  desc: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-2 rounded bg-secondary/50 hover:bg-secondary transition-colors text-left"
    >
      <code className="font-mono text-primary">{pattern}</code>
      <span className="text-muted-foreground">{desc}</span>
    </button>
  )
}
