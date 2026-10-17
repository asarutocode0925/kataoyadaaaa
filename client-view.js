import * as THREE from "three";
import { SKINS } from "./shared-game.js";

// 武器の部品定義（構造データ）
// s：形（box / cyl）、sz：寸法、p：位置、r：素材の役割
// 役割：body＝スキン、wood＝木、rubber＝ゴム、metal＝ガンメタル、accent＝アクセント色、gold＝金具
// cyl は z 軸方向に伸びる円柱（銃身・スコープなど）
const WEAPON_MODELS = {
  pistol: [
    { s: "box", sz: [0.085, 0.11, 0.3], p: [0, 0.01, -0.1], r: "body" },           // スライド
    { s: "box", sz: [0.075, 0.17, 0.085], p: [0, -0.13, 0.01], r: "rubber" },      // グリップ
    { s: "box", sz: [0.08, 0.03, 0.12], p: [0, -0.05, 0.05], r: "metal" },         // フレーム
    { s: "box", sz: [0.03, 0.02, 0.04], p: [0, 0.075, -0.24], r: "accent" },       // 前照星
    { s: "box", sz: [0.02, 0.04, 0.03], p: [0, 0.08, 0.02], r: "metal" },          // 後照星
    { s: "box", sz: [0.02, 0.05, 0.03], p: [0, -0.01, 0.12], r: "metal" },         // ハンマー
  ],
  magnum: [
    { s: "cyl", rad: 0.055, len: 0.28, p: [0, 0.02, -0.2], r: "body" },            // シリンダー
    { s: "cyl", rad: 0.026, len: 0.22, p: [0, 0.03, -0.44], r: "metal" },          // 銃身
    { s: "box", sz: [0.085, 0.07, 0.12], p: [0, -0.02, 0.0], r: "metal" },         // フレーム
    { s: "box", sz: [0.075, 0.18, 0.085], p: [0, -0.14, 0.02], r: "wood" },        // 木のグリップ
    { s: "box", sz: [0.03, 0.03, 0.03], p: [0, 0.1, -0.12], r: "accent" },         // 照星
    { s: "box", sz: [0.04, 0.02, 0.06], p: [0, 0.06, 0.07], r: "metal" },          // ハンマー
  ],
  smg: [
    { s: "box", sz: [0.1, 0.13, 0.46], p: [0, 0, -0.2], r: "body" },              // レシーバー
    { s: "box", sz: [0.11, 0.035, 0.36], p: [0, 0.075, -0.25], r: "metal" },       // レール
    { s: "box", sz: [0.05, 0.24, 0.07], p: [0, -0.18, -0.12], r: "rubber" },       // マガジン
    { s: "box", sz: [0.07, 0.11, 0.22], p: [0, -0.02, 0.22], r: "rubber" },        // ストック
    { s: "cyl", rad: 0.022, len: 0.16, p: [0, 0.02, -0.5], r: "metal" },           // 銃口
    { s: "box", sz: [0.04, 0.12, 0.06], p: [0, -0.12, -0.38], r: "rubber" },       // フォアグリップ
    { s: "box", sz: [0.03, 0.04, 0.04], p: [0, 0.1, -0.02], r: "accent" },         // ドットサイト
  ],
  rifle: [
    { s: "box", sz: [0.1, 0.14, 0.62], p: [0, 0, -0.2], r: "body" },              // レシーバー
    { s: "box", sz: [0.11, 0.035, 0.5], p: [0, 0.085, -0.2], r: "metal" },         // レール
    { s: "box", sz: [0.06, 0.2, 0.1], p: [0, -0.16, -0.14], r: "rubber" },         // マガジン
    { s: "box", sz: [0.08, 0.12, 0.28], p: [0, -0.02, 0.24], r: "wood" },          // 木のストック
    { s: "box", sz: [0.06, 0.07, 0.14], p: [0, 0.14, -0.1], r: "accent" },         // スコープ
    { s: "cyl", rad: 0.024, len: 0.34, p: [0, 0.02, -0.6], r: "metal" },           // 銃身
    { s: "box", sz: [0.07, 0.1, 0.22], p: [0, -0.1, -0.44], r: "wood" },           // ハンドガード
  ],
  sniper: [
    { s: "box", sz: [0.08, 0.14, 1.0], p: [0, 0, -0.3], r: "body" },              // レシーバー
    { s: "cyl", rad: 0.036, len: 0.34, p: [0, 0.12, -0.24], r: "accent" },         // スコープ
    { s: "box", sz: [0.085, 0.16, 0.34], p: [0, -0.02, 0.32], r: "wood" },         // 木のストック
    { s: "box", sz: [0.05, 0.16, 0.07], p: [0, -0.14, -0.2], r: "rubber" },        // マガジン
    { s: "cyl", rad: 0.02, len: 0.32, p: [0, 0.02, -0.82], r: "metal" },           // 銃身
    { s: "box", sz: [0.03, 0.1, 0.03], p: [0.05, -0.12, -0.5], r: "metal" },       // バイポッド脚
    { s: "box", sz: [0.03, 0.1, 0.03], p: [-0.05, -0.12, -0.5], r: "metal" },
  ],
  shotgun: [
    { s: "box", sz: [0.13, 0.16, 0.9], p: [0, 0, -0.25], r: "body" },             // レシーバー
    { s: "box", sz: [0.12, 0.1, 0.3], p: [0, -0.07, -0.46], r: "wood" },           // 木のポンプ
    { s: "box", sz: [0.1, 0.16, 0.36], p: [0, -0.02, 0.34], r: "wood" },           // 木のストック
    { s: "cyl", rad: 0.03, len: 0.52, p: [0, 0.03, -0.52], r: "metal" },           // 銃身
    { s: "cyl", rad: 0.036, len: 0.1, p: [0, 0.03, -0.92], r: "accent" },          // チョーク
    { s: "box", sz: [0.04, 0.05, 0.08], p: [0, -0.1, -0.1], r: "metal" },          // トリガー周り
  ],
  hinawaju: [
    { s: "box", sz: [0.08, 0.12, 0.6], p: [0, 0, -0.1], r: "wood" },              // 木の銃床
    { s: "cyl", rad: 0.022, len: 0.7, p: [0, 0.04, -0.55], r: "metal" },           // 長い銃身
    { s: "box", sz: [0.09, 0.14, 0.3], p: [0, -0.02, 0.25], r: "wood" },          // ストック
    { s: "box", sz: [0.03, 0.08, 0.03], p: [0.05, 0.02, -0.2], r: "accent" },     // 火ばさみ
    { s: "box", sz: [0.05, 0.03, 0.05], p: [0, -0.09, -0.18], r: "gold" },        // 金具
  ],
  tanzutsu: [
    { s: "box", sz: [0.08, 0.1, 0.22], p: [0, 0, -0.1], r: "body" },              // フレーム
    { s: "cyl", rad: 0.02, len: 0.16, p: [-0.02, 0.02, -0.26], r: "metal" },       // 銃身1
    { s: "cyl", rad: 0.02, len: 0.16, p: [0.02, 0.02, -0.26], r: "metal" },        // 銃身2
    { s: "box", sz: [0.06, 0.14, 0.07], p: [0, -0.11, 0.02], r: "wood" },          // 木のグリップ
    { s: "box", sz: [0.04, 0.02, 0.04], p: [0, 0.07, -0.04], r: "accent" },        // 照星
  ],
  lmg: [
    { s: "box", sz: [0.13, 0.16, 0.7], p: [0, 0, -0.2], r: "body" },              // レシーバー
    { s: "box", sz: [0.1, 0.12, 0.14], p: [0, -0.12, -0.1], r: "rubber" },        // ボックスマガジン
    { s: "cyl", rad: 0.03, len: 0.4, p: [0, 0.03, -0.6], r: "metal" },            // 銃身
    { s: "box", sz: [0.02, 0.1, 0.02], p: [0.05, -0.14, -0.5], r: "metal" },      // バイポッド
    { s: "box", sz: [0.02, 0.1, 0.02], p: [-0.05, -0.14, -0.5], r: "metal" },
    { s: "box", sz: [0.08, 0.12, 0.25], p: [0, -0.02, 0.25], r: "rubber" },       // ストック
    { s: "box", sz: [0.12, 0.05, 0.05], p: [0, 0.1, -0.2], r: "accent" },         // 冷却カバー
  ],
};

