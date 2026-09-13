/**
 * Procedural Ambient Audio Synthesizer for "BỂ CÁ"
 * Generates soothing underwater soundscapes: warm low-pass filtered pads,
 * gentle resonant harmonic chimes, and soft water bubble drops.
 * Zero external audio files required, runs 100% in-browser safely.
 */

class UnderwaterSynthEngine {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private masterGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private chimeTimer: number | null = null;
  private bubbleTimer: number | null = null;
  private currentVolume = 0.5;
  private rootFrequency = 220; // default A3

  public init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();

      // Master output
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.currentVolume, this.ctx.currentTime);

      // Low pass filter to simulate sound underwater
      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.setValueAtTime(480, this.ctx.currentTime);
      this.filterNode.Q.setValueAtTime(2.5, this.ctx.currentTime);

      this.filterNode.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setTrack(rootFreq: number) {
    this.rootFrequency = rootFreq;
    if (this.isPlaying && this.droneOsc1 && this.droneOsc2 && this.ctx) {
      const t = this.ctx.currentTime;
      this.droneOsc1.frequency.exponentialRampToValueAtTime(rootFreq * 0.5, t + 1.2);
      this.droneOsc2.frequency.exponentialRampToValueAtTime(rootFreq * 0.75, t + 1.2);
    }
  }

  public setVolume(val: number) {
    this.currentVolume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.currentVolume, this.ctx.currentTime, 0.05);
    }
  }

  public play(rootFreq?: number) {
    if (rootFreq) this.rootFrequency = rootFreq;
    this.init();

    if (!this.ctx || this.isPlaying) return;
    this.isPlaying = true;

    const t = this.ctx.currentTime;

    // Create warm underwater drone
    this.droneOsc1 = this.ctx.createOscillator();
    this.droneOsc2 = this.ctx.createOscillator();
    this.droneGain = this.ctx.createGain();

    this.droneOsc1.type = 'sine';
    this.droneOsc1.frequency.setValueAtTime(this.rootFrequency * 0.5, t); // Sub octave

    this.droneOsc2.type = 'triangle';
    this.droneOsc2.frequency.setValueAtTime(this.rootFrequency * 0.75, t); // Perfect fifth lower

    this.droneGain.gain.setValueAtTime(0.01, t);
    this.droneGain.gain.exponentialRampToValueAtTime(0.25, t + 2.5);

    this.droneOsc1.connect(this.droneGain);
    this.droneOsc2.connect(this.droneGain);

    if (this.filterNode) {
      this.droneGain.connect(this.filterNode);
    }

    this.droneOsc1.start();
    this.droneOsc2.start();

    // Start harmonic water chimes and soft bubbles
    this.scheduleNextChime();
    this.scheduleNextBubble();
  }

  private scheduleNextChime() {
    if (!this.isPlaying) return;
    const interval = 2400 + Math.random() * 3200;
    this.chimeTimer = window.setTimeout(() => {
      this.triggerChime();
      this.scheduleNextChime();
    }, interval);
  }

  private scheduleNextBubble() {
    if (!this.isPlaying) return;
    const interval = 1800 + Math.random() * 2600;
    this.bubbleTimer = window.setTimeout(() => {
      this.triggerBubble();
      this.scheduleNextBubble();
    }, interval);
  }

  private triggerChime() {
    if (!this.ctx || !this.filterNode || !this.isPlaying) return;

    // Pentatonic scale multipliers
    const ratios = [1, 1.125, 1.25, 1.5, 1.667, 2, 2.25];
    const pickRatio = ratios[Math.floor(Math.random() * ratios.length)];
    const freq = this.rootFrequency * pickRatio;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    const t = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);

    osc.connect(gain);
    gain.connect(this.filterNode);

    osc.start(t);
    osc.stop(t + 3.4);
  }

  private triggerBubble() {
    if (!this.ctx || !this.filterNode || !this.isPlaying) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;

    const startFreq = 260 + Math.random() * 280;
    const endFreq = startFreq + 180 + Math.random() * 120;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.12);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.05, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

    osc.connect(gain);
    gain.connect(this.filterNode);

    osc.start(t);
    osc.stop(t + 0.2);
  }

  public pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;

    if (this.chimeTimer) {
      clearTimeout(this.chimeTimer);
      this.chimeTimer = null;
    }
    if (this.bubbleTimer) {
      clearTimeout(this.bubbleTimer);
      this.bubbleTimer = null;
    }

    if (this.droneGain && this.ctx) {
      const t = this.ctx.currentTime;
      this.droneGain.gain.setValueAtTime(this.droneGain.gain.value, t);
      this.droneGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);

      setTimeout(() => {
        try {
          this.droneOsc1?.stop();
          this.droneOsc2?.stop();
          this.droneOsc1?.disconnect();
          this.droneOsc2?.disconnect();
        } catch {
          // ignore
        }
      }, 500);
    }
  }

  public getPlaybackState(): boolean {
    return this.isPlaying;
  }
}

export const synthEngine = new UnderwaterSynthEngine();
