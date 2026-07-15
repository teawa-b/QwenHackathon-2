// Lightweight audio: ElevenLabs-generated SFX + ambient music loop.
// Plain HTMLAudio is enough here and works inside WebXR sessions on Quest,
// because every trigger follows a user gesture (entering the room / holding).

const SFX = {
  hold: '/audio/sfx-hold.mp3',
  release: '/audio/sfx-release.mp3',
  spawn: '/audio/sfx-spawn.mp3',
  event: '/audio/sfx-event.mp3',
  complete: '/audio/sfx-complete.mp3'
};
const MUSIC = '/audio/ops-ambient.mp3';

let music = null;

export const sfx = {
  play(name, volume = 0.7) {
    const src = SFX[name];
    if (!src) return;
    try {
      const clip = new Audio(src);
      clip.volume = volume;
      clip.play().catch(() => {});
    } catch {}
  },
  startMusic(volume = 0.2) {
    if (music) return;
    try {
      music = new Audio(MUSIC);
      music.loop = true;
      music.volume = volume;
      music.play().catch(() => { music = null; }); // autoplay blocked — retry on next gesture
    } catch { music = null; }
  },
  stopMusic() {
    try { music?.pause(); } catch {}
    music = null;
  }
};