const ROLE_COLOR = { rubber: 0x1b1b1f, wood: 0x6b4526, metal: 0x3a3f48, accent: 0xb3261e, gold: 0xc9a227, grip: 0x1b1b1f };

const roleMats = new Map();
function roleMaterial(role) {
  if (!roleMats.has(role)) {
    roleMats.set(role, new THREE.MeshStandardMaterial({
      color: ROLE_COLOR[role] ?? 0xffffff,
      metalness: role === "metal" || role === "gold" ? 0.8 : 0.1,
      roughness: role === "metal" ? 0.35 : role === "wood" ? 0.8 : role === "gold" ? 0.25 : 0.7,
    }));
  }
  return roleMats.get(role);
}

// ---------- スキンのテクスチャ生成 ----------
const S = 256;
const rnd = (a, b) => a + Math.random() * (b - a);
const hex = (c) => "#" + c.toString(16).padStart(6, "0");

function paintPattern(g, key, base) {
  g.fillStyle = hex(base);
  g.fillRect(0, 0, S, S);

  switch (key) {
    case "gold": {
      const gr = g.createLinearGradient(0, 0, S, S);
      gr.addColorStop(0, "#fff3b0");
      gr.addColorStop(0.5, "#b8861b");
      gr.addColorStop(1, "#fff3b0");
      g.fillStyle = gr;
      g.fillRect(0, 0, S, S);
      g.strokeStyle = "rgba(90,60,10,.35)";
      g.lineWidth = 2;
      for (let i = -S; i < S * 2; i += 28) {
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.stroke();
      }
      break;
    }
    case "sakura": {
      for (let i = 0; i < 26; i++) {
        g.save();
        g.translate(rnd(0, S), rnd(0, S));
        g.rotate(rnd(0, 6.28));
        g.fillStyle = Math.random() < 0.5 ? "#ffffff" : "#f7a1b5";
        for (let k = 0; k < 5; k++) {
          g.rotate((Math.PI * 2) / 5);
          g.beginPath(); g.ellipse(0, 9, 5, 9, 0, 0, 6.28); g.fill();
        }
        g.restore();
      }
      break;
    }
    case "indigo": {
      g.strokeStyle = "rgba(230,240,255,.55)";
      g.lineWidth = 3;
      for (let i = 0; i < S; i += 24) {
        g.beginPath(); g.moveTo(0, i); g.lineTo(S, i + 12); g.stroke();
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 12, S); g.stroke();
      }
      break;
    }
    case "shu": {
      const gr = g.createRadialGradient(S * 0.3, S * 0.3, 10, S / 2, S / 2, S);
      gr.addColorStop(0, "rgba(255,120,100,.5)");
      gr.addColorStop(1, "rgba(60,0,0,.5)");
      g.fillStyle = gr;
      g.fillRect(0, 0, S, S);
      break;
    }
    case "camo": {
      const cols = ["#3b4a2a", "#7a6a3e", "#2b3520", "#5b5034"];
      for (let i = 0; i < 90; i++) {
        g.fillStyle = cols[i % cols.length];
        g.beginPath();
        g.ellipse(rnd(0, S), rnd(0, S), rnd(10, 26), rnd(8, 20), rnd(0, 3), 0, 6.28);
        g.fill();
      }
      break;
    }
    case "neon": {
      g.strokeStyle = "#00e5ff";
      g.lineWidth = 3;
      for (let i = 0; i < S; i += 32) {
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.stroke();
        g.beginPath(); g.moveTo(0, i); g.lineTo(S, i); g.stroke();
      }
      break;
    }
    case "oni": {
      g.fillStyle = "rgba(0,0,0,.5)";
      for (let i = 0; i < S; i += 32) g.fillRect(i, 0, 14, S);
      g.strokeStyle = "#ff5a1f";
      g.lineWidth = 4;
      g.beginPath(); g.arc(S * 0.5, S * 0.5, 60, 0, 6.28); g.stroke();
      break;
    }
    case "scales": {
      const r = 22;
      for (let y = 0; y < S + r; y += r) {
        for (let x = -r; x < S + r; x += r * 2) {
          const off = (Math.round(y / r) % 2) * r;
          g.fillStyle = "rgba(20,60,50,.6)";
          g.beginPath(); g.arc(x + off, y, r, 0, Math.PI); g.fill();
          g.strokeStyle = "rgba(180,230,200,.35)";
          g.lineWidth = 2;
          g.stroke();
        }
      }
      break;
    }
    case "waves": {
      g.strokeStyle = "rgba(255,255,255,.75)";
      g.lineWidth = 4;
      for (let y = 0; y < S + 40; y += 40) {
        for (let x = 0; x < S + 40; x += 40) {
          for (let r = 10; r <= 30; r += 10) {
            g.beginPath(); g.arc(x, y, r, Math.PI, 0); g.stroke();
          }
        }
      }
      break;
    }
    case "rust": {
      for (let i = 0; i < 900; i++) {
        g.fillStyle = Math.random() < 0.5 ? "rgba(160,80,30,.6)" : "rgba(40,25,15,.6)";
        g.fillRect(rnd(0, S), rnd(0, S), rnd(1, 4), rnd(1, 4));
      }
      break;
    }
    case "aurora": {
      const gr = g.createLinearGradient(0, 0, S, S);
      gr.addColorStop(0, "#1cf3b5");
      gr.addColorStop(0.5, "#6a4cff");
      gr.addColorStop(1, "#1a8cff");
      g.fillStyle = gr;
      g.fillRect(0, 0, S, S);
      for (let i = 0; i < 40; i++) {
        g.strokeStyle = `rgba(255,255,255,${rnd(0.05, 0.25)})`;
        g.lineWidth = rnd(2, 8);
        g.beginPath();
        const y = rnd(0, S);
        g.moveTo(0, y);
        g.bezierCurveTo(S * 0.3, y - 60, S * 0.6, y + 60, S, y + rnd(-30, 30));
        g.stroke();
      }
      break;
    }
    case "stars": {
      for (let i = 0; i < 120; i++) {
        g.fillStyle = `rgba(255,255,255,${rnd(0.3, 1)})`;
        const r = Math.random() < 0.9 ? rnd(0.5, 1.5) : rnd(2, 3);
        g.beginPath();
        g.arc(rnd(0, S), rnd(0, S), r, 0, 6.28);
        g.fill();
      }
      break;
    }
    case "hanabi": {
      const cols = ["#ff5fa2", "#ffd34e", "#5fd4ff", "#b58cff", "#7dff9b"];
      for (let b = 0; b < 6; b++) {
        const cx = rnd(0, S), cy = rnd(0, S), col = cols[b % cols.length];
        for (let k = 0; k < 14; k++) {
          const a = (k / 14) * 6.28;
          g.strokeStyle = col;
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(cx, cy);
          g.lineTo(cx + Math.cos(a) * 34, cy + Math.sin(a) * 34);
          g.stroke();
        }
      }
      break;
    }
    case "fade": {
      const gr = g.createLinearGradient(0, 0, S, S);
      gr.addColorStop(0, "#ff3fa4");
      gr.addColorStop(0.35, "#ff9a3c");
      gr.addColorStop(0.7, "#7c3aed");
      gr.addColorStop(1, "#1d0b33");
      g.fillStyle = gr;
      g.fillRect(0, 0, S, S);
      for (let i = 0; i < 60; i++) {
        g.fillStyle = `rgba(255,255,255,${rnd(0.04, 0.18)})`;
        g.beginPath();
        g.arc(rnd(0, S), rnd(0, S), rnd(2, 10), 0, 6.28);
        g.fill();
      }
      break;
    }
    case "glitch": {
      const bars = ["#00ffd5", "#ff2a6d", "#05d9e8", "#101018"];
      for (let y = 0; y < S; y += 8) {
        g.fillStyle = bars[(y / 8) % bars.length];
        const off = Math.random() < 0.25 ? rnd(-30, 30) : 0;
        g.fillRect(off, y, S, rnd(2, 6));
      }
      break;
    }
    case "reaver": {
      const gr = g.createRadialGradient(S / 2, S / 2, 20, S / 2, S / 2, S * 0.7);
      gr.addColorStop(0, "rgba(120,40,200,.35)");
      gr.addColorStop(1, "rgba(255,106,31,.55)");
      g.fillStyle = gr;
      g.fillRect(0, 0, S, S);
      g.strokeStyle = "rgba(255,106,31,.8)";
      g.lineWidth = 3;
      g.strokeRect(6, 6, S - 12, S - 12);
      break;
    }
    case "prime": {
      g.strokeStyle = "rgba(201,162,39,.9)";
      g.lineWidth = 10;
      for (let i = -S; i < S * 2; i += 90) {
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i + S, S); g.stroke();
      }
      break;
    }
    case "plain":
      break;
    case "damascus": {
      for (let i = -S; i < S * 2; i += 14) {
        g.strokeStyle = i % 28 === 0 ? "rgba(255,255,255,.7)" : "rgba(40,40,50,.55)";
        g.lineWidth = 4;
        g.beginPath();
        for (let x = 0; x <= S; x += 8) {
          const y = i + x + Math.sin(x * 0.08) * 10;
          x === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
        }
        g.stroke();
      }
      break;
    }
    case "kohaku": {
      const gr = g.createLinearGradient(0, 0, 0, S);
      gr.addColorStop(0, "#ffd08a");
      gr.addColorStop(0.6, "#c2611a");
      gr.addColorStop(1, "#7a2e08");
      g.fillStyle = gr;
      g.fillRect(0, 0, S, S);
      for (let i = 0; i < 25; i++) {
        g.fillStyle = `rgba(255,240,200,${rnd(0.1, 0.4)})`;
        g.beginPath();
        g.arc(rnd(0, S), rnd(0, S), rnd(3, 12), 0, 6.28);
        g.fill();
      }
      break;
    }
    case "kuroGold": {
      g.strokeStyle = "#d4a72c";
      g.lineWidth = 2;
      const h = 24;
      for (let row = 0, y = 0; y < S + h; row++, y += h * 0.75) {
        const ox = (row % 2) * h * 0.75;
        for (let x = -h; x < S + h; x += h * 1.5) {
          g.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = (Math.PI / 3) * k;
            const px = x + ox + Math.cos(a) * h * 0.5;
            const py = y + Math.sin(a) * h * 0.5;
            if (k === 0) g.moveTo(px, py);
            else g.lineTo(px, py);
          }
          g.closePath();
          g.stroke();
        }
      }
      break;
    }
    default:
      break;
  }
}

