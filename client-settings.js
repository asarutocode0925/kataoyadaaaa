import { WEAPON_ORDER, WEAPONS, SKINS, SKIN_ORDER } from "./shared-game.js";

const KEY = "clanker-settings";

export const DEFAULTS = {
  sens: 1,
  touchSens: 1,
  fov: 75,
  volume: 0.7,
  showFps: true,
  name: "ロボット",
  adminKey: "",
  skins: {},
  knifeModel: "tanto",
};

const clampNum = (v, def, min, max) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

// 保存された設定を検査して安全な値にする（壊れた値・未知のキーは捨てる）
export function normalizeSettings(raw) {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const name = String(r.name ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 12);
  const skins = {};
  const rawSkins = r.skins && typeof r.skins === "object" && !Array.isArray(r.skins) ? r.skins : {};
  for (const k of Object.keys(rawSkins)) {
    const weapon = WEAPON_ORDER.includes(k);
    const skin = rawSkins[k];
    if (weapon && SKIN_ORDER.includes(skin)) skins[k] = skin;
  }
  return {
    sens: clampNum(r.sens, DEFAULTS.sens, 0.2, 3),
    touchSens: clampNum(r.touchSens, DEFAULTS.touchSens, 0.2, 3),
    fov: clampNum(r.fov, DEFAULTS.fov, 60, 110),
    volume: clampNum(r.volume, DEFAULTS.volume, 0, 1),
    showFps: typeof r.showFps === "boolean" ? r.showFps : DEFAULTS.showFps,
    name: name || DEFAULTS.name,
    adminKey: typeof r.adminKey === "string" ? r.adminKey.slice(0, 200) : "",
    skins,
    knifeModel: ["tanto", "karambit"].includes(r.knifeModel) ? r.knifeModel : DEFAULTS.knifeModel,
  };
}

export function loadSettings() {
  let s;
  try {
    s = normalizeSettings(JSON.parse(localStorage.getItem(KEY) || "{}"));
  } catch {
    s = normalizeSettings({});
  }
  return { ...s, adminKey: "" }; // 管理者キーはブラウザに残さない（毎回入力）
}

export function saveSettings(s) {
  const { adminKey, ...rest } = s; // 管理者キーは保存しない
  try {
    localStorage.setItem(KEY, JSON.stringify(rest));
  } catch { /* 保存できない環境でも設定画面は動かす */ }
}

// 設定画面の要素を初期化し、変更時にonChangeを呼ぶ
// スキンのプレビュー描画（view.js から渡される）
let previewFn = () => null;
export function setSkinPreview(fn) {
  previewFn = fn;
}

export function bindSettings(s, onChange) {
  const $ = (id) => document.getElementById(id);

  const sens = $("set-sens");
  const touch = $("set-touch");
  const fov = $("set-fov");
  const vol = $("set-vol");
  const fps = $("set-fps");
  const name = $("set-name");
  const adminKey = $("set-admin");
  const skinW = $("set-skin-weapon");
  const skinS = $("set-skin");
  const knifeSel = $("set-knife");
  knifeSel.value = s.knifeModel;

  for (const k of WEAPON_ORDER) {
    if (WEAPONS[k].melee) continue;
    const o = document.createElement("option");
    o.value = k;
    o.textContent = WEAPONS[k].label;
    skinW.appendChild(o);
  }
  for (const k of SKIN_ORDER) {
    const o = document.createElement("option");
    o.value = k;
    o.textContent = SKINS[k].name;
    skinS.appendChild(o);
  }

  const syncFields = () => {
    sens.value = s.sens;
    touch.value = s.touchSens;
    fov.value = s.fov;
    vol.value = s.volume;
    fps.checked = s.showFps;
    name.value = s.name;
    adminKey.value = s.adminKey;
    skinS.value = s.skins[skinW.value] ?? "std";
  };
  syncFields();

  skinW.addEventListener("change", () => {
    skinS.value = s.skins[skinW.value] ?? "std";
  });

  const apply = (patch) => {
    Object.assign(s, patch);
    saveSettings(s);
    onChange(s, patch);
  };

  sens.addEventListener("input", () => apply({ sens: Number(sens.value) }));
  touch.addEventListener("input", () => apply({ touchSens: Number(touch.value) }));
  fov.addEventListener("input", () => apply({ fov: Number(fov.value) }));
  vol.addEventListener("input", () => apply({ volume: Number(vol.value) }));
  fps.addEventListener("change", () => apply({ showFps: fps.checked }));
  name.addEventListener("change", () => apply({ name: name.value.trim().slice(0, 12) || "ロボット" }));
  adminKey.addEventListener("change", () => apply({ adminKey: adminKey.value }));
  knifeSel.addEventListener("change", () => apply({ knifeModel: knifeSel.value }));
  const pv = $("set-skin-preview");
  const drawPreview = () => {
    const src = previewFn(skinS.value);
    if (pv && src) pv.getContext("2d").drawImage(src, 0, 0, pv.width, pv.height);
  };
  skinS.addEventListener("change", () => {
    const skins = { ...s.skins, [skinW.value]: skinS.value };
    apply({ skins });
    drawPreview();
  });
  skinW.addEventListener("change", drawPreview);
  drawPreview();

  return { syncFields };
}
