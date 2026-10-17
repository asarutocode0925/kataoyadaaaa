import { initAdmin, isAdminOpen, openAdminPanel, closeAdminPanel } from "./client-admin.js";
import { audio, setMasterVolume, sfxShot, sfxTone, sfxHit, sfxHead, sfxKill, sfxStreak, sfxDeath, sfxReloadStart, sfxReloadDone, sfxAnnounce, sfxMapChange, sfxClick } from "./client-audio.js";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { io } from "socket.io-client";
import { MAPS, MAP_DECO, WEAPONS, WEAPON_ORDER, TICK, EYE_H, newPhys, stepMove } from "./shared-game.js";
import { buildViewModel, disposeViewModel, buildDeco, disposeDeco, tickSkins, skinPreview } from "./client-view.js";
import { loadSettings, bindSettings, setSkinPreview } from "./client-settings.js";

// ---- 設定 ----
const SERVER_URL = import.meta.env.DEV ? "http://localhost:3000" : undefined;
const INPUT_SEND_MS = 50;
const AUTO_FIRE_MS = 50;
const STICK_R = 60;
const MOUSE_BASE = 0.002;
const TOUCH_BASE = 0.006;
const SNAP_XZ = 2;
const SNAP_Y = 1.5;
const REMOTE_LERP = 0.25;
const KILLFEED_MAX = 5;
const KILLFEED_MS = 5000;
const MAX_STEPS = 5;

const settings = loadSettings();
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]));
const isTouch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
if (isTouch) document.body.classList.add("touch");

// 起動できない時に、真っ黒な画面ではなく理由を表示する
function showFatal(text) {
  const d = document.createElement("div");
  d.id = "fatal";
  d.style.cssText = "position:fixed;inset:0;z-index:999;background:#000;color:#fff;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;font-size:18px;line-height:1.7";
  d.textContent = text;
  document.body.appendChild(d);
}

// ---- Three.js ----
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ antialias: !isTouch, powerPreference: "high-performance" });
} catch (e) {
  showFatal("このブラウザでは3D表示（WebGL）が使えません。ChromeかSafariで開き直してください（アプリ内ブラウザでは動かないことがあります）。");
  throw e;
}
let pixelScale = Math.min(devicePixelRatio, isTouch ? 1.5 : 2);
renderer.setPixelRatio(pixelScale);
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
// 周囲の映り込み（金属の質感を出すため）
// 起動を速くするため、最初の画面が出た後で作る
setTimeout(() => {
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
}, 600);
scene.background = new THREE.Color(0x1a1d24);
scene.fog = new THREE.Fog(0x1a1d24, 40, 120);

const camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.1, 300);
camera.rotation.order = "YXZ";
scene.add(camera);

scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(10, 20, 10);
scene.add(sun);

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---- マップ ----
const mapGroup = new THREE.Group();
scene.add(mapGroup);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const wallMat = new THREE.MeshStandardMaterial({ color: 0x667788, roughness: 0.8 });
let currentMap = MAPS[0];

let decoGroup = null;

function clearMap() {
  if (decoGroup) {
    disposeDeco(decoGroup);
    decoGroup = null;
  }
  for (const c of mapGroup.children) {
    if (c.geometry && c.geometry !== boxGeo) c.geometry.dispose();
    if (c.material && c.material !== wallMat) c.material.dispose();
  }
  mapGroup.clear();
}

function buildMap(i) {
  currentMap = MAPS[i] ?? MAPS[0];
  clearMap();
  scene.background.set(currentMap.sky);
  scene.fog.color.set(currentMap.fog ?? currentMap.sky);
  const size = currentMap.bound * 2.5;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({ color: currentMap.color })
  );
  floor.rotation.x = -Math.PI / 2;
  mapGroup.add(floor);
  mapGroup.add(new THREE.GridHelper(size, 50, 0x445566, 0x2a3140));
  for (const b of currentMap.boxes) {
    const m = new THREE.Mesh(boxGeo, wallMat);
    m.scale.set(b.w, b.h, b.d);
    m.position.set(b.x, b.h / 2, b.z);
    mapGroup.add(m);
  }
  decoGroup = buildDeco(MAP_DECO[i] ?? []);
  mapGroup.add(decoGroup);
  announce(`マップ：${currentMap.name}`);
  sfxMapChange();
}