const texCache = new Map();
const matCache = new Map();

function skinTexture(key) {
  if (texCache.has(key)) return texCache.get(key);
  const s = SKINS[key];
  const c = document.createElement("canvas");
  c.width = c.height = S;
  paintPattern(c.getContext("2d"), s.pattern, s.color);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  texCache.set(key, tex);
  return tex;
}

// 時間で色が移り変わるスキン（ドップラー風）。毎フレーム呼ぶ（数個のマテリアルだけ更新）
const animatedMats = [];
export function tickSkins(t) {
  for (const mat of animatedMats) {
    mat.emissive.setHSL((t * 0.08) % 1, 1, 0.5);
  }
}

// 設定画面のプレビュー用（スキンの模様そのもの）
export function skinPreview(key) {
  return skinTexture(key in SKINS ? key : "std").image;
}

export function skinMaterial(key) {
  if (matCache.has(key)) return matCache.get(key);
  const k = key in SKINS ? key : "std";
  const s = SKINS[k];
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: skinTexture(k),
    metalness: s.metal,
    roughness: s.rough,
    emissive: s.emissive ?? 0x000000,
    emissiveIntensity: s.emissive ? 0.6 : 0,
  });
  if (s.animated) {
    mat.emissiveIntensity = 0.35;
    animatedMats.push(mat);
  }
  matCache.set(key, mat);
  return mat;
}

