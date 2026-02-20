/**
 * Music generation and playback using Tone.js (Web Audio API).
 * Used by Sana and the Music Studio UI.
 */

export interface MusicTrack {
  id: string;
  title: string;
  mood: string;
  tempo: number;
  code: string;
  duration: number;
}

function getTone(mod: { default?: unknown; start?: () => Promise<void>; Transport?: { stop: () => void; cancel: () => void } }) {
  return (mod.default as typeof mod) ?? mod;
}

export async function playMusicFromCode(code: string): Promise<void> {
  if (typeof window === "undefined") return;
  const mod = await import("tone");
  const Tone = getTone(mod as Parameters<typeof getTone>[0]);
  await (Tone as { start?: () => Promise<void> }).start?.();
  try {
    const playFunction = new Function("Tone", code);
    playFunction(Tone);
  } catch (error) {
    console.error("Music playback error:", error);
    throw error;
  }
}

export function stopMusic(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return import("tone").then((mod) => {
    const Tone = getTone(mod as Parameters<typeof getTone>[0]);
    (Tone as { Transport?: { stop: () => void; cancel: () => void } }).Transport?.stop();
    (Tone as { Transport?: { cancel: () => void } }).Transport?.cancel();
  });
}

export function generateMedievalTheme(): string {
  return `
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.1, decay: 0.3, sustain: 0.5, release: 1.0 }
    }).toDestination();
    
    const reverb = new Tone.Reverb(3).toDestination();
    synth.connect(reverb);
    
    const melody = [
      { note: 'D4', duration: '4n', time: 0 },
      { note: 'F4', duration: '4n', time: 0.5 },
      { note: 'A4', duration: '4n', time: 1.0 },
      { note: 'G4', duration: '2n', time: 1.5 },
      { note: 'F4', duration: '4n', time: 2.5 },
      { note: 'E4', duration: '4n', time: 3.0 },
      { note: 'D4', duration: '2n', time: 3.5 },
    ];
    
    melody.forEach(({ note, duration, time }) => {
      synth.triggerAttackRelease(note, duration, Tone.now() + time);
    });
  `;
}

export function generateBattleTheme(): string {
  return `
    const drums = new Tone.MembraneSynth().toDestination();
    const bass = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.05, decay: 0.2, sustain: 0.4, release: 0.5 }
    }).toDestination();
    
    const distortion = new Tone.Distortion(0.3).toDestination();
    bass.connect(distortion);
    
    for (let i = 0; i < 8; i++) {
      drums.triggerAttackRelease('C2', '8n', Tone.now() + i * 0.25);
    }
    
    const bassNotes = ['C2', 'Eb2', 'F2', 'G2', 'Eb2', 'F2', 'C2', 'G1'];
    bassNotes.forEach((note, i) => {
      bass.triggerAttackRelease(note, '8n', Tone.now() + i * 0.25);
    });
  `;
}

export function generateHorrorAmbience(): string {
  return `
    const pad = new Tone.PolySynth(Tone.AMSynth, {
      harmonicity: 1.5,
      oscillator: { type: 'sine' },
      envelope: { attack: 2, decay: 1, sustain: 0.8, release: 3 }
    }).toDestination();
    
    const reverb = new Tone.Reverb(8).toDestination();
    const delay = new Tone.FeedbackDelay('4n', 0.5).toDestination();
    pad.connect(reverb);
    pad.connect(delay);
    
    pad.triggerAttackRelease(['C3', 'Db3', 'Gb3'], '2n', Tone.now());
    
    setTimeout(() => {
      const highSynth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.5, decay: 0.5, sustain: 0.3, release: 2 }
      }).toDestination();
      highSynth.triggerAttackRelease('B5', '4n');
    }, 3000);
  `;
}

export function generateExplorationTheme(): string {
  return `
    const piano = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.02, decay: 0.5, sustain: 0.3, release: 1.5 }
    }).toDestination();
    
    const reverb = new Tone.Reverb(4).toDestination();
    piano.connect(reverb);
    
    const melody = [
      { note: 'C4', duration: '4n', time: 0 },
      { note: 'E4', duration: '4n', time: 0.4 },
      { note: 'G4', duration: '4n', time: 0.8 },
      { note: 'A4', duration: '2n', time: 1.2 },
      { note: 'G4', duration: '4n', time: 2.0 },
      { note: 'F4', duration: '4n', time: 2.4 },
      { note: 'E4', duration: '4n', time: 2.8 },
      { note: 'C4', duration: '2n', time: 3.2 },
    ];
    
    melody.forEach(({ note, duration, time }) => {
      piano.triggerAttackRelease(note, duration, Tone.now() + time);
    });
  `;
}

export function generateMenuTheme(): string {
  return `
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.1, decay: 0.4, sustain: 0.6, release: 1.2 }
    }).toDestination();
    
    const reverb = new Tone.Reverb(2).toDestination();
    synth.connect(reverb);
    
    const chords = [
      { notes: ['C4', 'E4', 'G4'], time: 0 },
      { notes: ['F4', 'A4', 'C5'], time: 1 },
      { notes: ['G4', 'B4', 'D5'], time: 2 },
      { notes: ['C4', 'E4', 'G4'], time: 3 },
    ];
    
    chords.forEach(({ notes, time }) => {
      synth.triggerAttackRelease(notes, '2n', Tone.now() + time);
    });
  `;
}

/** Extract [MUSIC title: description] and following ```javascript block from text */
export function parseMusicBlock(text: string): { title: string; description: string; code: string } | null {
  const musicMatch = text.match(/\[MUSIC\s+([^:\]]+):\s*([^\n\[]*)\]/i);
  if (!musicMatch) return null;
  const title = musicMatch[1].trim();
  const description = musicMatch[2].trim();
  const codeMatch = text.match(/```(?:javascript|js)\s*\n?([\s\S]*?)```/);
  const code = codeMatch ? codeMatch[1].trim() : "";
  if (!code) return null;
  return { title, description, code };
}
