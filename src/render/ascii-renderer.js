import { ASCII_DATA as ART } from './ascii-data.js';
import { DATA, SPECIES, LURE, ROD, CHOMP, RARE_COLOR, MEGA_COLOR } from '../game/ocean.js';
import { waterColor } from './water.js';

const MIRROR = Object.fromEntries([...ART.mirrorTable.from].map((char, i) => [char, ART.mirrorTable.to[i]]));
const mirrored = new WeakMap();
export function flip(lines) {
  if (!mirrored.has(lines)) mirrored.set(lines, lines.map(line => [...line].reverse().map(c => MIRROR[c] || c).join('')));
  return mirrored.get(lines);
}

export function speciesArt(kind, shapeIndex = 0) {
  const family = SPECIES[kind]?.sizes || kind.toUpperCase();
  const variants = ART.shapes[family];
  return variants?.[shapeIndex] || variants?.[0] || [''];
}

export function beingArt(being, motion = 0) {
  let lines = speciesArt(being.kind, being.shapeIndex);
  if (being.kind === 'ray') {
    const frames = ART.flap.RAY[being.shapeIndex];
    const phase = (being.animationPhase || 0) / (Math.PI * 2) * frames.length;
    lines = frames[Math.floor((phase + motion * .1) % frames.length)];
  }
  const frames = ART.swim[SPECIES[being.kind]?.sizes];
  if (frames) {
    const rate = being.kind === 'shrimp' ? .4 : being.kind === 'crab' ? .28 : being.kind === 'whale' ? .08 : .16;
    const phase = (being.animationPhase || 0) / (Math.PI * 2) * frames.length;
    lines = frames[Math.floor((phase + motion * rate) % frames.length)];
  }
  return being.dir === -1 && being.spec.mirror ? flip(lines) : lines;
}

/** The original character compositor: spaces are transparent, sprite interiors can occlude. */
export class Grid {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.ch = Array.from({ length: h }, () => Array(w).fill(' '));
    this.co = Array.from({ length: h }, () => Array(w).fill(null));
  }
  reset() {
    for (let y = 0; y < this.h; y++) { this.ch[y].fill(' '); this.co[y].fill(null); }
  }
  draw(x, y, text, color) {
    x = Math.round(x); y = Math.round(y);
    if (y < 0 || y >= this.h) return;
    for (let i = 0; i < text.length; i++) {
      const xx = x + i;
      if (text[i] !== ' ' && xx >= 0 && xx < this.w) { this.ch[y][xx] = text[i]; this.co[y][xx] = color; }
    }
  }
  sprite(x, y, lines, color, opaque) {
    x = Math.round(x); y = Math.round(y);
    for (let row = 0; row < lines.length; row++) {
      const yy = y + row, line = lines[row];
      if (yy < 0 || yy >= this.h) continue;
      if (opaque) {
        const left = line.length - line.trimStart().length, right = line.trimEnd().length;
        for (let xx = Math.max(0, x + left); xx < Math.min(this.w, x + right); xx++) {
          this.ch[yy][xx] = ' '; this.co[yy][xx] = null;
        }
      }
      this.draw(x, yy, line, color);
    }
  }
}