// ---------- 一人称の武器 ----------
// カランビット：曲がった刃と指輪の持ち手
function karambitGroup(mat) {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(0.14, 0.02, 0.1, 0.22);
  shape.quadraticCurveTo(0.05, 0.13, -0.03, 0.02);
  shape.lineTo(0, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2 });
  const blade = new THREE.Mesh(geo, mat);
  blade.position.set(0, 0, -0.1);
  blade.rotation.set(-Math.PI / 2, 0, -0.35);
  g.add(blade);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.14), mat);
  handle.position.set(0, -0.02, 0.02);
  g.add(handle);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 6, 14), mat);
  ring.position.set(0.03, -0.02, 0.06);
  ring.rotation.set(0, Math.PI / 2, 0);
  g.add(ring);
  return g;
}

// 標準ナイフ：直線の刃（血溝つき）と、金具付きのグリップ
function tantoGroup(mat) {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-0.028, 0);
  shape.lineTo(0.028, 0);
  shape.lineTo(0.028, 0.32);
  shape.lineTo(-0.002, 0.46);
  shape.lineTo(-0.028, 0.4);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2 });
  const blade = new THREE.Mesh(geo, mat);
  blade.rotation.set(-Math.PI / 2, 0, 0);
  blade.position.set(0, 0, -0.12);
  g.add(blade);
  const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.005, 0.26), roleMaterial("metal"));
  fuller.position.set(0, 0.012, -0.36);
  g.add(fuller);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.16, 10), roleMaterial("rubber"));
  grip.rotation.x = Math.PI / 2;
  grip.position.set(0, 0, 0.06);
  g.add(grip);
  for (const z of [-0.0, 0.11]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.012, 10), roleMaterial("gold"));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0, z + 0.0);
    g.add(ring);
  }
  return g;
}

