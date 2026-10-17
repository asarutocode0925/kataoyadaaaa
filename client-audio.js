// 効果音（Web Audio で合成。音声ファイルは使わない）

let ac = null;
let master = null;
let noiseBuf = null;
let masterVolume = 0.7;

// 音量の設定（音声の作成前でも後でも使える）
export function setMasterVolume(v) {
  masterVolume = v;
  if (master) master.gain.value = v;
}
export function audio() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.gain.value = masterVolume;
    master.connect(ac.destination);
  }
  if (ac.state === "suspended") ac.resume();
  return ac;
}
addEventListener("pointerdown", () => audio(), { once: true });

export function sfxShot(s) {
  if (!ac) return;
  const t = ac.currentTime;
  if (!noiseBuf) {
    const len = Math.floor(ac.sampleRate * 0.3);
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = s.f * 4;
  const g = ac.createGain();
  g.gain.setValueAtTime(s.v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + s.d);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + s.d);
}

export function sfxTone(from, to, dur, vol) {
  if (!ac) return;
  const t = ac.currentTime;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur);
}
export const sfxHit = () => sfxTone(1200, 1000, 0.06, 0.2);

// 音の並び（ドーパミンが出るような、短く明るい連続音）
export function sfxSeq(notes, step, type, vol) {
  if (!ac) return;
  const t0 = ac.currentTime;
  notes.forEach((f, i) => {
    const t = t0 + i * step;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + step * 1.2);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + step * 1.3);
  });
}

// 短いカチッという音（リロード・足音）
export function ensureNoise() {
  if (!ac) return null;
  if (!noiseBuf) {
    const len = Math.floor(ac.sampleRate * 0.3);
    noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

export function sfxClick(vol = 0.06) {
  if (!ac || !ensureNoise()) return;
  const t = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 2400;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + 0.04);
}

export const sfxKill = () => sfxSeq([660, 880, 1320], 0.06, "square", 0.18);
export const sfxHead = () => sfxSeq([1320, 1760, 2640], 0.05, "triangle", 0.25);
export const sfxStreak = () => sfxSeq([523, 659, 784, 1047, 1319], 0.08, "sawtooth", 0.15);
export const sfxReloadStart = () => { sfxClick(0.08); setTimeout(() => sfxClick(0.06), 220); };
export const sfxReloadDone = () => sfxSeq([988, 1319], 0.05, "square", 0.12);
export const sfxAnnounce = () => sfxSeq([880, 1100], 0.1, "sine", 0.2);
export const sfxMapChange = () => sfxSeq([220, 330, 440], 0.09, "triangle", 0.2);
export const sfxDeath = () => sfxTone(400, 80, 0.4, 0.3);


