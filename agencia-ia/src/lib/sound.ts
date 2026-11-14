/**
 * Sonidos de interfaz sintetizados con Web Audio (sin archivos externos).
 * Solo suenan si el usuario activó el sonido.
 */
import { useOfficeStore } from '../store/useOfficeStore';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, duration: number, gain = 0.05, type: OscillatorType = 'sine') {
  const ac = audio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = ac.currentTime + start;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export type SoundName = 'abrir' | 'cerrar' | 'activar';

export function playSound(name: SoundName, force = false) {
  if (!force && !useOfficeStore.getState().soundOn) return;
  switch (name) {
    case 'abrir':
      tone(660, 0, 0.12);
      tone(880, 0.07, 0.16);
      break;
    case 'cerrar':
      tone(520, 0, 0.12, 0.04);
      break;
    case 'activar':
      tone(523, 0, 0.1);
      tone(659, 0.08, 0.1);
      tone(784, 0.16, 0.18);
      break;
  }
}