// 部品の大きさに合わせて模様の繰り返し回数を決める（小さい部品に大きく伸びた模様が出ないように）
function fitUV(geo, maxDim) {
  const uv = geo.attributes.uv;
  const f = Math.min(4, Math.max(0.6, 0.35 / Math.max(maxDim, 0.01)));
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * f, uv.getY(i) * f);
  uv.needsUpdate = true;
}

export function buildViewModel(weaponKey, skinKey, knifeModel = "tanto") {
  const g = buildViewModelRaw(weaponKey, skinKey, knifeModel);
  // 画面の右下に収まる大きさ（構造データは実寸のまま）
  g.scale.setScalar(0.55);
  return g;
}

function buildViewModelRaw(weaponKey, skinKey, knifeModel) {
  if (weaponKey === "knife" && knifeModel === "tanto") {
    return tantoGroup(skinMaterial(skinKey));
  }
  if (weaponKey === "knife" && knifeModel === "karambit") {
    return karambitGroup(skinMaterial(skinKey));
  }
  const g = new THREE.Group();
  const skin = skinMaterial(skinKey);
  const parts = WEAPON_MODELS[weaponKey] ?? WEAPON_MODELS.pistol;
  for (const part of parts) {
    const mat = part.r === "body" ? skin : roleMaterial(part.r);
    let geo;
    let maxDim;
    if (part.s === "cyl") {
      geo = new THREE.CylinderGeometry(part.rad, part.rad, part.len, 12);
      geo.rotateX(Math.PI / 2);
      maxDim = Math.max(part.rad * 2, part.len);
    } else {
      geo = new THREE.BoxGeometry(...part.sz);
      maxDim = Math.max(...part.sz);
    }
    fitUV(geo, maxDim);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...part.p);
    g.add(m);
  }
  // 発砲時のマズルフラッシュ（通常は非表示）
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.16),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  flash.position.set(0, 0.02, -0.75);
  flash.visible = false;
  flash.name = "flash";
  g.add(flash);
  return g;
}