// ---- ロボット（共有リソース）----
const robotBodyGeo = new THREE.BoxGeometry(0.8, 1.0, 0.6);
const robotHeadGeo = new THREE.BoxGeometry(0.6, 0.5, 0.6);
const robotEyeGeo = new THREE.BoxGeometry(0.4, 0.1, 0.05);
const robotMat = new THREE.MeshStandardMaterial({ color: 0xc0c8d4, metalness: 0.6, roughness: 0.4 });
const robotEyeMat = new THREE.MeshStandardMaterial({ color: 0xff3322, emissive: 0xff3322 });

function makeRobot() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(robotBodyGeo, robotMat);
  body.position.y = 1.0;
  const head = new THREE.Mesh(robotHeadGeo, robotMat);
  head.position.y = 1.9;
  const eye = new THREE.Mesh(robotEyeGeo, robotEyeMat);
  eye.position.set(0, 1.95, -0.33);
  g.add(body, head, eye);
  return g;
}

// ---- 一人称の武器 ----
const vmRoot = new THREE.Group();
vmRoot.position.set(0.28, -0.26, -0.5);
camera.add(vmRoot);
let vm = null;
let vmKey = "";
let recoil = 0;
let swing = 0;

function refreshViewModel(weaponIdx) {
  const wk = WEAPON_ORDER[weaponIdx];
  const sk = settings.skins[wk] ?? "std";
  const model = wk === "knife" ? settings.knifeModel : "";
  const key = `${wk}:${sk}:${model}`;
  if (key === vmKey) return;
  vmKey = key;
  if (vm) {
    vmRoot.remove(vm);
    disposeViewModel(vm);
  }
  vm = buildViewModel(wk, sk, model);
  vmRoot.add(vm);
}

const tracerMat = new THREE.LineBasicMaterial({ color: 0xffdd66 });

// ---- UI ----
const hud = document.getElementById("hud");
const msg = document.getElementById("msg");
const cross = document.getElementById("cross");
const hint = document.getElementById("hint");
const board = document.getElementById("board");
const killfeed = document.getElementById("killfeed");
const labels = document.getElementById("labels");
const fpsEl = document.getElementById("fps");
const netEl = document.getElementById("net");
const panel = document.getElementById("settings");
const stick = document.getElementById("stick");
const knob = document.getElementById("knob");
const fireBtn = document.getElementById("fire");
const reloadBtn = document.getElementById("reload");
const swapBtn = document.getElementById("swap");
const jumpBtn = document.getElementById("jump");
const gearBtn = document.getElementById("gear");
fpsEl.style.display = settings.showFps ? "block" : "none";

let hudText = "";
function setHud(text) {
  if (text === hudText) return;
  hudText = text;
  hud.innerHTML = text;
}

function flashMsg(text, ms = 1200) {
  msg.textContent = text;
  msg.style.opacity = 1;
  clearTimeout(flashMsg.t);
  flashMsg.t = setTimeout(() => (msg.style.opacity = 0), ms);
}
const announce = (text) => flashMsg(text, 1500);

// 名前表示：管理者には虹色の [Admin] を名前の左に付ける
const nameHtml = (info) =>
  (info.a ? '<span class="admin">[Admin]</span> ' : "") + `<span>${esc(info.n)}</span>`;

function addKill({ k, v, w, h }) {
  const el = document.createElement("div");
  el.innerHTML = `${nameHtml(k)} ▶ ${nameHtml(v)}（${esc(w)}${h ? " / ヘッド" : ""}）`;
  killfeed.prepend(el);
  while (killfeed.children.length > KILLFEED_MAX) killfeed.lastChild.remove();
  setTimeout(() => el.remove(), KILLFEED_MS);
}