const dotWord = word => Array.from({ length: 7 }, (_, row) => [...word]
  .map(char => ART.dotFont[char][row]).join('..').replace(/#/g, '█').replace(/\./g, ' '));
const redTop = dotWord('RED'), redBottom = dotWord('OCEAN');
const RED_BANNER = [...redTop.map(line => '       ' + line), ' '.repeat(redBottom[0].length), ...redBottom];
const RED_WIDTH = redBottom[0].length;
function drawRedOcean(grid, clock) {
  if (grid.w < RED_WIDTH + 2 || grid.h < RED_BANNER.length + 2) return;
  const x = Math.floor((grid.w - RED_WIDTH) / 2), y = Math.floor((grid.h - RED_BANNER.length) / 2);
  grid.sprite(x + 1, y + 1, RED_BANNER, '#5e0f0a');
  grid.sprite(x, y, RED_BANNER, ['#ff3b2f', '#ff6a55'][Math.floor(clock * 2) % 2], true);
}

// Visual sand uses its own deterministic noise, never the simulation's random stream.
const sands = new WeakMap();
function sandFor(ocean) {
  if (!sands.has(ocean)) {
    let seed = ocean.w * 7919 + ocean.depth;
    sands.set(ocean, Array.from({ length: ocean.w }, () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return '~^-._'[seed % 5];
    }).join(''));
  }
  return sands.get(ocean);
}

function drawLine(grid, line, cam, manual) {
  const color = manual ? ROD : '#bcbcbc';
  for (let y = Math.max(0, cam); y < Math.min(Math.floor(line.tip), cam + grid.h); y++) grid.draw(line.x, y - cam, '|', color);
  grid.draw(line.x, Math.floor(line.tip) - cam, 'J', manual ? (['on', 'shark'].includes(line.state) ? CHOMP : ROD) : '#ffffff');
  if (manual && line.mark && line.state !== 'up') {
    const mark = line.mark;
    grid.draw(mark.x + mark.w / 2, mark.y - 1 - cam, 'v', ROD);
  }
}

function pointAtMega(grid, ocean, cam, clock) {
  const meg = ocean.groups.megalodon[0];
  if (!meg) return;
  const above = meg.y + meg.h <= cam, below = meg.y >= cam + grid.h;
  if (!above && !below) return;
  const distance = above ? cam - (meg.y + meg.h) : meg.y - (cam + grid.h);
  const metres = Math.max(0, Math.round(distance / ocean.depth * DATA.maxDepth));
  const wing = (above ? '^' : 'v').repeat([9, 5][Math.floor(clock * 2) % 2]);
  const bar = `${wing} ${metres}m ${wing}`;
  const middle = Math.round(meg.x + meg.w / 2) - Math.floor(bar.length / 2);
  grid.sprite(Math.max(0, Math.min(Math.max(0, grid.w - bar.length), middle)), above ? 0 : grid.h - 1, [bar], MEGA_COLOR, true);
}

/** Read-only view of the shared Ocean. No entity, fishing, progression or clock updates. */
export function composeAsciiGrid(state, grid = new Grid(state.cols, state.rows)) {
  const { ocean, clock, motion = 0, redTide } = state, cam = Math.round(state.cam);
  const w = ocean.w;
  grid.reset();
  const wave = Math.floor(clock * 3) % 4;
  grid.draw(0, -cam, '~   '.repeat(Math.ceil(w / 4) + 2).slice(wave, wave + w), ART.single.surface);
  const beat = Math.floor(clock * 2.5);
  for (const weed of ocean.weeds) for (let i = 0; i < weed.h; i++) {
    grid.draw(weed.x, ocean.floorY - 1 - i - cam, (i + weed.phase + beat) % 2 === 0 ? '(' : ')', weed.color);
  }
  const floor = item => grid.sprite(item.x, ocean.floorY - item.h - cam, speciesArt(item.kind, item.shapeIndex), item.color, true);
  for (const item of ocean.floor) if (!item.creep) floor(item);
  grid.draw(0, ocean.floorY - cam, sandFor(ocean), ART.single.sand);
  for (const item of ocean.floor) if (item.creep) floor(item);
  for (const kind of ['fish', 'jelly', 'seahorse', 'lantern', 'squid', 'ray', 'angler', 'octopus', 'crab', 'shrimp', 'turtle', 'oarfish', 'dolphin', 'shark', 'whale', 'megalodon']) {
    for (const being of ocean.groups[kind]) {
      const lines = beingArt(being, motion);
      grid.sprite(being.x, being.y - cam, lines, being.color, being.spec.opaque);
      if (kind === 'angler') {
        const spot = lines[0].indexOf('o');
        if (spot >= 0) grid.draw(Math.round(being.x) + spot, being.y - cam, 'o', LURE);
      }
    }
  }
  for (const boat of ocean.subs) {
    const lines = beingArt(boat, motion);
    grid.sprite(boat.x, boat.y - cam, lines, boat.color, true);
    const nose = Math.round(boat.x) + (boat.dir === 1 ? boat.w : -1);
    const bow = lines.findIndex(line => /[<>]/.test(line));
    const middle = boat.y + (bow < 0 ? Math.floor(boat.h / 2) : bow) - cam;
    for (let d = 1; d < 28; d++) {
      const x = nose + d * boat.dir;
      if (d % 2) grid.draw(x, middle, '-', ART.single.beam);
      if (d > 5 && d % 3 === 0) { grid.draw(x, middle - 1, "'", ART.single.beam); grid.draw(x, middle + 1, '.', ART.single.beam); }
    }
  }
  if (ocean.line) drawLine(grid, ocean.line, cam, false);
  if (ocean.rod) drawLine(grid, ocean.rod, cam, true);
  for (const bubble of ocean.bubbles) {
    const y = Math.round(bubble.y), x = Math.round(bubble.x);
    if (x >= 0 && x < w) grid.draw(x, y - cam, ART.BUBBLE_CHARS[(y + x) % 3], ART.single.bubble);
  }
  for (const alarm of ocean.alarms) {
    const fish = alarm.fish, angry = alarm.mood === 'angry';
    const lines = angry ? ART.ANGRY_CLOUD : ART.ALARM_FRAMES;
    const y = Math.max(cam, fish.y + Math.floor(fish.h / 2) - lines.length);
    const cx = angry ? fish.x + (fish.dir === 1 ? fish.w - 6 : 5) : fish.x + fish.w / 2;
    grid.sprite(Math.round(cx) - Math.floor(lines[0].length / 2), y - cam, lines, angry ? CHOMP : ART.single.alarm, true);
  }
  for (const chomp of ocean.chomps) grid.sprite(chomp.x, chomp.y - cam, ART.CHOMP_FRAMES[Math.min(2, Math.floor(chomp.age / 6))], CHOMP, true);
  if (ocean.bait) grid.draw(ocean.bait.x - 2, Math.round(ocean.bait.y) - cam, ART.BAIT_CHARS[Math.floor(clock * 6) % 3], LURE);
  pointAtMega(grid, ocean, cam, clock);
  if (redTide) drawRedOcean(grid, clock);
  return grid;
}

export class AsciiRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.frames = 0;
    this.bandLit = 0;
  }
  init() { this.ready = true; }
  resize(layout) {
    this.layout = layout;
    this.dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(layout.width * this.dpr);
    this.canvas.height = Math.round(layout.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.grid = new Grid(layout.cols, layout.rows);
  }
  render(state) {
    if (!this.ready || !this.layout) return;
    const { cols, rows, cw, chh, width, height, fontSize } = this.layout;
    const { depth, waterOn, redTide, paused, dt } = state, cam = Math.round(state.cam);
    const grid = composeAsciiGrid(state, this.grid), ctx = this.ctx;
    ctx.textBaseline = 'top';
    ctx.font = `${fontSize}px "IBM Plex Mono", ui-monospace, monospace`;
    let lureSeen = false;
    for (let y = 0; y < rows; y++) {
      ctx.fillStyle = waterOn ? waterColor((cam + y) / depth, redTide) : '#01050b';
      ctx.fillRect(0, y * chh, width, chh);
      let run = '', ink = null, start = 0;
      for (let x = 0; x <= cols; x++) {
        const color = x < cols ? grid.co[y][x] : null;
        if (color !== ink || x === cols) {
          if (run.trim() && ink) {
            ctx.fillStyle = ink;
            if (ink === LURE) { ctx.shadowColor = ink; ctx.shadowBlur = 14; lureSeen = true; }
            else if (ink === RARE_COLOR || ink === MEGA_COLOR) { ctx.shadowColor = ink; ctx.shadowBlur = ink === RARE_COLOR ? 20 : 13; }
            const passes = ink === RARE_COLOR ? 4 : ink === MEGA_COLOR ? 3 : 1;
            for (let pass = 0; pass < passes; pass++) ctx.fillText(run, start * cw, y * chh);
            ctx.shadowBlur = 0;
          }
          run = ''; ink = color; start = x;
        }
        if (x < cols) run += grid.ch[y][x];
      }
    }
    const bandHeight = Math.max(4, height - rows * chh), bandY = height - bandHeight;
    if ((cam + rows / 2) / depth >= .8 && lureSeen) this.bandLit = 1;
    else if (!paused) this.bandLit = Math.max(0, this.bandLit - dt);
    ctx.fillStyle = waterOn ? waterColor((cam + rows) / depth, redTide) : '#01050b';
    ctx.fillRect(0, bandY, width, bandHeight);
    if (this.bandLit > 0) {
      ctx.globalAlpha = this.bandLit * .5; ctx.fillStyle = LURE;
      ctx.fillRect(0, bandY, width, bandHeight); ctx.globalAlpha = 1;
    }
    this.frames++;
  }
  getStats() { return { frames: this.frames, pixelRatio: this.dpr }; }
  dispose() { this.ready = false; this.grid = null; }
}