export function disposeViewModel(g) {
  g.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
}

// ---------- マップ装飾（当たり判定なし） ----------
const decoMats = new Map();
const decoMat = (color, extra = {}) => {
  const k = `${color}:${JSON.stringify(extra)}`;
  if (!decoMats.has(k)) {
    decoMats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra }));
  }
  return decoMats.get(k);
};

function addMesh(g, geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  g.add(m);
  return m;
}

export function buildDeco(list) {
  const g = new THREE.Group();
  const wood = decoMat(0x4a3320);
  const stone = decoMat(0x6b6b6b);
  for (const d of list) {
    switch (d.t) {
      case "lamp":
        addMesh(g, new THREE.CylinderGeometry(0.08, 0.1, 1.6, 8), wood, d.x, 0.8, d.z);
        addMesh(g, new THREE.BoxGeometry(0.45, 0.5, 0.45),
          decoMat(0xffa040, { emissive: 0xff7a20, emissiveIntensity: 0.9 }), d.x, 1.75, d.z);
        addMesh(g, new THREE.BoxGeometry(0.55, 0.06, 0.55), wood, d.x, 2.03, d.z);
        break;
      case "flag":
        addMesh(g, new THREE.CylinderGeometry(0.04, 0.04, 3, 6), wood, d.x, 1.5, d.z);
        addMesh(g, new THREE.BoxGeometry(0.9, 2.2, 0.04), decoMat(d.c ?? 0xb3261e), d.x, 1.7, d.z);
        break;
      case "tree":
        addMesh(g, new THREE.CylinderGeometry(0.25, 0.35, 2, 7), wood, d.x, 1, d.z);
        addMesh(g, new THREE.ConeGeometry(1.4, 3.2, 8), decoMat(0x2d5a2b), d.x, 3.4, d.z);
        break;
      case "arch": {
        const red = decoMat(0xb3261e);
        addMesh(g, new THREE.BoxGeometry(0.35, 4, 0.35), red, d.x - 2.2, 2, d.z);
        addMesh(g, new THREE.BoxGeometry(0.35, 4, 0.35), red, d.x + 2.2, 2, d.z);
        addMesh(g, new THREE.BoxGeometry(6, 0.4, 0.5), red, d.x, 4.1, d.z);
        addMesh(g, new THREE.BoxGeometry(5, 0.3, 0.4), red, d.x, 3.4, d.z);
        break;
      }
      case "rock":
        addMesh(g, new THREE.DodecahedronGeometry(1.2), stone, d.x, 0.8, d.z);
        break;
      case "crate": {
        addMesh(g, new THREE.BoxGeometry(1.6, 1.2, 1.6), wood, d.x, 0.6, d.z);
        addMesh(g, new THREE.BoxGeometry(1.2, 1.0, 1.2), wood, d.x + 0.2, 1.7, d.z - 0.1);
        break;
      }
      default:
        break;
    }
  }
  return g;
}

export function disposeDeco(g) {
  g.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
}
