import './styles.css';
import { AsciiRenderer, speciesArt } from './render/ascii-renderer.js';
import { ViewManager } from './render/view-manager.js';
import { waterColor } from './render/water.js';
import { Ocean, DATA, SPECIES, CATCHABLE, guideId, SPEED_DEFAULT, LURE, ROD, RARE_COLOR } from './game/ocean.js';
import { GUIDE, TITLES, TROPHIES, TROPHY_GOT, TROPHY_ALL, LURE_IDS, trophyKey, trophyState, tallyRecords, earnedTitles } from './game/progression.js';
import { loadCounts, loadSliderValues, loadViewMode, saveViewMode } from './game/storage.js';
import { LANG_KEY, lang, T, spText, tiText, setLanguageState } from './ui/i18n.js';

const water = f => waterColor(f, redTide);

const zoneName = f => {
  let n = DATA.zones[0][1];
  for (const [start, label] of DATA.zones) if (f >= start) n = label;
  return n;
};

// Input remains on the same surface while the presentation canvases change.
const canvas = document.getElementById('sea-surface');
const canvas3d = document.getElementById('c');
const canvas2d = document.getElementById('c-ascii');
const ctx = document.createElement("canvas").getContext("2d");
let renderer = null;
let ready = false, failed = false;
let baitReady = false, redTide = false;
const gaugeEl = document.getElementById("gauge");
const trackEl = document.getElementById("track");
const viewEl = document.getElementById("view");
const metresEl = document.getElementById("metres");
const zoneEl = document.getElementById("zone");
const hintEl = document.getElementById("hint");
const pauseBtn = document.getElementById("btn-pause");
const waterBtn = document.getElementById("btn-water");
const subBtn = document.getElementById("btn-sub");
const baitBtn = document.getElementById("btn-bait");
const rodBtn = document.getElementById("btn-rod");
const ui = {}, out = {};
for (const k of ["fish", "sharks", "coral", "starfish", "seaweed", "speed"]) {
  ui[k] = document.getElementById(k);
  out[k] = document.getElementById(k + "-v");
}

let FONT = 15, cw = 9, chh = 18, cols = 80, rows = 24, cssW = 0, cssH = 0;
let ocean = null, depth = 0, cam = 0, camTarget = 0, last = 0;
let clock = 0, motion = 0, paused = false, waterOn = true, rodLit = false;
let baitAt = 0, baitSaid = null;   // 먹이를 뿌린 시각과 그 결과. 안내줄이 읽는다

function measure() {
  const previous = [cssW, cssH, cw, chh].join(',');
  const box = canvas.parentElement.getBoundingClientRect();

  FONT = box.width < 620 ? 11 : 15;
  ctx.font = `${FONT}px "IBM Plex Mono", ui-monospace, monospace`;
  cw = ctx.measureText("M").width;
  chh = Math.round(FONT * 1.16);
  cols = Math.max(24, Math.floor(box.width / cw));
  rows = Math.max(10, Math.floor(box.height / chh));
  cssW = box.width;       // 물빛을 칠할 때 쓴다. device px 이 아니라 CSS px 이어야 한다
  cssH = box.height;      // 행으로 나누어떨어지지 않고 남는 아래 띠를 재려면 필요하다
  return previous !== [cssW, cssH, cw, chh].join(',');
}
const depthFrac = () => {
  const wasFloor = ocean ? Math.max(0, depth - rows) : 0;
  return wasFloor ? camTarget / wasFloor : 0;
};

function build() {
  if (!ready) return;
  const frac = depthFrac();
  const changed = measure();
  if (ocean && !changed) return;
  depth = Math.max(rows, rows * 5);
  ocean = new Ocean(cols, depth, rows);
  ocean.nextMeal += clock;
  ocean.nextLine += clock;
  ocean.now = clock * 1000;
  cam = camTarget = frac * Math.max(0, depth - rows);
  showCounts();
  syncSubBtn();          // 새 바다에는 잠수함이 없다. 버튼도 꺼진 채로 돌아간다
  layoutGauge();
  resizeRenderers();
}
function resizeRenderers() { renderer.resize({width:cssW,height:cssH,cols,rows,depth,cw,chh,fontSize:FONT}); }
let rebuildTimer = null;
const rebuildSoon = (ms = 150) => {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(build, ms);
};
function restock() {
  if (!ready) return;
  const frac = depthFrac();
  measure();
  depth = Math.max(rows, rows * 5);
  ocean = new Ocean(cols, depth, rows);
  ocean.nextMeal += clock;
  ocean.nextLine += clock;
  ocean.now = clock * 1000;
  cam = camTarget = frac * Math.max(0, depth - rows);
  applyCounts();
  syncSubBtn();          // 새 바다에는 잠수함이 없다. 버튼도 꺼진 채로 돌아간다
  layoutGauge();
  resizeRenderers();
}
const SLIDER_KEY = "atsea.sliders";
function loadSliders() { return loadSliderValues(Object.keys(ui)); }
function saveSliders() {
  try {
    const out = {};
    for (const k of Object.keys(ui)) out[k] = +ui[k].value;
    localStorage.setItem(SLIDER_KEY, JSON.stringify(out));
  } catch { /* Storage/fullscreen may be unavailable. */ }
}

function showCounts() {
  const seed = {
    fish: ocean.groups.fish.length,
    sharks: ocean.groups.shark.length,
    coral: ocean.coralCount,
    starfish: ocean.starCount,
    seaweed: ocean.weeds.length,
  };
  const saved = loadSliders();
  for (const [k, v] of Object.entries(seed)) {
    ui[k].max = Math.max(+ui[k].max, v * 2, saved[k] || 0);
    ui[k].value = k in saved ? saved[k] : v;
  }
  ui.speed.value = "speed" in saved ? saved.speed : (ui.speed.value || SPEED_DEFAULT);
  syncReadouts();
  if (Object.keys(saved).length) applyCounts();
}

function syncReadouts() {
  for (const k of Object.keys(ui)) out[k].value = ui[k].value;
}
function applyCounts() {
  if (!ocean) return;
  ocean.setPopulation(+ui.fish.value);
  ocean.setCount("shark", +ui.sharks.value);
  ocean.floor = ocean.buildFloor(+ui.coral.value, +ui.starfish.value);
  ocean.setWeeds(+ui.seaweed.value);
  syncReadouts();
}

function layoutGauge() {
  trackEl.innerHTML = "";
  const stops = [];
  for (let i = 0; i <= 20; i++) stops.push(water(i / 20));
  trackEl.style.background = `linear-gradient(to bottom, ${stops.join(",")})`;
  const holder = document.getElementById("zones");
  holder.innerHTML = "";
  for (const [start, label] of DATA.zones) {
    const el = document.createElement("div");
    el.className = "gauge-zone";
    el.textContent = T("zone." + label);
    el.style.top = `${start * 100}%`;
    holder.appendChild(el);
  }
}

