import type { AudioPreset } from '../types/viroklipz';

interface PresetConfig {
  bpm: number;
  notes: number[];
  wave: OscillatorType;
  bassFreq: number;
  label: string;
}

const PRESETS: Record<AudioPreset, PresetConfig> = {
  urban_beat: {
    bpm: 112,
    notes: [220, 261.63, 329.63, 293.66, 220, 392, 329.63, 261.63],
    wave: 'triangle',
    bassFreq: 73.42,
    label: 'Pulso Urbano · 112 BPM',
  },
  sunset_house: {
    bpm: 122,
    notes: [293.66, 349.23, 440, 392, 349.23, 440, 523.25, 392],
    wave: 'sine',
    bassFreq: 87.31,
    label: 'Terraza Sunset · 122 BPM',
  },
  lofi_espresso: {
    bpm: 84,
    notes: [261.63, 329.63, 392, 493.88, 392, 329.63, 293.66, 349.23],
    wave: 'sine',
    bassFreq: 65.41,
    label: 'Lo-Fi Mañana · 84 BPM',
  },
  alpine_rush: {
    bpm: 130,
    notes: [196, 246.94, 293.66, 392, 329.63, 293.66, 246.94, 196],
    wave: 'sawtooth',
    bassFreq: 98,
    label: 'Sendero Alpino · 130 BPM',
  },
  analog_synth: {
    bpm: 102,
    notes: [174.61, 220, 261.63, 349.23, 329.63, 261.63, 220, 196],
    wave: 'triangle',
    bassFreq: 58.27,
    label: 'Cinta Analógica · 102 BPM',
  },
};

export const AUDIO_PRESET_OPTIONS: { id: AudioPreset; title: string; subtitle: string }[] = [
  { id: 'urban_beat', title: 'Pulso Urbano', subtitle: 'Groove percusivo 112 BPM' },
  { id: 'sunset_house', title: 'Terraza Sunset', subtitle: 'House melódico 122 BPM' },
  { id: 'lofi_espresso', title: 'Lo-Fi Mañana', subtitle: 'Acordes cálidos 84 BPM' },
  { id: 'alpine_rush', title: 'Sendero Alpino', subtitle: 'Ritmo cinético 130 BPM' },
  { id: 'analog_synth', title: 'Cinta Analógica', subtitle: 'Arpegio cálido 102 BPM' },
];

class ViroklipzAudioEngine {
  private ctx: AudioContext | null = null;
  private timer: number | null = null;
  private step = 0;
  private activePreset: AudioPreset | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public start(preset: AudioPreset) {
    if (this.activePreset === preset && this.timer !== null) return;
    this.stop();
    const ctx = this.ensureContext();
    if (!ctx) return;

    this.activePreset = preset;
    this.step = 0;
    const cfg = PRESETS[preset];
    const stepMs = Math.round((60 / cfg.bpm / 2) * 1000);

    const tick = () => {
      if (!this.ctx || this.activePreset !== preset) return;
      const now = this.ctx.currentTime;
      const noteFreq = cfg.notes[this.step % cfg.notes.length];

      // Melodic synth voice
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = cfg.wave;
      osc.frequency.setValueAtTime(noteFreq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.045, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.28);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);

      // Subtle kick pulse on even steps
      if (this.step % 2 === 0) {
        const kick = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(cfg.bassFreq * 1.8, now);
        kick.frequency.exponentialRampToValueAtTime(cfg.bassFreq * 0.65, now + 0.12);
        kickGain.gain.setValueAtTime(0.075, now);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        kick.connect(kickGain);
        kickGain.connect(this.ctx.destination);
        kick.start(now);
        kick.stop(now + 0.15);
      }

      this.step += 1;
    };

    tick();
    this.timer = window.setInterval(tick, stepMs);
  }

  public playVipChime() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      const baseTime = ctx.currentTime;
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = baseTime + idx * 0.08;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(0.09, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.34);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.36);
      });
    } catch {
      // Ignore Web Audio errors when autoplay is restricted
    }
  }

  public stop() {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.activePreset = null;
  }
}

export const audioEngine = new ViroklipzAudioEngine();