function renderHud() {
  if (!self) return;
  const w = WEAPONS[WEAPON_ORDER[self.w]];
  const ammo = w.melee ? "" : `<br>${self.rl ? "リロード中…" : `${self.a} / ${w.mag}`}`;
  setHud(
    `体力：${self.alive ? self.hp : 0}<br>` +
    `${w.label}${ammo}<br>` +
    `キル：${self.kills}　デス：${self.deaths}`
  );
}

function renderBoard() {
  const rows = Object.entries(lastState)
    .sort((a, b) => b[1].kills - a[1].kills || a[1].deaths - b[1].deaths)
    .map(([id, p]) => {
      const info = roster[id] ?? { n: "?", a: false };
      return `<tr class="${id === socket.id ? "me" : ""}"><td>${nameHtml(info)}</td>` +
        `<td>${p.kills}</td><td>${p.deaths}</td></tr>`;
    })
    .join("");
  board.innerHTML =
    `<div class="title">${esc(currentMap.name)}</div>` +
    `<table><tr><th>名前</th><th>キル</th><th>デス</th></tr>${rows}</table>`;
}

// 効果音は audio.js

// ---- 入力 ----
const keys = {};
const touch = { x: 0, z: 0, jump: false };
let yaw = 0;
let pitch = 0;
let lastShot = 0;
let lastSent = { x: NaN, z: NaN, j: false, yaw: NaN };
let fireHeld = false;
let leapPending = false;   // 次の物理ステップでリープを予測する
let vote = null;           // 進行中の投票キック
let mouseHeld = false;
let paused = false;   // 設定画面を開いている間は操作を止める

function currentInput() {
  if (paused) return { x: 0, z: 0, j: false };
  const kx = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const kz = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  return {
    x: clamp(kx + touch.x, -1, 1),
    z: clamp(kz + touch.z, -1, 1),
    j: !!keys.Space || touch.jump,
  };
}

// ---- ネットワーク ----
// ブラウザごとの識別子（処分の単位）。無ければ作って保存する
function clientId() {
  let id = null;
  try { id = localStorage.getItem("clanker-cid"); } catch { /* 保存できない環境 */ }
  if (!id || !/^[A-Za-z0-9_-]{16,64}$/.test(id)) {
    const b = crypto.getRandomValues(new Uint8Array(18));
    id = btoa(String.fromCharCode(...b)).replace(/[+/=]/g, (c) => ({ "+": "-", "/": "_", "=": "" }[c]));
    try { localStorage.setItem("clanker-cid", id); } catch { /* 保存できなくても動く */ }
  }
  return id;
}
const socket = io(SERVER_URL, { reconnectionDelayMax: 5000, auth: { clientId: clientId() } });
const remotes = new Map();   // id -> { mesh, el, tx, ty, tz, tyaw }
let self = null;
let pred = newPhys();        // 予測した自分の物理状態
let prevPos = null;
let reconciled = false;
let acc = 0;
let lastState = {};
let roster = {};
let wasReloading = false;
let stepDist = 0;

function sendJoin() {
  socket.emit("join", { name: settings.name, key: settings.adminKey, skins: settings.skins });
}

function refreshLabel(id, r) {
  r.el.innerHTML = nameHtml(roster[id] ?? { n: "…", a: false });
}

function ensureRemote(id, p) {
  let r = remotes.get(id);
  if (!r) {
    const mesh = makeRobot();
    mesh.position.set(p.x, p.y, p.z);
    scene.add(mesh);
    const el = document.createElement("div");
    el.className = "tag";
    labels.appendChild(el);
    r = { mesh, el, tx: p.x, ty: p.y, tz: p.z, tyaw: p.yaw };
    remotes.set(id, r);
    refreshLabel(id, r);
  }
  return r;
}