function frame(now, reschedule = true) {
  if (!ready || failed || !ocean) return;
  const dt = Math.max(0, Math.min(200, now - last));
  const u = Math.max(0, Math.min(4, dt / (1000 / (+ui.speed.value || SPEED_DEFAULT))));
  last = Math.max(last, now);
  if (!paused) { clock += Math.min(200, dt) / 1000; motion += u; }
  const floorMax = Math.max(0, depth - rows);
  const camRow0 = Math.round(cam);
  camTarget = Math.max(0, Math.min(floorMax, camTarget));
  cam += (camTarget - cam) * 0.18;            // 관성 있는 잠수
  if (Math.abs(camTarget - cam) < .01) cam = camTarget;
  const red = +ui.fish.value >= +ui.fish.max;
  if (red !== redTide) { redTide = red; layoutGauge(); }
  if (!paused) ocean.step(u, clock * 1000, camRow0, rows);
  if (ocean.landed) { const got = ocean.landed; ocean.landed = null; landed(got); }
  if (ocean.missed) { const gone = ocean.missed; ocean.missed = null; missed(gone); }
  if (!statLog.seabed && camRow0 + rows >= depth - 1) {
    statLog.seabed = 1;
    saveGuide();
    checkTitles();
  }
  const onScreen = b => b.y + b.h > camRow0 && b.y < camRow0 + rows &&
                        b.x + b.w > 0 && b.x < cols;
  if (!seenLog.megalodon && ocean.groups.megalodon.length &&
      onScreen(ocean.groups.megalodon[0])) sighted("megalodon");
  for (const b of ocean.groups.shark)
    if (b.rare && !b.logged && onScreen(b)) { b.logged = true; spottedRare(b); }

  renderer.render({ocean,cam,cols,rows,depth,clock,motion,waterOn,redTide,paused,dt:paused ? 0 : Math.min(200,dt)/1000});
  const camRow = Math.round(cam);

  const frac = floorMax ? camRow / floorMax : 0;
  metresEl.textContent = `${Math.round(frac * DATA.maxDepth)}m`;
  zoneEl.textContent = T("zone." + zoneName((camRow + rows / 2) / depth));
  const tally = ocean.caught ? `${T("cs.caught")} <b>${ocean.caught}</b>` : "";
  const rod = ocean.rod;
  const baitSay = baitSaid && now - baitAt < 2600
    ? `<b style="color:#a8e6ff">${T("bait." + baitSaid)}</b>` : "";
  const say = baitSay || (!rod
    ? ""
    : rod.state === "shark"
      ? `<b style="color:#ff5f5f">${T("h.shark")}</b>`
    : rod.state === "on"
      ? `<b style="color:#ff5f5f">${T("h.on")}</b>`
      : rod.missAt && clock * 1000 - rod.missAt < 1900
        ? `<b style="color:#ff5f5f">${T("h.slip")}</b>`
      : rod.state === "up"
        ? T("h.reel")
        : Math.abs(rod.stop - rod.tip) >= 1.5
          ? T("h.drop")
          : rod.atBait()
            ? `<b style="color:${LURE}">${speciesName(rod.mark)}</b> &nbsp;·&nbsp; ${T("h.bite")}`
          : rod.mark
            ? `<b style="color:${ROD}">${speciesName(rod.mark)}</b> &nbsp;·&nbsp; ${T("h.coming")}`
            : T("h.none"));
  hintEl.innerHTML = say && tally ? `${say} &nbsp;·&nbsp; ${tally}` : say || tally;
  const rodOut = !!ocean.rod;
  if (rodOut !== rodLit) {
    rodLit = rodOut;
    rodBtn.setAttribute("aria-pressed", String(rodOut));
    document.body.classList.toggle("rod", rodOut);
  }
  const th = trackEl.getBoundingClientRect().height;
  viewEl.style.top = `${trackEl.offsetTop + (camRow / depth) * th}px`;
  viewEl.style.height = `${Math.max(10, (rows / depth) * th)}px`;

  if (reschedule) schedule();
}
let rafId = null;
function animate(now) { try { frame(now); } catch(error) { showFailure(error); } }
function schedule() { if (ready && !failed) rafId = requestAnimationFrame(animate); }
function dive(rowsDelta) { camTarget += rowsDelta; }

addEventListener("keydown", e => {
  if (!ready || failed || e.defaultPrevented) return;
  if (e.key === "Escape" && !awardWrap.hidden) { closeAward(); return; }
  if (e.key === "Escape" && !guideWrap.hidden) { setGuide(false); return; }
  if (e.key === "Escape" && !helpCard.hidden) { setHelp(false); return; }
  const dialog = !awardWrap.hidden ? awardWrap : !guideWrap.hidden ? guideWrap : null;
  if (dialog && e.key === 'Tab') { trapFocus(e, dialog); return; }
  if (dialog && !(dialog === guideWrap && (e.key === 'd' || e.key === 'D'))) return;
  const EAT = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
               "Home", "End", "PageUp", "PageDown"];
  if (e.target instanceof HTMLInputElement && EAT.includes(e.key)) return;
  if (e.target instanceof HTMLButtonElement && (e.code === "Space" || e.key === "Enter")) return;
  const map = {ArrowUp: -2, ArrowDown: 2, k: -2, j: 2, w: -2, s: 2,
               PageUp: -Math.floor(rows / 2), PageDown: Math.floor(rows / 2)};
  if (e.key in map) { dive(map[e.key]); e.preventDefault(); }
  else if (e.code === "Space") { setPaused(!paused); e.preventDefault(); }
  else if (e.key === "Home" || e.key === "g") camTarget = 0;
  else if (e.key === "End" || e.key === "G") camTarget = depth - rows;
  else if (e.key === "b" || e.key === "B") toggleSub();
  else if (e.key === "m" || e.key === "M") scatterBait();
  else if (e.key === "r" || e.key === "R") castRod();
  else if (e.key === "d" || e.key === "D") setGuide(guideWrap.hidden);
  else if (e.key === "n" || e.key === "N") restock();
  else if (e.key === "t" || e.key === "T") setWater(!waterOn);
  else if (e.key === "c" || e.key === "C") setPanel(document.body.classList.contains("panel-off"));
  else if (e.key === "f" || e.key === "F") toggleBare();
  else if (e.key === "Escape") toggleBare(false);
});

canvas.addEventListener("wheel", e => { dive(e.deltaY * 0.05); e.preventDefault(); }, {passive: false});

function at(e) {
  const box = canvas.getBoundingClientRect();
  return [(e.clientX - box.left) / cw,
          (e.clientY - box.top) / chh + Math.round(cam)];
}
let aim = null;                  // 마지막으로 가리킨 자리
function poke(e, pressed) {
  if (!ocean) return;
  const [x, y] = at(e);
  aim = [x, y];
  if (!ocean.rod) { if (pressed) ocean.scare(x, y); return; }
  if (pressed) ocean.rod.strike();
  else ocean.rod.aim(x, y);
}

