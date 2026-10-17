// 管理者パネル（管理者のみ開ける。操作はサーバー側でも再確認される）
let ctx = null;
let openImpl = () => {};
let closeImpl = () => {};
export const openAdminPanel = () => openImpl();
export const closeAdminPanel = () => closeImpl();

export function initAdmin(c) {
  ctx = c;
  const { socket, getRoster, getLastState, setPaused, nameHtml, esc, MAPS } = c;

  const adminPanel = document.getElementById("admin");
  const adminList = document.getElementById("admin-list");
  const adminBtn = document.getElementById("admin-btn");
  const adminSay = document.getElementById("admin-say");

  const isAdmin = () => !!getRoster()[socket.id]?.a;

  function renderAdmin() {
    if (adminPanel.style.display !== "block" || !isAdmin()) return;
    adminList.innerHTML = Object.entries(getLastState())
      .map(([id, p]) => {
        const info = getRoster()[id] ?? { n: "?", a: false };
        const btn = (act, label) => `<button data-act="${act}" data-id="${esc(id)}">${label}</button>`;
        const actions = id === socket.id ? "" :
          btn("kick", "キック") + btn("heal", "回復") +
          btn("freeze", p.fz ? "解凍" : "凍結") + btn("bring", "呼寄") +
          btn("goto", "移動") + btn("respawn", "復活");
        const dead = p.alive ? "" : " <small>(死亡中)</small>";
        return `<div class="arow"><span>${nameHtml(info)} <small>キル${p.kills} デス${p.deaths}</small>${dead}</span><span class="acts">${actions}</span></div>`;
      })
      .join("");
  }
  setInterval(renderAdmin, 1000); // 操作中にDOMを作り直さないよう1秒ごとに更新

  function openAdmin() {
    if (!isAdmin()) return;
    setPaused(true);
    adminPanel.style.display = "block";
    if (document.pointerLockElement) document.exitPointerLock();
    renderAdmin();
  }
  function closeAdmin() {
    setPaused(false);
    adminPanel.style.display = "none";
  }

  adminBtn.addEventListener("click", openAdmin);
  document.getElementById("admin-close").addEventListener("click", closeAdmin);
  adminList.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    const act = b.dataset.act;
    const id = b.dataset.id;
    if (act === "kick" && !confirm("このプレイヤーをキックしますか？")) return;
    socket.emit(`admin:${act}`, { id });
  });

  document.getElementById("admin-reset").addEventListener("click", () => {
    if (confirm("全員のキル・デス数をリセットしますか？")) socket.emit("admin:resetStats");
  });

  socket.on("adminlog", (lines) => {
    document.getElementById("admin-log").innerHTML = lines
      .slice()
      .reverse()
      .map((l) => {
        const time = new Date(l.t).toLocaleTimeString("ja-JP");
        const target = l.target ? `（${esc(l.target)}）` : "";
        return `<div>${time} ${esc(l.by)}：${esc(l.action)}${target}</div>`;
      })
      .join("");
  });
  const adminMaps = document.getElementById("admin-maps");
  MAPS.forEach((m, i) => {
    const b = document.createElement("button");
    b.textContent = m.name;
    b.addEventListener("click", () => socket.emit("admin:map", { i }));
    adminMaps.appendChild(b);
  });
  document.getElementById("admin-say-btn").addEventListener("click", () => {
    const t = adminSay.value.trim();
    if (!t) return;
    socket.emit("admin:announce", { text: t });
    adminSay.value = "";
  });


  openImpl = openAdmin;
  closeImpl = closeAdmin;
}

export function isAdminOpen() {
  return document.getElementById("admin").style.display === "block";
}