// 他のプレイヤーの武器（相手のスキンが見える）
function syncRemoteGun(r, id, p) {
  const wk = WEAPON_ORDER[p.w] ?? "pistol";
  const sk = roster[id]?.s?.[wk] ?? "std";
  const key = `${wk}:${sk}`;
  if (r.gunKey === key) return;
  r.gunKey = key;
  if (r.gun) {
    r.mesh.remove(r.gun);
    disposeViewModel(r.gun);
  }
  r.gun = buildViewModel(wk, sk);
  r.gun.position.set(0.45, 1.05, -0.35);
  r.mesh.add(r.gun);
}

function disposeRemote(r) {
  if (r.gun) disposeViewModel(r.gun);
  scene.remove(r.mesh);
  r.el.remove();
}

function clearRemotes() {
  for (const r of remotes.values()) {
    disposeRemote(r);
  }
  remotes.clear();
}

socket.on("connect", () => {
  sendJoin();
  flashMsg("接続しました", 800);
});
socket.on("connect_error", (e) => {
  const text = e.message === "banned" ? "アクセスが制限されています"
    : e.message === "full" ? "満員です"
    : e.message === "too many connections" ? "接続数が多すぎます"
    : "サーバーに接続できません";
  flashMsg(text, 4000);
});
socket.on("disconnect", () => {
  clearRemotes();
  self = null;
  reconciled = false;
  flashMsg("切断されました。再接続中…", 3000);
});
socket.on("full", () => flashMsg("満員です。しばらく待ってください", 5000));
socket.on("map", ({ i }) => {
  buildMap(i);
  reconciled = false;
});
socket.on("announce", ({ text }) => {
  flashMsg(`📢 ${text}`, 4000);
  sfxAnnounce();
});
socket.on("roster", (r) => {
  roster = r;
  adminBtn.style.display = roster[socket.id]?.a ? "flex" : "none";
  for (const [id, rem] of remotes) refreshLabel(id, rem);
  if (board.style.display === "block") renderBoard();
});
// ---- 投票キック ----
const voteEl = document.getElementById("vote");
const votePanel = document.getElementById("votepanel");
const voteList = document.getElementById("vote-list");
const voteBtn = document.getElementById("vote-btn");
const leapBtn = document.getElementById("leap-btn");

function doLeap() {
  if (paused || !self || !self.alive) return;
  socket.emit("leap");
  leapPending = true;
}

function startVote(id) {
  socket.emit("vote:start", { id });
  closeVote();
}

function openVote() {
  if (paused) return;
  const others = Object.keys(lastState).filter((id) => id !== socket.id && !roster[id]?.a);
  if (!others.length) return flashMsg("投票できる相手がいません", 1200);
  voteList.innerHTML = others
    .map((id) => `<button data-id="${esc(id)}">${esc(roster[id]?.n ?? "?")}</button>`)
    .join("");
  paused = true;
  votePanel.style.display = "block";
  if (document.pointerLockElement) document.exitPointerLock();
}

function closeVote() {
  if (votePanel.style.display !== "block") return;
  paused = false;
  votePanel.style.display = "none";
}

voteList.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-id]");
  if (b) startVote(b.dataset.id);
});
document.getElementById("vote-close").addEventListener("click", closeVote);
voteBtn.addEventListener("click", () => (votePanel.style.display === "block" ? closeVote() : openVote()));

socket.on("vote", (v) => {
  vote = v;
  if (!v) {
    voteEl.style.display = "none";
    return;
  }
  const isTarget = v.targetId === socket.id;
  // 表示はすべて textContent で作る（名前に変な文字が入っても安全）
  voteEl.replaceChildren();
  const label = document.createElement("span");
  if (isTarget) {
    label.textContent = `あなたへの投票キックが開始されました（賛成 ${v.yes}/${v.need}）`;
  } else {
    const name = document.createElement("b");
    name.className = "vname";
    name.textContent = v.name;
    label.append("投票キック：", name, `　賛成 ${v.yes}/${v.need}`);
    if (!isTouch) label.append("　[Y] 賛成　[N] 反対");
  }
  voteEl.appendChild(label);
  // スマホにはキーボードが無いので、賛成・反対のボタンを出す
  if (isTouch && !isTarget) {
    for (const [yes, text] of [[true, "賛成"], [false, "反対"]]) {
      const b = document.createElement("button");
      b.textContent = text;
      b.dataset.v = yes ? "1" : "0";
      voteEl.appendChild(b);
    }
  }
  voteEl.style.display = "flex";
});
voteEl.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-v]");
  if (b && vote) socket.emit("vote:cast", { yes: b.dataset.v === "1" });
});