const touches = new Map();     // 지금 바다에 닿아 있는 손가락들의 높이(px)
let diving = false;            // 이 몸짓이 잠수인가
let divedFrom = 0;             // 두 손가락 한가운데의 마지막 높이
const midY = () => {
  let sum = 0;
  for (const y of touches.values()) sum += y;
  return touches.size ? sum / touches.size : 0;
};
canvas.addEventListener("pointerdown", e => {
  canvas.setPointerCapture(e.pointerId);
  if (e.pointerType === "touch") {
    touches.set(e.pointerId, e.clientY);
    if (touches.size >= 2) { diving = true; divedFrom = midY(); return; }
  }
  poke(e, true);
});
canvas.addEventListener("pointermove", e => {
  if (e.pointerType === "touch" && touches.has(e.pointerId)) touches.set(e.pointerId, e.clientY);
  if (diving) {
    const y = midY();
    dive((divedFrom - y) / chh);
    divedFrom = y;
    return;
  }
  if (ocean && (e.buttons || ocean.rod)) poke(e, false);
});
const lifted = e => {
  if (e.pointerType !== "touch" || !touches.delete(e.pointerId)) return;
  if (touches.size >= 2) divedFrom = midY();   // 한가운데가 껑충 뛰지 않게 다시 잡는다
  else if (!touches.size) diving = false;
};
canvas.addEventListener("pointerup", lifted);
canvas.addEventListener("pointercancel", lifted);

const castRod = () => {
  if (!ocean) return;
  const [x, y] = aim || [cols / 2, Math.round(cam) + rows / 2];
  ocean.castRod(Math.round(cam), rows, x, y);
};
rodBtn.onclick = castRod;

let dragging = false;
const gaugeTo = e => {
  const box = trackEl.getBoundingClientRect();
  camTarget = ((e.clientY - box.top) / box.height) * depth - rows / 2;
};
gaugeEl.addEventListener("pointerdown", e => { dragging = true; gaugeEl.setPointerCapture(e.pointerId); gaugeTo(e); });
gaugeEl.addEventListener("pointermove", e => { if (dragging) gaugeTo(e); });
const undrag = () => { dragging = false; };
gaugeEl.addEventListener("pointerup", undrag);
gaugeEl.addEventListener("pointercancel", undrag);
const WAKE_HOLD = 5000;
let wakeTimer = null;
function wake() {
  if (!document.body.classList.contains("bare")) return;
  document.body.classList.add("awake");
  clearTimeout(wakeTimer);
  wakeTimer = setTimeout(() => document.body.classList.remove("awake"), WAKE_HOLD);
}
addEventListener("pointerdown", wake, true);
addEventListener("pointerup", wake, true);
addEventListener("pointermove", e => { if (e.pointerType === "mouse") wake(); }, true);

async function toggleBare(on) {
  setHelp(false);                  // 조작줄이 사라지면 쪽지도 같이 걷는다
  setGuide(false);                 // 도감도 마찬가지. 바다만 남기는 모드다
  const want = on === undefined ? !document.body.classList.contains("bare") : on;
  document.body.classList.toggle("bare", want);
  if (want) wake();                // 들어가자마자 나가는 길을 한 번 보여 준다
  else { clearTimeout(wakeTimer); document.body.classList.remove("awake"); }
  try {
    if (want && !document.fullscreenElement) await document.documentElement.requestFullscreen();
    else if (!want && document.fullscreenElement) await document.exitFullscreen();
  } catch { /* Storage/fullscreen may be unavailable. */ }
  rebuildSoon();                   // 크롬이 사라지면 캔버스 크기가 달라진다
}
document.getElementById("btn-bare").onclick = () => toggleBare();
const panelBtn = document.getElementById("btn-panel");
const PANEL_KEY = "atsea.controls";
const loadPanel = () => {
  try { return localStorage.getItem(PANEL_KEY) !== "off"; } catch { return true; }
};
const savePanel = on => {
  try { localStorage.setItem(PANEL_KEY, on ? "on" : "off"); } catch { /* Storage/fullscreen may be unavailable. */ }
};
function paintPanel(on) {
  document.body.classList.toggle("panel-off", !on);
  panelBtn.setAttribute("aria-expanded", String(on));
  panelBtn.innerHTML = on ? T("ui.controls") : T("ui.controlsOff");
}
function setPanel(on) {
  paintPanel(on);
  savePanel(on);
  if (!on) setHelp(false);        // 쪽지도 이 안에 있다. 접히면 상태만 남는다
  restock();
}
panelBtn.onclick = () => setPanel(document.body.classList.contains("panel-off"));

const exitBtn = document.getElementById("btn-exit");
exitBtn.onclick = () => toggleBare(false);
exitBtn.addEventListener("pointerenter", wake);
exitBtn.addEventListener("focus", wake);
addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) document.body.classList.remove("bare");
  rebuildSoon();
});
function toggleSub() {
  if (!ocean) return;
  ocean.toggleSub(Math.round(cam) + Math.floor(rows / 2));
  syncSubBtn();
}
function syncSubBtn() { subBtn.setAttribute("aria-pressed", String(ocean.subs.length > 0)); }
subBtn.onclick = toggleSub;
function scatterBait() {
  if (!baitReady) return;
  const [ax] = aim || [cols / 2];
  const how = ocean.scatterBait(Math.round(cam), rows, ax);
  baitAt = performance.now();
  baitSaid = how;
}
baitBtn.onclick = scatterBait;
document.getElementById("btn-top").onclick = () => { camTarget = 0; };
document.getElementById("btn-bottom").onclick = () => { camTarget = depth - rows; };

function setPaused(v) {
  paused = v;
  pauseBtn.textContent = v ? T("ui.play") : T("ui.pause");
  pauseBtn.setAttribute("aria-pressed", String(v));
}
function setWater(v) {
  waterOn = v;
  waterBtn.setAttribute("aria-pressed", String(v));
}

const helpBtn = document.getElementById("btn-help");
const helpCard = document.getElementById("help-card");
function setHelp(open) {
  helpCard.hidden = !open;
  helpBtn.setAttribute("aria-expanded", String(open));
}
helpBtn.onclick = () => setHelp(helpCard.hidden);
addEventListener("pointerdown", e => {
  if (helpCard.hidden) return;
  if (helpCard.contains(e.target) || helpBtn.contains(e.target)) return;
  setHelp(false);
}, true);

pauseBtn.onclick = () => setPaused(!paused);
waterBtn.onclick = () => setWater(!waterOn);
document.getElementById("btn-restock").onclick = restock;
ui.fish.addEventListener("input", () => { syncReadouts(); ocean.setPopulation(+ui.fish.value); });
ui.sharks.addEventListener("input", () => { syncReadouts(); ocean.setCount("shark", +ui.sharks.value); });
for (const k of ["coral", "starfish"]) {
  ui[k].addEventListener("input", () => {
    syncReadouts();
    ocean.floor = ocean.buildFloor(+ui.coral.value, +ui.starfish.value);
  });
}
ui.seaweed.addEventListener("input", () => { syncReadouts(); ocean.setWeeds(+ui.seaweed.value); });
ui.speed.addEventListener("input", syncReadouts);
for (const k of Object.keys(ui)) ui[k].addEventListener("change", saveSliders);

