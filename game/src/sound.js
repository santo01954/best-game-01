// A tiny WebAudio synth: short oscillator blips for pickups, hits and wins.
// No audio files, no network. Everything is guarded: a browser with no audio
// (or a screenshot run) simply stays silent.

export function createSound() {
  let context = null;
  let muted = false;

  function unlock() {
    try {
      if (!context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        context = new AudioContext();
      }
      if (context.state === 'suspended') context.resume();
    } catch {
      // No audio: stay silent.
    }
  }

  window.addEventListener('keydown', unlock, { once: false });
  window.addEventListener('pointerdown', unlock, { once: false });

  function tone(freq, when, dur, type, gainValue) {
    if (!context || muted) return;
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, context.currentTime + when);
      gain.gain.setValueAtTime(0.0001, context.currentTime + when);
      gain.gain.exponentialRampToValueAtTime(gainValue, context.currentTime + when + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + when + dur);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(context.currentTime + when);
      osc.stop(context.currentTime + when + dur + 0.02);
    } catch {
      // No audio: stay silent.
    }
  }

  return {
    unlock,
    toggleMute() {
      muted = !muted;
      return muted;
    },
    pickup() {
      tone(880, 0, 0.09, 'sine', 0.12);
      tone(1318, 0.07, 0.12, 'sine', 0.1);
    },
    hit() {
      tone(160, 0, 0.22, 'sawtooth', 0.1);
      tone(90, 0.05, 0.25, 'sawtooth', 0.08);
    },
    win() {
      [523, 659, 784, 1046].forEach((freq, i) => tone(freq, i * 0.09, 0.22, 'triangle', 0.12));
    },
    click() {
      tone(660, 0, 0.06, 'sine', 0.08);
    },
  };
}
