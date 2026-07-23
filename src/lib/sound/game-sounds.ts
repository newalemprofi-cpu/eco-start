"use client";

/**
 * Every sound in the child app is synthesized in-browser via the Web
 * Audio API — no audio files to source, license, or ship. This matters
 * for a preschool app: kids can't read, so positive/negative feedback
 * has to be carried by sound and animation, not text. Every effect is
 * short (<1.2s) and gentle — nothing punitive, matching the "wrong
 * answer never fails" rule (see docs on the retry chime).
 */

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return null;
    ctx = new AudioCtor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(
  audio: AudioContext,
  startTime: number,
  freq: number,
  duration: number,
  { type = "sine", gain = 0.15 }: { type?: OscillatorType; gain?: number } = {}
) {
  const osc = audio.createOscillator();
  const env = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  env.gain.setValueAtTime(0, startTime);
  env.gain.linearRampToValueAtTime(gain, startTime + 0.02);
  env.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(env).connect(audio.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

function noiseBurst(audio: AudioContext, startTime: number, duration: number, gain = 0.05) {
  const bufferSize = Math.floor(audio.sampleRate * duration);
  const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const source = audio.createBufferSource();
  source.buffer = buffer;
  const env = audio.createGain();
  env.gain.setValueAtTime(gain, startTime);
  source.connect(env).connect(audio.destination);
  source.start(startTime);
}

export type GameSound = "tap" | "success" | "retry" | "celebrate" | "catch" | "whoosh";

/** Distinct synthesized textures used by the nature-sounds matching
 * game — deliberately simple approximations, not realistic samples. */
export type NatureSound = "bird" | "rain" | "wind" | "bee";

export function playSound(sound: GameSound) {
  const audio = getContext();
  if (!audio) return;
  const t = audio.currentTime;

  switch (sound) {
    case "tap":
      tone(audio, t, 660, 0.08, { gain: 0.08 });
      break;
    case "success": {
      const notes = [523.25, 659.25, 783.99]; // C5 E5 G5
      notes.forEach((f, i) => tone(audio, t + i * 0.09, f, 0.35, { gain: 0.13 }));
      break;
    }
    case "retry":
      tone(audio, t, 392, 0.18, { type: "triangle", gain: 0.09 });
      tone(audio, t + 0.14, 330, 0.22, { type: "triangle", gain: 0.09 });
      break;
    case "celebrate": {
      const notes = [523.25, 587.33, 659.25, 783.99, 1046.5]; // C E D... rising run
      notes.forEach((f, i) => tone(audio, t + i * 0.08, f, 0.4, { gain: 0.12 }));
      break;
    }
    case "catch":
      tone(audio, t, 880, 0.15, { gain: 0.14 });
      break;
    case "whoosh":
      noiseBurst(audio, t, 0.25, 0.04);
      break;
  }
}

export function playNatureSound(sound: NatureSound) {
  const audio = getContext();
  if (!audio) return;
  const t = audio.currentTime;

  switch (sound) {
    case "bird":
      // Quick ascending chirps
      [1200, 1500, 1350, 1700].forEach((f, i) => tone(audio, t + i * 0.12, f, 0.1, { type: "sine", gain: 0.09 }));
      break;
    case "rain":
      // A patter of soft noise bursts
      for (let i = 0; i < 8; i++) noiseBurst(audio, t + i * 0.09, 0.06, 0.03);
      break;
    case "wind": {
      // A low continuous tone with a slow volume swell
      const osc = audio.createOscillator();
      const env = audio.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(140, t);
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.06, t + 0.4);
      env.gain.linearRampToValueAtTime(0.02, t + 0.9);
      env.gain.linearRampToValueAtTime(0, t + 1.3);
      osc.connect(env).connect(audio.destination);
      osc.start(t);
      osc.stop(t + 1.35);
      break;
    }
    case "bee": {
      // A buzzy tremolo
      const osc = audio.createOscillator();
      const tremolo = audio.createOscillator();
      const tremoloGain = audio.createGain();
      const env = audio.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, t);
      tremolo.frequency.setValueAtTime(18, t);
      tremoloGain.gain.setValueAtTime(0.05, t);
      env.gain.setValueAtTime(0.06, t);
      tremolo.connect(tremoloGain);
      tremoloGain.connect(env.gain);
      osc.connect(env).connect(audio.destination);
      osc.start(t);
      tremolo.start(t);
      osc.stop(t + 0.9);
      tremolo.stop(t + 0.9);
      break;
    }
  }
}