const GUIDE_KEY = "atsea.guide";
const speciesName = b => spText(b.guideId)[0];

const esc = t => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const metres = f => Math.round(f * DATA.maxDepth / 10) * 10;
function bandText(kind) {
  const [lo, hi] = SPECIES[kind].band;
  return `${metres(lo)} - ${metres(hi)} m`;
}
function zoneText(kind) {
  const [lo, hi] = SPECIES[kind].band;
  const a = zoneName(lo), z = zoneName(Math.max(lo, hi - .001));
  return a === z ? T("zone." + a) : `${T("zone." + a)} - ${T("zone." + z)}`;
}
const paceText = kind => {
  const [lo, hi] = SPECIES[kind].speed, v = (lo + hi) / 2;
  const k = v < .12 ? "drifts" : v < .2 ? "slow" : v < .4 ? "steady" : v < .6 ? "brisk" : "quick";
  return T("pace." + k);
};

const RARE_KEY = "atsea.rare";

const STAT_KEY = "atsea.stats";
const SEEN_KEY = "atsea.seen";
let guideLog = loadCounts(GUIDE_KEY), rareLog = loadCounts(RARE_KEY),
    seenLog = loadCounts(SEEN_KEY);
let statLog = loadCounts(STAT_KEY);
const saveGuide = () => {
  try {
    localStorage.setItem(GUIDE_KEY, JSON.stringify(guideLog));
    localStorage.setItem(RARE_KEY, JSON.stringify(rareLog));
    localStorage.setItem(SEEN_KEY, JSON.stringify(seenLog));
    localStorage.setItem(TITLE_KEY, JSON.stringify(titleLog));
    localStorage.setItem(STAT_KEY, JSON.stringify(statLog));
  } catch { /* Storage/fullscreen may be unavailable. */ }
};
function speciesArtwork(entry, rare, locked) {
  const [kind, shape, color] = entry, id = guideId(kind, shape);
  const name = esc(spText(id)[0]);
  if (renderer.mode === '3d') return '<img class="sp-art' + (locked ? ' sp-art--locked' : '') +
    '" src="' + renderer.getThumbnail(id, {rare,locked}) + '" alt="' + name + '" width="250" height="92">';
  const art = speciesArt(kind, shape);
  const width = Math.max(...art.map(line => line.length));
  const size = Math.max(4.5, Math.min(11, 88 / (art.length * 1.15), 250 / (width * .6)));
  const lines = locked ? art.map(line => line.replace(/[^ ]/g, '█')) : art;
  const shade = locked ? 'var(--ink-faint)' : rare && CATCHABLE.includes(kind) ? RARE_COLOR : color;
  return '<pre class="sp-art sp-art--ascii" role="img" aria-label="' + name + '" style="color:' +
    shade + ';font-size:' + size.toFixed(1) + 'px">' + esc(lines.join('\n')) + '</pre>';
}
function refreshSpeciesArtwork() {
  // Leave timers, focused cards, scrolling, record counts and awards intact.
  for (const el of document.querySelectorAll('[data-art-id]')) {
    const entry = GUIDE.find(e => guideId(e[0], e[1]) === el.dataset.artId);
    if (entry) el.innerHTML = speciesArtwork(entry, el.dataset.artRare === 'true', el.dataset.artLocked === 'true');
  }
}
function speciesCard(entry, lit, mode) {
  const [kind, shape] = entry;
  const id = guideId(kind, shape);
  const [name, note] = spText(id);
  const n = guideLog[id] || 0, r = rareLog[id] || 0;
  const can = CATCHABLE.includes(kind);
  const rareMode = mode === "rare";
  const seen = rareMode ? r > 0 : (n > 0 || !can);
  const tally = rareMode
    ? (!can ? (r ? T("g.rare") + " &times;" + r : T("c.notspotted"))
            : r ? T("g.rare") + " &times;" + r : T("c.norare"))
    : (!can ? T("c.sight")
            : n ? T("c.caught") + " &times;" + n +
                  (r ? `<em class="sp-rare">${T("g.rare")} &times;${r}</em>` : "")
                : T("c.notyet"));
  return `<article class="sp${lit ? " sp--lit" : ""}${seen ? "" : " sp--unknown"}" data-id="${id}" data-kind="${kind}" role="button" tabindex="0" aria-label="${esc(name)} · ${bandText(kind)}">
    <div class="sp-visual" data-art-id="${id}" data-art-rare="${rareMode}" data-art-locked="${!seen}">${speciesArtwork(entry, rareMode, !seen)}</div>
    <h3 class="sp-name">${name}<span class="sp-tally${(rareMode ? r : n) ? (rareMode ? " sp-tally--rare" : "") : " sp-tally--none"}">${tally}</span></h3>
    <dl>
      <dt>${T("c.depth")}</dt><dd>${bandText(kind)}</dd>
      <dt>${T("c.zone")}</dt><dd>${zoneText(kind)}</dd>
      <dt>${T("c.pace")}</dt><dd>${paceText(kind)}</dd>
      <dt>${T("c.line")}</dt><dd class="${can ? "yes" : "no"}">${can ? T("c.hook") : T("c.nohook")}</dd>
    </dl>
    <p class="sp-note">${note}</p>
  </article>`;
}
function stat(label, value, of, rare) {
  const bar = of
    ? `<span class="gbar"><i style="width:${of ? Math.round(value / of * 100) : 0}%"></i></span>`
    : "";
  return `<div class="gstat${rare ? " gstat--rare" : ""}">` +
         `<span class="gstat-k">${label}</span>` +
         `<span class="gstat-v">${value}${of ? `<i>/${of}</i>` : ""}</span>${bar}</div>`;
}
function paintTabs() {
  const allPool = GUIDE.filter(e => !EASTER_EGG.has(e[0]) || seenLog[e[0]]);
  const allGot = allPool.filter(e => guideLog[guideId(e[0], e[1])] || seenLog[e[0]]).length;
  const rarePool = GUIDE.filter(e => !EASTER_EGG.has(e[0]));
  const rareGot = rarePool.filter(e => rareLog[guideId(e[0], e[1])]).length;
  const titleGot = earned().length;
  const table = {
    all:    [T("g.all"), allGot, allPool.length],
    rare:   [T("g.rare"), rareGot, rarePool.length],
    titles: [T("g.titles"), titleGot, TITLES.length],
    trophies: [T("g.trophies"), TROPHY_GOT(trophyState(tally())), TROPHY_ALL],
  };
  for (const b of guideTabs) {
    const [label, got, of] = table[b.dataset.tab];
    b.innerHTML = `${label}<span class="tab-n">${got}/${of}</span>`;
    b.setAttribute("aria-pressed", String(b.dataset.tab === guideTab));
  }
}