socket.on("kill", (d) => {
  addKill(d);
  if (d.ki === socket.id) sfxKill();
});
socket.on("streak", ({ n }) => {
  announce(`${n}連続キル！`);
  sfxStreak();
});

socket.on("hitmark", ({ head } = {}) => {
  cross.classList.add("hit");
  setTimeout(() => cross.classList.remove("hit"), 150);
  if (head) {
    flashMsg("ヘッドショット！", 500);
    sfxHead();
  } else {
    sfxHit();
  }
});
socket.on("died", () => {
  flashMsg("撃破された！ 3秒後に復活", 2000);
  sfxDeath();
});

socket.on("state", (state) => {
  lastState = state;

  for (const [id, p] of Object.entries(state)) {
    if (id === socket.id) continue;
    const r = ensureRemote(id, p);
    r.tx = p.x;
    r.ty = p.y;
    r.tz = p.z;
    r.tyaw = p.yaw;
    r.mesh.visible = p.alive;
    syncRemoteGun(r, id, p);
  }
  for (const [id, r] of remotes) {
    if (!state[id]) {
      disposeRemote(r);
      remotes.delete(id);
    }
  }

  self = state[socket.id] ?? null;
  if (self) {
    if (self.rl !== wasReloading) {
      if (self.rl) sfxReloadStart();
      else sfxReloadDone();
      wasReloading = self.rl;
    }
    renderHud();
    refreshViewModel(self.w);
    // 予測と大きくずれたらサーバーの値へ補正（リスポーン・衝突の不一致など）
    const far =
      Math.hypot(pred.x - self.x, pred.z - self.z) > SNAP_XZ ||
      Math.abs(pred.y - self.y) > SNAP_Y;
    if (!reconciled || far) {
      pred = newPhys(self.x, self.z);
      pred.y = self.y;
      pred.vx = self.vx;
      pred.vy = self.vy;
      pred.vz = self.vz;
      pred.g = self.g;
      pred.lc = self.lc ?? 0;
      prevPos = { x: pred.x, y: pred.y, z: pred.z };
      reconciled = true;
      acc = 0;
    }
  } else {
    reconciled = false;
  }
  if (board.style.display === "block") renderBoard();
});

// 入力を変化時のみ送信（通信量削減）
setInterval(() => {
  const { x, z, j } = currentInput();
  if (x === lastSent.x && z === lastSent.z && j === lastSent.j && Math.abs(yaw - lastSent.yaw) < 0.001) return;
  lastSent = { x, z, j, yaw };
  socket.emit("input", { x, z, j, yaw });
}, INPUT_SEND_MS);

// 通信遅延の計測
setInterval(() => {
  const t = performance.now();
  socket.emit("png", () => {
    netEl.textContent = `遅延 ${Math.round(performance.now() - t)} ms`;
  });
}, 2000);

// ---- 射撃・リロード・武器切替 ----
function shoot() {
  if (paused || !self || !self.alive || self.rl) return;
  const w = WEAPONS[WEAPON_ORDER[self.w]];
  const now = performance.now();
  if (now - lastShot < w.cooldown) return;
  if (!w.melee && self.a <= 0) {
    socket.emit("reload");
    return;
  }
  lastShot = now;
  socket.emit("shoot", { yaw, pitch });
  sfxShot(w.sound);
  if (w.melee) {
    swing = 1;
  } else {
    recoil = 1;
    drawTracer();
    flashMuzzle();
  }
}

const switchWeapon = (i) => socket.emit("switch", { i });
const reload = () => socket.emit("reload");

setInterval(() => {
  if (!self) return;
  if ((fireHeld || mouseHeld) && WEAPONS[WEAPON_ORDER[self.w]].auto) shoot();
}, AUTO_FIRE_MS);

