// sound.js — tiny WebAudio bleeps, generated in code. No audio files, no
// network. The context is created lazily on the first user gesture, so the
// game stays silent until it is played.

let ctx = null;
let muted = false;

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = value;
}

/** One short tone: a sine blip that slides from `from` Hz to `to` Hz. */
function blip(from, to, seconds = 0.09, when = 0) {
  if (muted) return;
  try {
    ctx ??= new (window.AudioContext ?? window.webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    const start = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + seconds);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + seconds + 0.02);
  } catch {
    // No audio device, no AudioContext: the game plays on silently.
  }
}

/** The named sounds of the table. */
export function playTone(name) {
  if (muted) return;
  switch (name) {
    case 'select':
      blip(660, 660, 0.05);
      break;
    case 'play':
      blip(392, 523, 0.1);
      break;
    case 'answer':
      blip(330, 262, 0.1);
      break;
    case 'resolve':
      blip(523, 392, 0.12);
      blip(392, 262, 0.12, 0.1);
      break;
    case 'start':
      blip(262, 392, 0.1);
      blip(392, 523, 0.1, 0.09);
      blip(523, 659, 0.14, 0.18);
      break;
    case 'bad':
      blip(180, 120, 0.12);
      break;
    case 'win':
      [523, 659, 784, 1047].forEach((f, i) => blip(f, f, 0.16, i * 0.11));
      break;
    case 'lose':
      [392, 330, 262, 196].forEach((f, i) => blip(f, f, 0.18, i * 0.13));
      break;
    default:
      blip(440, 440, 0.05);
  }
}
