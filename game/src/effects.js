// Feel: floating damage numbers, a shake on heavy hits, confetti on a win, and tiny
// WebAudio blips (synthesised, no sound files). All of it is cosmetic — the game plays
// exactly the same with every effect switched off.
let audio = null;

function ensureAudio() {
  if (audio) return audio;
  try {
    const Ctor = window.AudioContext ?? window.webkitAudioContext;
    audio = Ctor ? new Ctor() : null;
  } catch {
    audio = null;
  }
  return audio;
}

/** A short synth blip: frequency in Hz, length in seconds, quiet. */
export function blip(freq, seconds = 0.07, type = 'sine') {
  const ctx = ensureAudio();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + seconds);
  } catch {
    // Audio is decoration; a failure here never stops the game.
  }
}

export const sfx = {
  play: () => blip(660, 0.06),
  pact: () => {
    blip(660, 0.05);
    window.setTimeout(() => blip(880, 0.08), 60);
  },
  hurt: () => blip(180, 0.12, 'sawtooth'),
  heal: () => blip(520, 0.1, 'triangle'),
  win: () => {
    [523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => blip(f, 0.14), i * 110));
  },
  lose: () => {
    [392, 330, 262].forEach((f, i) => window.setTimeout(() => blip(f, 0.16, 'triangle'), i * 140));
  },
};

/** A number that floats up and fades over a life bar: "-9" red, "+7" green, "BLOCK" amber. */
export function floatText(targetId, text, kind) {
  const layer = document.getElementById('fx-layer');
  const target = document.getElementById(targetId);
  if (!layer || !target) return;
  const rect = target.getBoundingClientRect();
  const host = document.getElementById('table').getBoundingClientRect();
  const el = document.createElement('div');
  el.className = `float-text ${kind}`;
  el.textContent = text;
  el.style.left = `${rect.left - host.left + rect.width / 2}px`;
  el.style.top = `${rect.top - host.top}px`;
  layer.append(el);
  window.setTimeout(() => el.remove(), 1300);
}

/** Shake the table briefly — only for heavy hits (6 or more life damage). */
export function shakeTable() {
  const table = document.getElementById('table');
  if (!table) return;
  table.classList.remove('shake');
  void table.offsetWidth; // restart the animation
  table.classList.add('shake');
}

/** Ember confetti over the win screen. */
export function confetti() {
  const layer = document.getElementById('fx-layer');
  if (!layer) return;
  const colors = ['#e5484d', '#ffb347', '#46b96b', '#3e9bff', '#e0a63c'];
  for (let i = 0; i < 42; i += 1) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.9}s`;
    piece.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
    layer.append(piece);
    window.setTimeout(() => piece.remove(), 3600);
  }
}