// マズルフラッシュ（発砲時だけ一瞬表示）
function flashMuzzle() {
  const f = vm?.getObjectByName("flash");
  if (!f) return;
  f.visible = true;
  clearTimeout(flashMuzzle.t);
  flashMuzzle.t = setTimeout(() => (f.visible = false), 50);
}

const tracerDir = new THREE.Vector3();
function drawTracer() {
  camera.getWorldDirection(tracerDir);
  const from = camera.position.clone().addScaledVector(tracerDir, 0.5);
  const to = camera.position.clone().addScaledVector(tracerDir, 60);
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, tracerMat);
  scene.add(line);
  setTimeout(() => {
    scene.remove(line);
    geo.dispose();
  }, 80);
}

// ---- 設定画面 ----
function openSettings() {
  paused = true;
  panel.style.display = "block";
  if (document.pointerLockElement) document.exitPointerLock();
}
function closeSettings() {
  paused = false;
  panel.style.display = "none";
}
document.getElementById("set-close").addEventListener("click", closeSettings);
gearBtn.addEventListener("click", openSettings);

setSkinPreview(skinPreview);
const settingsUI = bindSettings(settings, (s, patch) => {
  if ("fov" in patch) {
    camera.fov = s.fov;
    camera.updateProjectionMatrix();
  }
  if ("volume" in patch) setMasterVolume(s.volume);
  if ("showFps" in patch) fpsEl.style.display = s.showFps ? "block" : "none";
  if ("name" in patch || "adminKey" in patch || "skins" in patch) sendJoin();
  if ("knifeModel" in patch) vmKey = "";
  if ("skins" in patch) {
    vmKey = "";
    if (self) refreshViewModel(self.w);
  }
});
settingsUI.syncFields();

// 管理者パネルは admin.js
const adminBtn = document.getElementById("admin-btn");
initAdmin({
  socket,
  getRoster: () => roster,
  getLastState: () => lastState,
  setPaused: (v) => { paused = v; },
  nameHtml,
  esc,
  MAPS,
});

// ---- キーボード・マウス ----
addEventListener("keydown", (e) => {
  const tag = e.target?.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return; // 入力中はゲーム操作しない
  if (e.code === "Space") e.preventDefault();
  if (e.repeat && e.code !== "Space") return;
  keys[e.code] = true;
  if (e.code === "KeyO") {
    paused ? closeSettings() : openSettings();
    return;
  }
  if (e.code === "KeyV") {
    votePanel.style.display === "block" ? closeVote() : openVote();
    return;
  }
  if ((e.code === "KeyY" || e.code === "KeyN") && vote && vote.targetId !== socket.id) {
    socket.emit("vote:cast", { yes: e.code === "KeyY" });
    return;
  }
  if (e.code === "KeyP") {
    isAdminOpen() ? closeAdminPanel() : openAdminPanel();
    return;
  }
  if (paused) return;
  if (e.code === "Tab") {
    e.preventDefault();
    board.style.display = "block";
    renderBoard();
  }
  if (e.code === "KeyR") reload();
  if (e.code === "KeyQ" || e.code === "KeyE") {
    if (self) switchWeapon((self.w + (e.code === "KeyE" ? 1 : WEAPON_ORDER.length - 1)) % WEAPON_ORDER.length);
    return;
  }
  const m = /^Digit([1-9])$/.exec(e.code);
  if (m && Number(m[1]) <= WEAPON_ORDER.length) switchWeapon(Number(m[1]) - 1);
});
addEventListener("keyup", (e) => {
  keys[e.code] = false;
  if (e.code === "Tab") board.style.display = "none";
});
// フォーカスが外れたら押しっぱなしを解除（バグ防止）
addEventListener("blur", () => {
  for (const k in keys) keys[k] = false;
  fireHeld = false;
  mouseHeld = false;
  board.style.display = "none";
});