const guideWrap = document.getElementById("guide");
const guideGrid = document.getElementById("guide-grid");
const guideTally = document.getElementById("guide-tally");
const EASTER_EGG = new Set(["megalodon"]);

const TITLE_KEY = "atsea.titles";

const TROPHY_SVG = cls =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"` +
  `     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
  `<path d="M7.4 3.2h9.2v5a4.6 4.6 0 0 1-9.2 0z"/>` +
  `<path d="M7.4 4.5H4.6a3 3 0 0 0 3.1 4.4"/>` +
  `<path d="M16.6 4.5h2.8a3 3 0 0 1-3.1 4.4"/>` +
  `<path d="M12 12.8v2.9"/>` +
  `<path d="M9.2 15.7h5.6l.8 3.4H8.4z"/>` +
  `<path d="M6.9 20.9h10.2"/>` +
  `</svg>`;

let titleLog = loadCounts(TITLE_KEY);
setTimeout(() => refreshMegaLure(), 0);
function tally() { return tallyRecords({guideLog,rareLog,statLog,seenLog}); }
function earned(t = tally()) { return earnedTitles(t); }
function refreshMegaLure(t = tally()) {
  const was = baitReady;
  const open = new Set(earned(t).map(x => x[0]));
  baitReady = LURE_IDS.every(id => open.has(id));
  if (baitBtn) baitBtn.hidden = !baitReady;   // 자격이 없으면 단추도 없다
  for (const id of ["help-bait-k", "help-bait-v"]) {
    const el = document.getElementById(id);
    if (el) el.hidden = !baitReady;
  }
  return was;
}

function checkTitles() {
  const t = tally();
  const got = earned(t).filter(x => !titleLog[x[0]]);
  const cups = [];
  for (const st of trophyState(t)) {
    let fresh = false;
    for (let k = 1; k <= st.tier; k++) {
      if (titleLog[trophyKey(st.track, k)]) continue;
      titleLog[trophyKey(st.track, k)] = 1;
      fresh = true;
    }
    if (fresh) cups.push(st);
  }
  if (!got.length && !cups.length) return;
  for (const x of got) titleLog[x[0]] = 1;
  saveGuide();
  const more = got.length + cups.length;
  const wasLure = refreshMegaLure(tally());
  if (baitReady && !wasLure) showLure(more + 1);
  else if (cups.length) showTrophy(cups[cups.length - 1], more);
  else showTitle(got[got.length - 1], more);
  if (!guideWrap.hidden) paintGuide();
}

const guideBtn = document.getElementById("btn-guide");
let guideLit = null;              // 방금 올린 종. 도감을 열면 그 칸에 테를 두른다
let guideTab = "all";             // "all" · "rare" · "titles" · "trophies"
const guideTabs = [...document.querySelectorAll(".guide-tab")];
for (const b of guideTabs)
  b.onclick = () => { guideTab = b.dataset.tab; guideGrid.scrollTop = 0; paintGuide(); };
function titleCard(x, got) {
  const id = x[0];
  const [name, note] = tiText(id);
  return `<article class="tcard${got ? " tcard--got" : ""}">` +
         `<span class="tcard-box">${got ? "[x]" : "[ ]"}</span>` +
         `<h3 class="tcard-name">${name}</h3>` +
         `<p class="tcard-note">${note}</p></article>`;
}
function trophyCard(st) {
  const next = st.next === null ? T("tr.top") : T("tr.next").replace("%", st.next);
  const open = st.tier
    ? ` data-award="${st.track}" data-tier="${st.tier}" role="button" tabindex="0"`
    : "";
  return `<article class="trophy${st.tier ? " trophy--t" + st.tier : ""}"${open}>` +
         TROPHY_SVG("trophy-cup") +
         `<p class="trophy-name">${T("tr." + st.track)}${st.tier ? " &middot; " + T("tr.t" + st.tier) : ""}</p>` +
         `<p class="trophy-count">${st.now}</p>` +
         `<p class="trophy-next">${next}</p></article>`;
}
function tierCards(st) {
  const steps = TROPHIES.find(x => x[0] === st.track)[1];
  const cards = steps.map((need, i) => {
    const tier = i + 1, got = st.tier >= tier;
    const open = got ? ` data-award="${st.track}" data-tier="${tier}" role="button" tabindex="0"` : "";
    return `<article class="tiercard${got ? " tiercard--got tiercard--t" + tier : ""}"${open}>` +
           TROPHY_SVG("tiercard-cup") +
           `<p class="tiercard-name">${T("tr.t" + tier)}</p>` +
           `<p class="tiercard-need">${T("tr.needShort").replace("%", need)}</p></article>`;
  }).join("");
  return `<section class="tier-row">` +
         `<h3 class="tier-head">${T("tr." + st.track)}<b>${st.tier}/${steps.length}</b></h3>` +
         `<div class="tier-line">${cards}</div></section>`;
}

function paintGuide() {
  if (guideTab === "titles") {
    const open = new Set(earned().map(x => x[0]));
    guideGrid.className = "guide-grid guide-grid--titles";
    const need = LURE_IDS.filter(id => open.has(id)).length;
    const lit = need >= LURE_IDS.length;
    guideGrid.innerHTML =
      `<div class="lure${lit ? " lure--on" : ""}">` +
        `<p class="lure-head">${lit ? T("lure.on") : T("lure.locked")}</p>` +
        `<p class="lure-note">${lit ? T("lure.note2")
                                     : T("lure.count").replace("%1", need).replace("%2", LURE_IDS.length)}</p>` +
      `</div>` +
      TITLES.map(x => titleCard(x, open.has(x[0]))).join("");
    guideTally.innerHTML = stat(T("g.titlesStat"), open.size, TITLES.length);
    paintTabs();
    return;
  }
  if (guideTab === "trophies") {
    const cups = trophyState(tally());
    guideGrid.className = "guide-grid guide-grid--trophies";
    guideGrid.innerHTML =
      `<div class="trophies">${cups.map(trophyCard).join("")}</div>` +
      cups.map(tierCards).join("");
    guideTally.innerHTML = stat(T("g.trophies"), TROPHY_GOT(cups), TROPHY_ALL);
    paintTabs();
    return;
  }
  guideGrid.className = "guide-grid";
  const rareMode = guideTab === "rare";
  const shown = rareMode
    ? GUIDE.filter(e => !EASTER_EGG.has(e[0]))
    : GUIDE.filter(e => !EASTER_EGG.has(e[0]) || seenLog[e[0]]);
  guideGrid.innerHTML = shown
    .map(e => speciesCard(e, guideId(e[0], e[1]) === guideLit, guideTab)).join("");
  if (rareMode) {
    const got = shown.filter(e => rareLog[guideId(e[0], e[1])]).length;
    const total = Object.values(rareLog).reduce((a, b) => a + b, 0);
    guideTally.innerHTML =
      stat(T("g.rareSpecies"), got, shown.length, true) +
      stat(T("g.rareLanded"), total, null, true);
  } else {
    const found = shown.filter(e => guideLog[guideId(e[0], e[1])] || seenLog[e[0]]).length;
    const total = Object.values(guideLog).reduce((a, b) => a + b, 0);
    const rare = Object.values(rareLog).reduce((a, b) => a + b, 0);
    guideTally.innerHTML =
      stat(T("g.species"), found, shown.length) +
      stat(T("g.basket"), total) +
      stat(T("g.rareStat"), rare, null, true);
  }

  paintTabs();
  const lit = guideLit && guideGrid.querySelector(".sp--lit");
  if (lit) lit.scrollIntoView({block: "nearest"});
}
let guideReturnFocus = null;
function trapFocus(event, dialog) {
  const items = [...dialog.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), [tabindex="0"]')]
    .filter(item => item.getClientRects().length);
  if (!items.length) { event.preventDefault(); return; }
  const first = items[0], last = items[items.length - 1];
  if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
    event.preventDefault(); last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
    event.preventDefault(); first.focus();
  }
}
function setGuide(open) {
  const wasOpen = !guideWrap.hidden;
  if (open && !wasOpen) guideReturnFocus = document.activeElement;
  if (!open) closeAward();
  guideWrap.hidden = !open;
  guideBtn.setAttribute("aria-pressed", String(open));
  if (open) {
    setHelp(false); paintGuide();
    if (!wasOpen) document.getElementById('btn-guide-close').focus();
  } else {
    disarmReset();
    if (wasOpen) (guideReturnFocus?.isConnected ? guideReturnFocus : guideBtn).focus();
  }
}
function diveTo(kind) {
  const [lo, hi] = SPECIES[kind].band;
  camTarget = Math.max(0, Math.min(depth - rows, (lo + hi) / 2 * depth - rows / 2));
}
guideGrid.addEventListener("click", e => {
  if (awardClick(e)) return;      // 트로피가 먼저다. 생물 칸과 겹치지 않는다
  const card = e.target.closest(".sp");
  if (!card || !card.dataset.kind) return;
  diveTo(card.dataset.kind);
  setGuide(false);          // 내려가는 모습을 봐야 하므로 도감은 걷는다
});
guideGrid.addEventListener('keydown', event => {
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.sp[data-kind]')) {
    event.preventDefault();
    diveTo(event.target.dataset.kind); setGuide(false);
  }
});
const resetBtn = document.getElementById("btn-guide-reset");
let armTimer = null;
function disarmReset() {
  clearTimeout(armTimer);
  armTimer = null;
  resetBtn.textContent = T("g.reset");
  resetBtn.classList.remove("armed");
}
resetBtn.onclick = () => {
  if (armTimer) {
    disarmReset();
    guideLog = {}; rareLog = {}; seenLog = {}; titleLog = {}; statLog = {}; saveGuide();
    guideLit = null;
    ocean.caught = 0;       // 조작줄의 집계도 같이 0 으로. 안 그러면 서로 다른 말을 한다
    catchCard.hidden = true;
    paintGuide();
    return;
  }
  resetBtn.textContent = T("g.resetSure");
  resetBtn.classList.add("armed");
  armTimer = setTimeout(disarmReset, 3000);
};

guideBtn.onclick = () => setGuide(guideWrap.hidden);
document.getElementById("btn-guide-close").onclick = () => setGuide(false);
guideWrap.addEventListener("pointerdown", e => { if (e.target === guideWrap) setGuide(false); });

const catchCard = document.getElementById("catch");
const catchX = () =>
  `<button class="catch-x" type="button" data-close-catch aria-label="${T("n.dismiss")}">&times;</button>`;
let catchTimer = null, titleTimer = null;
const CATCH_HOLD = 7000;
const RARE_HOLD = 13000;

function landed(being) {
  const id = being.guideId;
  const first = !guideLog[id];
  guideLog[id] = (guideLog[id] || 0) + 1;
  if (being.rare) rareLog[id] = (rareLog[id] || 0) + 1;
  saveGuide();
  guideLit = id;
  const entry = GUIDE.find(e => guideId(e[0], e[1]) === id);
  if (!entry) return;
  const tag = being.rare ? T("n.rare") : first ? T("n.new") : T("n.caught");
  showNotice(entry, being.rare ? "rare" : first ? "first" : "", tag,
             being.rare ? "rare" : "all", being.rare ? RARE_HOLD : CATCH_HOLD);
  if (!guideWrap.hidden) paintGuide();     // 도감을 열어 둔 채로 낚았다면 그 자리에서 갱신
  clearTimeout(titleTimer);
  titleTimer = setTimeout(checkTitles, 3200);
}
const MISS_HOLD = 3600;
function missed(info) {
  info = {...info, name: info.name || spText(info.guideId)[0]};
  if (info.why === "snap") {
    statLog.snap = (statLog.snap || 0) + 1;
    saveGuide();
    clearTimeout(titleTimer);
    titleTimer = setTimeout(checkTitles, 3200);
  }
  catchCard.className = "catch-card catch-card--miss";
  catchCard.innerHTML = catchX() +
    `<span class="catch-bang miss" aria-hidden="true">!</span>` +
    `<p class="catch-tag miss">${T("n." + info.why)}</p>` +
    `<p class="tcard-name big miss">${info.name}</p>` +
    `<p class="tcard-note">${T("n." + info.why + "why")}</p>`;
  catchCard.hidden = false;
  clearTimeout(catchTimer);
  catchTimer = setTimeout(() => { catchCard.hidden = true; }, MISS_HOLD);
}
function showNotice(entry, flavour, tag, mode, hold) {
  catchCard.className = "catch-card" + (flavour ? " catch-card--" + flavour : "");
  const bang = (flavour === "rare" || flavour === "mega")
    ? `<span class="catch-bang" aria-hidden="true">!</span>` : "";
  catchCard.innerHTML = catchX() + bang +
    `<p class="catch-tag${flavour ? " " + flavour : ""}">${tag}</p>` +
    speciesCard(entry, false, mode) +
    `<p class="catch-more">${T("n.more")}</p>`;
  catchCard.hidden = false;
  clearTimeout(catchTimer);
  catchTimer = setTimeout(() => { catchCard.hidden = true; }, hold);
}
function showTitle(x, more) {
  const [name, note] = tiText(x[0]);
  catchCard.className = "catch-card catch-card--title";
  catchCard.innerHTML = catchX() +
    `<span class="catch-bang" aria-hidden="true">!</span>` +
    `<p class="catch-tag title">${T("n.title")}</p>` +
    `<p class="tcard-name big">${name}</p>` +
    `<p class="tcard-note">${note}</p>` +
    (more > 1 ? `<p class="catch-more">+${more - 1} &nbsp;&middot;&nbsp; ${T("n.more")}</p>`
              : `<p class="catch-more">${T("n.more")}</p>`);
  catchCard.hidden = false;
  clearTimeout(catchTimer);
  catchTimer = setTimeout(() => { catchCard.hidden = true; }, RARE_HOLD);
}
function showLure(more) {
  catchCard.className = "catch-card catch-card--mega";
  catchCard.innerHTML = catchX() +
    `<span class="catch-bang" aria-hidden="true">!</span>` +
    `<p class="catch-tag mega">${T("n.lure")}</p>` +
    `<p class="tcard-name big">${T("lure.name")}</p>` +
    `<p class="tcard-note">${T("lure.on")}</p>` +
    (more > 1 ? `<p class="catch-more">+${more - 1} &nbsp;&middot;&nbsp; ${T("n.more")}</p>`
              : `<p class="catch-more">${T("n.more")}</p>`);
  catchCard.hidden = false;
  clearTimeout(catchTimer);
  catchTimer = setTimeout(() => { catchCard.hidden = true; }, RARE_HOLD);
}
function showTrophy(st, more) {
  catchCard.className = "catch-card catch-card--title";
  catchCard.innerHTML = catchX() +
    `<span class="catch-bang" aria-hidden="true">!</span>` +
    `<p class="catch-tag title">${T("n.trophy")}</p>` +
    `<div class="trophy trophy--t${st.tier}" data-award="${st.track}" data-tier="${st.tier}">` +
      TROPHY_SVG("trophy-cup") +
      `<p class="trophy-name">${T("tr." + st.track)} &middot; ${T("tr.t" + st.tier)}</p>` +
      `<p class="trophy-count">${st.now}</p>` +
      `<p class="trophy-next">${st.next === null ? T("tr.top") : T("tr.next").replace("%", st.next)}</p>` +
    `</div>` +
    (more > 1 ? `<p class="catch-more">+${more - 1} &nbsp;&middot;&nbsp; ${T("n.more")}</p>`
              : `<p class="catch-more">${T("n.more")}</p>`);
  catchCard.hidden = false;
  clearTimeout(catchTimer);
  catchTimer = setTimeout(() => { catchCard.hidden = true; }, RARE_HOLD);
}

const awardWrap = document.getElementById("award");
let awardReturnFocus = null;
function openAward(track, tier) {
  if (awardWrap.hidden) awardReturnFocus = document.activeElement;
  const spec = TROPHIES.find(x => x[0] === track);
  if (!spec) return;
  tier = Math.max(1, Math.min(spec[1].length, +tier || 1));
  const st = trophyState(tally()).find(x => x.track === track);
  awardWrap.innerHTML =
    `<div class="award-card award--t${tier}" role="dialog" aria-modal="true">` +
      `<div class="award-burst" aria-hidden="true"></div>` +
      `<div class="award-cup">${TROPHY_SVG("")}</div>` +
      `<p class="award-tag">${T("aw.congrats")}</p>` +
      `<p class="award-name">${T("tr." + track)} &middot; ${T("tr.t" + tier)}</p>` +
      `<p class="award-count">${st ? st.now : spec[1][tier - 1]}<i>${T("aw.unit")}</i></p>` +
      `<p class="award-note">${T("tr.need").replace("%", spec[1][tier - 1])}</p>` +
      `<button class="award-close" type="button">${T("aw.close")}</button>` +
    `</div>`;
  awardWrap.hidden = false;
  const shut = awardWrap.querySelector(".award-close");
  if (shut) shut.focus();
}
function closeAward() {
  const wasOpen = !awardWrap.hidden;
  awardWrap.hidden = true; awardWrap.innerHTML = "";
  if (wasOpen && awardReturnFocus?.isConnected) awardReturnFocus.focus();
}
awardWrap.addEventListener("click", e => {
  if (e.target === awardWrap || e.target.closest(".award-close")) closeAward();
});
function awardClick(e) {
  const hit = e.target.closest("[data-award]");
  if (!hit) return false;
  openAward(hit.dataset.award, hit.dataset.tier);
  return true;
}
document.addEventListener("keydown", e => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const hit = e.target && e.target.closest && e.target.closest("[data-award]");
  if (!hit) return;
  e.preventDefault();
  openAward(hit.dataset.award, hit.dataset.tier);
});
function spottedRare(being) {
  const id = being.guideId;
  rareLog[id] = (rareLog[id] || 0) + 1;
  saveGuide();
  guideLit = id;
  const entry = GUIDE.find(e => guideId(e[0], e[1]) === id);
  if (entry) showNotice(entry, "rare", T("n.raresight"), "rare", RARE_HOLD);
  if (!guideWrap.hidden) paintGuide();
  clearTimeout(titleTimer);
  titleTimer = setTimeout(checkTitles, 3200);
}
function sighted(kind) {
  if (seenLog[kind]) return;
  seenLog[kind] = 1;
  saveGuide();
  const entry = GUIDE.find(e => e[0] === kind);
  if (entry) showNotice(entry, "mega", T("n.mega"), "all", RARE_HOLD);
  if (!guideWrap.hidden) paintGuide();
  clearTimeout(titleTimer);
  titleTimer = setTimeout(checkTitles, 3200);
}
catchCard.onclick = e => {
  const hit = e && e.target && e.target.closest ? e.target : null;
  if (hit && hit.closest("[data-close-catch]")) {
    catchCard.hidden = true;
    clearTimeout(catchTimer);
    return;
  }
  const cup = hit && hit.closest("[data-award]");
  const miss = catchCard.classList.contains("catch-card--miss");
  catchCard.hidden = true;
  clearTimeout(catchTimer);
  if (cup) openAward(cup.dataset.award, cup.dataset.tier);
  else if (!miss) setGuide(true);
};

const langBtn = document.getElementById("btn-lang");
const keyStrip = document.getElementById("keystrip");

function paintLang() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll("[data-i18n]"))
    el.innerHTML = T(el.dataset.i18n);
  rodBtn.title = `${T("keys.rod")} (R)`;      rodBtn.setAttribute("aria-label", T("keys.rod"));
  subBtn.title = `${T("keys.sub")} (B)`;      subBtn.setAttribute("aria-label", T("keys.sub"));
  baitBtn.title = `${T("keys.bait")} (M)`;    baitBtn.setAttribute("aria-label", T("keys.bait"));
  guideBtn.title = `${T("g.title")} (D)`;     guideBtn.setAttribute("aria-label", T("g.title"));
  document.getElementById("btn-guide-close").setAttribute("aria-label", T("g.close"));
  helpBtn.setAttribute("aria-label", T("a.keys"));
  paintViewUI();
  document.querySelector(".guide-card").setAttribute("aria-label", T("g.title"));
  keyStrip.innerHTML = [
    ["Space", "keys.pause"], ["N", "keys.refresh"], ["T", "keys.water"],
    ["R", "keys.rod"], ["D", "keys.guide"], ["B", "keys.sub"],
    ["C", "keys.panel"], ["F", "keys.bare"],
  ].map(([k, v]) => `<kbd>${k}</kbd> ${T(v)}`)
   .concat(baitReady ? [`<kbd>M</kbd> ${T("keys.bait")}`] : [])
   .join(" &nbsp; ");
  langBtn.textContent = T("ui.langOther");
  paintPanel(!document.body.classList.contains("panel-off"));
  setPaused(paused);
  disarmReset();
  if (!guideWrap.hidden) paintGuide(); else paintTabs();
  if (ocean) {
    layoutGauge();     // 계기 옆 층 이름표도 말을 따른다
    zoneEl.textContent = T("zone." + zoneName((Math.round(cam) + rows / 2) / depth));
  }
}
function setLang(next) {
  setLanguageState(next);
  try { localStorage.setItem(LANG_KEY, lang); } catch { /* Storage/fullscreen may be unavailable. */ }
  paintLang();
}
langBtn.onclick = () => setLang(lang === "ko" ? "en" : "ko");

addEventListener("resize", () => rebuildSoon(200));

const loading = document.getElementById('sea-loading');
const loadingLabel = document.getElementById('sea-loading-label');
const loadingProgress = document.getElementById('sea-loading-progress');
const retryButton = document.getElementById('sea-retry');
const viewButton = document.getElementById('btn-view');
let preferredMode = loadViewMode();
let modelProgress = { loaded: 0, total: 21 };

function paintViewUI() {
  if (!renderer) return;
  const { mode, requestedMode, status } = renderer;
  canvas2d.hidden = mode !== '2d'; canvas3d.hidden = mode !== '3d';
  document.body.dataset.view = mode;
  const titlePrefix = mode === '2d' ? 'ASCII' : 'Animated';
  document.getElementById('sea-title-prefix').textContent = titlePrefix;
  document.title = 'At Sea — ' + titlePrefix + ' Tropical Sea';
  canvas.setAttribute('aria-label', T('view.' + mode));
  document.querySelector('main.sea').setAttribute('aria-label', T('view.' + mode));
  const switching = requestedMode === '3d' && status === 'loading';
  const target = switching || mode === '3d' ? '2d' : '3d';
  viewButton.dataset.viewMode = target;
  viewButton.textContent = target.toUpperCase();
  viewButton.setAttribute('aria-busy', String(switching));
  const action = T(switching ? 'view.cancel' : 'view.switch' + target);
  viewButton.setAttribute('aria-label', action);
  viewButton.title = action;
  loading.hidden = requestedMode !== '3d' || (status !== 'loading' && status !== 'error');
  loading.querySelector('h1').textContent = T(status === 'error' ? 'view.error' : 'view.loading');
  loadingLabel.textContent = status === 'error' ? T('view.fallback') : modelProgress.loaded + ' / ' + modelProgress.total;
  loadingProgress.hidden = status !== 'loading';
  loadingProgress.max = modelProgress.total;
  loadingProgress.value = modelProgress.loaded;
  loadingProgress.setAttribute('aria-label', T('view.loading'));
  retryButton.hidden = status !== 'error';
  retryButton.textContent = T('view.retry');
}

async function setRenderMode(mode, persist = true) {
  const current = renderer;
  const success = await current.setMode(mode);
  if (success && renderer === current && current.mode === mode && current.requestedMode === mode && persist) {
    preferredMode = mode;
    saveViewMode(mode);
  }
  return success;
}
viewButton.onclick = () => setRenderMode(viewButton.dataset.viewMode);

function showFailure(error) {
  ready = false; failed = true;
  cancelAnimationFrame(rafId);
  loading.hidden = false;
  loading.querySelector('h1').textContent = T('view.error');
  loadingLabel.textContent = T('view.fallback');
  loadingProgress.hidden = true; retryButton.hidden = false;
  console.error('At Sea:', error);
}

function start() {
  cancelAnimationFrame(rafId);
  renderer?.dispose();
  renderer = new ViewManager({
    ascii: new AsciiRenderer(canvas2d),
    create3d: async () => {
      const { SeaRenderer } = await import('./render/sea-renderer.js');
      return new SeaRenderer(canvas3d);
    },
    onChange: () => { paintViewUI(); refreshSpeciesArtwork(); },
    onStatus: (_status, progress) => { if (progress) modelProgress = progress; paintViewUI(); },
    onError: error => console.warn('At Sea: continuing in ASCII 2D.', error),
  });
  ready = true; failed = false; last = performance.now();
  if (!ocean) {
    paintPanel(loadPanel());
    build();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) setPaused(true);
  } else resizeRenderers();
  paintLang(); refreshMegaLure(); paintViewUI(); refreshSpeciesArtwork();
  schedule();
  setRenderMode(preferredMode, false);
}
retryButton.onclick = () => { if (failed) start(); else setRenderMode('3d'); };
canvas3d.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  if (ready && !renderer.disposed) renderer.fail3d(new Error('WebGL context lost'));
});
canvas3d.addEventListener('webglcontextrestored', () => {
  if (ready && renderer.requestedMode === '3d' && renderer.status === 'error') setRenderMode('3d', false);
});
addEventListener('pagehide', () => { ready = false; cancelAnimationFrame(rafId); renderer?.dispose(); });
addEventListener('pageshow', event => { if (event.persisted) start(); });
// Re-measure without rebuilding an unchanged sea or calculating depth from new rows.
if (document.fonts?.ready) document.fonts.ready.then(() => { if (ready) build(); });

if (import.meta.env.DEV || import.meta.env.VITE_E2E === 'true') {
  const snapshot = () => ({ready,failed,renderMode:renderer?.mode,requestedRenderMode:renderer?.requestedMode,rendererStatus:renderer?.status,motion,cam,camTarget,depth,rows,cols,depthFraction:depthFrac(),paused,waterOn,redTide,clock,lang,rodLit,baitReady,
    counts:ocean ? Object.fromEntries(Object.entries(ocean.groups).map(([kind,list])=>[kind,list.length])) : {},
    guideLog:{...guideLog},rareLog:{...rareLog},statLog:{...statLog},titleLog:{...titleLog},seenLog:{...seenLog},
    rod:ocean?.rod ? {state:ocean.rod.state,x:ocean.rod.x,tip:ocean.rod.tip,stop:ocean.rod.stop,catch:ocean.rod.catch?.guideId,mark:ocean.rod.mark?.guideId} : null,
    subCount:ocean?.subs.length || 0, renderer: renderer?.getStats?.() || null});
  window.__ATSEA__ = { getState:snapshot, snapshot, getOcean:()=>ocean, setRenderMode, setPaused, restock, setLang, castRod, toggleSub, scatterBait,
    diveToFraction:f=>{ camTarget=Math.max(0,Math.min(1,f))*Math.max(0,depth-rows); },
    step:milliseconds=>{ const target=last+milliseconds; while(last<target) frame(Math.min(target,last+50),false); },
    recordCatch:({kind='fish',shapeIndex=0,rare=false}={})=>{landed({kind,shapeIndex,guideId:guideId(kind,shapeIndex),rare});checkTitles();},
    sightRareShark:()=>{spottedRare({guideId:'shark'});checkTitles();},
  };
}
start();
