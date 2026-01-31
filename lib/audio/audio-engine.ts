/**
 * Core Audio Engine using Web Audio API
 * Handles audio loading, decoding, and playback
 */

export interface AudioData {
  buffer: AudioBuffer;
  channelData: Float32Array[];
  sampleRate: number;
  duration: number;
  numberOfChannels: number;
}

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private isPlaying = false;
  private startTime = 0;
  private pauseTime = 0;

  async initialize(): Promise<AudioContext> {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContext({ sampleRate: 44100 });
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    
    // Create gain and analyser nodes
    this.gainNode = this.audioContext.createGain();
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 2048;
    this.analyserNode.smoothingTimeConstant = 0.8;
    
    this.gainNode.connect(this.analyserNode);
    this.analyserNode.connect(this.audioContext.destination);
    
    return this.audioContext;
  }

  async loadAudioFile(file: File): Promise<AudioData> {
    await this.initialize();
    
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
    
    const channelData: Float32Array[] = [];
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      channelData.push(audioBuffer.getChannelData(i));
    }
    
    // Ensure stereo (duplicate mono if needed)
    if (channelData.length === 1) {
      channelData.push(new Float32Array(channelData[0]));
    }
    
    return {
      buffer: audioBuffer,
      channelData,
      sampleRate: audioBuffer.sampleRate,
      duration: audioBuffer.duration,
      numberOfChannels: Math.max(2, audioBuffer.numberOfChannels)
    };
  }

  async loadAudioFromUrl(url: string): Promise<AudioData> {
    await this.initialize();
    
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
    
    const channelData: Float32Array[] = [];
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      channelData.push(audioBuffer.getChannelData(i));
    }
    
    if (channelData.length === 1) {
      channelData.push(new Float32Array(channelData[0]));
    }
    
    return {
      buffer: audioBuffer,
      channelData,
      sampleRate: audioBuffer.sampleRate,
      duration: audioBuffer.duration,
      numberOfChannels: Math.max(2, audioBuffer.numberOfChannels)
    };
  }

  play(audioBuffer: AudioBuffer, startOffset = 0): void {
    if (!this.audioContext || !this.gainNode) return;
    
    this.stop();
    
    this.currentSource = this.audioContext.createBufferSource();
    this.currentSource.buffer = audioBuffer;
    this.currentSource.connect(this.gainNode);
    
    this.startTime = this.audioContext.currentTime - startOffset;
    this.currentSource.start(0, startOffset);
    this.isPlaying = true;
    
    this.currentSource.onended = () => {
      this.isPlaying = false;
    };
  }

  pause(): void {
    if (!this.audioContext || !this.currentSource) return;
    
    this.pauseTime = this.audioContext.currentTime - this.startTime;
    this.currentSource.stop();
    this.isPlaying = false;
  }

  resume(audioBuffer: AudioBuffer): void {
    this.play(audioBuffer, this.pauseTime);
  }

  stop(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // Already stopped
      }
      this.currentSource.disconnect();
      this.currentSource = null;
    }
    this.isPlaying = false;
    this.pauseTime = 0;
  }

  setVolume(value: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(2, value));
    }
  }

  getCurrentTime(): number {
    if (!this.audioContext || !this.isPlaying) return this.pauseTime;
    return this.audioContext.currentTime - this.startTime;
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  getAnalyserData(): Uint8Array {
    if (!this.analyserNode) return new Uint8Array(0);
    const data = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(data);
    return data;
  }

  getWaveformData(): Uint8Array {
    if (!this.analyserNode) return new Uint8Array(0);
    const data = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteTimeDomainData(data);
    return data;
  }

  getSampleRate(): number {
    return this.audioContext?.sampleRate ?? 44100;
  }

  getContext(): AudioContext | null {
    return this.audioContext;
  }

  async close(): Promise<void> {
    this.stop();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
    }
    this.audioContext = null;
  }

  /**
   * Create an AudioBuffer from Float32Array channel data
   */
  createBuffer(channelData: Float32Array[], sampleRate: number): AudioBuffer {
    if (!this.audioContext) {
      throw new Error('AudioContext not initialized');
    }
    
    const numberOfChannels = channelData.length;
    const length = channelData[0].length;
    const buffer = this.audioContext.createBuffer(numberOfChannels, length, sampleRate);
    
    for (let i = 0; i < numberOfChannels; i++) {
      buffer.copyToChannel(channelData[i], i);
    }
    
    return buffer;
  }
}

// Singleton instance
let audioEngineInstance: AudioEngine | null = null;

export function getAudioEngine(): AudioEngine {
  if (!audioEngineInstance) {
    audioEngineInstance = new AudioEngine();
  }
  return audioEngineInstance;
}