// マウスホイールで武器切替（購入・ポーズ中は無効）
addEventListener("wheel", (e) => {
  if (paused || !self) return;
  switchWeapon((self.w + (e.deltaY > 0 ? 1 : WEAPON_ORDER.length - 1)) % WEAPON_ORDER.length);
}, { passive: true });

const canvas = renderer.domElement;
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("mousedown", (e) => {
  if (e.button === 2 && !isTouch) doLeap();
});
canvas.addEventListener("mousedown", (e) => {
  if (isTouch || e.button !== 0 || paused) return;
  if (document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
    return;
  }
  mouseHeld = true;
  shoot();
});
addEventListener("mouseup", (e) => {
  if (e.button === 0) mouseHeld = false;
});
document.addEventListener("pointerlockchange", () => {
  hint.style.display = document.pointerLockElement === canvas ? "none" : "block";
});
document.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement !== canvas || paused) return;
  yaw -= e.movementX * MOUSE_BASE * settings.sens;
  pitch = clamp(pitch - e.movementY * MOUSE_BASE * settings.sens, -1.4, 1.4);
});

// ---- タッチ ----
let stickId = null;
let lookId = null;
let fireId = null;
let jumpId = null;
let lastLook = { x: 0, y: 0 };

function updateStick(t) {
  const r = stick.getBoundingClientRect();
  let dx = t.clientX - (r.left + r.width / 2);
  let dy = t.clientY - (r.top + r.height / 2);
  const d = Math.hypot(dx, dy);
  if (d > STICK_R) {
    dx = (dx / d) * STICK_R;
    dy = (dy / d) * STICK_R;
  }
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  touch.x = dx / STICK_R;
  touch.z = -dy / STICK_R;
}

// アプリを切り替えた・画面を閉じた時は、操作の押しっぱなしを解除する（スマホで勝手に動き続けるのを防ぐ）
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) return;
  for (const k in keys) keys[k] = false;
  fireHeld = false;
  mouseHeld = false;
  touch.jump = false;
  touch.x = 0;
  touch.z = 0;
  stickId = lookId = fireId = jumpId = null;
  knob.style.transform = "";
});

function resetStick() {
  touch.x = 0;
  touch.z = 0;
  knob.style.transform = "";
}

addEventListener("touchstart", (e) => {
  if (paused || gearBtn.contains(e.target) || adminBtn.contains(e.target) || voteEl.contains(e.target)) return;
  e.preventDefault();
  for (const t of e.changedTouches) {
    const el = t.target;
    if (fireBtn.contains(el)) {
      fireId = t.identifier;
      fireHeld = true;
      shoot();
    } else if (jumpBtn.contains(el)) {
      jumpId = t.identifier;
      touch.jump = true;
    } else if (reloadBtn.contains(el)) {
      reload();
    } else if (swapBtn.contains(el)) {
      if (self) switchWeapon((self.w + 1) % WEAPON_ORDER.length);
    } else if (leapBtn.contains(el)) {
      doLeap();
    } else if (voteBtn.contains(el)) {
      openVote();
    } else if (stick.contains(el)) {
      stickId = t.identifier;
      updateStick(t);
    } else if (lookId === null) {
      lookId = t.identifier;
      lastLook = { x: t.clientX, y: t.clientY };
    }
  }
}, { passive: false });

addEventListener("touchmove", (e) => {
  if (paused) return;
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === stickId) {
      updateStick(t);
    } else if (t.identifier === lookId) {
      const k = TOUCH_BASE * settings.touchSens;
      yaw -= (t.clientX - lastLook.x) * k;
      pitch = clamp(pitch - (t.clientY - lastLook.y) * k, -1.4, 1.4);
      lastLook = { x: t.clientX, y: t.clientY };
    }
  }
}, { passive: false });

function endTouch(e) {
  for (const t of e.changedTouches) {
    if (t.identifier === stickId) {
      stickId = null;
      resetStick();
    }
    if (t.identifier === lookId) lookId = null;
    if (t.identifier === fireId) {
      fireId = null;
      fireHeld = false;
    }
    if (t.identifier === jumpId) {
      jumpId = null;
      touch.jump = false;
    }
  }
}
addEventListener("touchend", endTouch);
addEventListener("touchcancel", endTouch);

// ---- 描画ループ ----
const tmp = new THREE.Vector3();
let lastFrame = performance.now();
let fpsFrames = 0;
let fpsT = performance.now();

renderer.setAnimationLoop(() => {
  const now = performance.now();
  const dt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;

  // FPS表示（0.5秒ごと）
  fpsFrames++;
  if (now - fpsT >= 500) {
    const fps = Math.round((fpsFrames * 1000) / (now - fpsT));
    fpsEl.textContent = `フレーム ${fps}`;
    // 重いとき（40未満）は描画の解像度を段階的に下げる（PC・スマホどちらも軽くなる）
    if (fps < 40 && pixelScale > 1) {
      pixelScale = Math.max(1, pixelScale - 0.25);
      renderer.setPixelRatio(pixelScale);
    }
    fpsFrames = 0;
    fpsT = now;
  }

  // 自分：固定刻み（サーバーと同じ TICK）で予測し、描画は補間して滑らかに
  if (reconciled && self && self.alive) {
    acc += dt;
    let steps = 0;
    while (acc >= TICK && steps < MAX_STEPS) {
      prevPos = { x: pred.x, y: pred.y, z: pred.z };
      stepMove(pred, { ...currentInput(), l: leapPending }, yaw, TICK, currentMap);
      leapPending = false;
      acc -= TICK;
      steps++;
    }
    if (steps >= MAX_STEPS) acc = 0;
    const a = acc / TICK;
    const moveIn = currentInput();
    if (pred.g && (moveIn.x || moveIn.z)) {
      stepDist += Math.hypot(pred.x - (prevPos?.x ?? pred.x), pred.z - (prevPos?.z ?? pred.z));
      if (stepDist > 2.2) {
        stepDist = 0;
        sfxClick(0.04);
      }
    }
    const p0 = prevPos ?? pred;
    camera.position.set(
      p0.x + (pred.x - p0.x) * a,
      p0.y + (pred.y - p0.y) * a + EYE_H,
      p0.z + (pred.z - p0.z) * a
    );
  }
  camera.rotation.set(pitch, yaw, 0);

  // 武器のリコイル・近接の振り
  if (recoil > 0) recoil = Math.max(0, recoil - dt * 10);
  const sway = now * 0.001;
  tickSkins(sway);
  vmRoot.position.set(
    0.3 + Math.cos(sway * 1.3) * 0.003,
    -0.27 + recoil * 0.02 + Math.sin(sway * 2.1) * 0.004,
    -0.55 + recoil * 0.06
  );
  if (swing > 0) swing = Math.max(0, swing - dt * 4);
  if (vm) vm.rotation.x = -Math.sin(swing * Math.PI) * 0.9;

  // 他プレイヤー：補間
  for (const r of remotes.values()) {
    r.mesh.position.x += (r.tx - r.mesh.position.x) * REMOTE_LERP;
    r.mesh.position.y += (r.ty - r.mesh.position.y) * REMOTE_LERP;
    r.mesh.position.z += (r.tz - r.mesh.position.z) * REMOTE_LERP;
    r.mesh.rotation.y = r.tyaw;
  }

  renderer.render(scene, camera);

  // 名前ラベルを画面座標に追従
  for (const [, r] of remotes) {
    if (!r.mesh.visible) {
      r.el.style.display = "none";
      continue;
    }
    tmp.set(r.mesh.position.x, r.mesh.position.y + 2.4, r.mesh.position.z).project(camera);
    if (tmp.z > 1 || Math.abs(tmp.x) > 1.1 || Math.abs(tmp.y) > 1.1) {
      r.el.style.display = "none";
      continue;
    }
    const x = (tmp.x * 0.5 + 0.5) * innerWidth;
    const y = (-tmp.y * 0.5 + 0.5) * innerHeight;
    r.el.style.display = "block";
    r.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  }
});
