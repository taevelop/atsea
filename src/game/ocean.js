import { DATA } from './data.js';
import { normalizeSetting, normalizePopulation } from './limits.js';

const LURE = '#fff700', CHOMP = '#ff5f5f', ROD = '#ffaf00';
const SPEED_DEFAULT = 20, GRACE = 21, HOLD_TIME = 84, HOOK_RATE = .70;
const CHOMP_HOLD = 6, CHOMP_LIFETIME = 3 * CHOMP_HOLD, CHEW_TIME = 56, ALARM_TIME = CHEW_TIME;
const RARE_CHANCE = .006, RARE_COLOR = '#f2fbff', FLEE_FLOOR = .40;
const MEGA_CHANCE = .003, BAIT_LIFE = 90, MEGA_COLOR = '#a8e6ff';
const CATCHABLE = ['angler','ray','octopus','squid','jelly','seahorse','lantern','fish','crab','shrimp','oarfish'];
const SIGHT_ONLY = ['turtle', 'dolphin', 'whale'];
const RARE_KINDS = new Set([...CATCHABLE,'shark',...SIGHT_ONLY]);
const rnd = (a,b) => a + Math.random() * (b-a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const guideId = (kind,shapeIndex) => kind === 'fish' ? 'fish'+shapeIndex : kind;
class Chomp { constructor(x,y) { this.x=x-2; this.y=y-1; this.age=0; } step(u) { this.age+=u; return this.age < CHOMP_LIFETIME; } }
class Alarm { constructor(fish,life=ALARM_TIME,mood) { this.fish=fish; this.age=0; this.life=life; this.mood=mood; } step(u) { this.age+=u; return this.age<this.life; } }

const SPECIES = {
  turtle:   {sizes:"TURTLE", colors:"TURTLE", band:[.04,.38], speed:[.07,.14], mirror:1, bubble:0, opaque:1, drift:[.010,.025], turn:.001},
  crab:     {sizes:"CRAB", colors:"CRAB", band:[.72,.98], speed:[.05,.12], mirror:0, bubble:0, opaque:1, drift:[.015,.035], turn:.002},
  shrimp:   {sizes:"SHRIMP", colors:"SHRIMP", band:[.45,.95], speed:[.14,.28], mirror:1, bubble:0, opaque:1, drift:[.018,.045], turn:.004},
  dolphin:  {sizes:"DOLPHIN", colors:"DOLPHIN", band:[.02,.32], speed:[.20,.34], mirror:1, bubble:.002, opaque:1, drift:[.012,.030], turn:.001},
  whale:    {sizes:"WHALE", colors:"WHALE", band:[.08,.55], speed:[.07,.13], mirror:1, bubble:.002, opaque:1, drift:[.007,.018], turn:.0005},
  oarfish:  {sizes:"OARFISH", colors:"OARFISH", band:[.62,.94], speed:[.025,.065], mirror:1, bubble:0, opaque:1, drift:[.008,.022], turn:.0005},
  fish:     {sizes:"FISH",     colors:"FISH",     band:[0,.92],   speed:[.30,.85], mirror:1, bubble:.012, small:1, drift:[.010,.045], turn:.006},
  lantern:  {sizes:"LANTERN",  colors:"LANTERN",  band:[.40,1],   speed:[.35,.75], mirror:1, bubble:0,    small:1, drift:[.010,.045], turn:.006},
  shark:    {sizes:"SHARK",    colors:"SHARK",    band:[0,1],     speed:[.16,.32], mirror:1, bubble:.004, opaque:1, drift:[.008,.025], turn:.002},
  jelly:    {sizes:"JELLYFISH",colors:"JELLYFISH",band:[.02,.65], speed:[.04,.12], mirror:0, bubble:0,    opaque:1, drift:[.02,.06],   turn:0},
  seahorse: {sizes:"SEAHORSE", colors:"SEAHORSE", band:[.28,.78], speed:[.05,.13], mirror:1, bubble:.008, opaque:1, drift:[.010,.030], turn:0},
  squid:    {sizes:"SQUID",    colors:"SQUID",    band:[.32,.88], speed:[.08,.18], mirror:0, bubble:.003, opaque:1, drift:[.050,.120], turn:0},
  angler:   {sizes:"ANGLER",   colors:"ANGLER",   band:[.93,1],   speed:[.05,.11], mirror:1, bubble:.002, opaque:1, drift:[.008,.022], turn:0},
  octopus:  {sizes:"OCTOPUS",  colors:"OCTOPUS",  band:[.90,1],   speed:[.06,.14], mirror:0, bubble:.006, opaque:1, drift:[.008,.020], turn:.002},
  ray:      {sizes:"RAY",      colors:"RAY",      band:[.20,.85], speed:[.10,.20], mirror:1, bubble:.004, opaque:1, drift:[.035,.075], turn:.0006},
  sub:      {sizes:"SUB",      colors:"SUB",      band:[0,1],     speed:[.40,.60], mirror:1, bubble:.25,  opaque:1, drift:null,        turn:0},
  megalodon:{sizes:"MEGALODON",colors:"MEGALODON",band:[.15,.95],speed:[.09,.17], mirror:1, bubble:.010, opaque:1, drift:[.004,.012], turn:.001},
};
class Being {
  constructor(kind, w, depth, offscreen) {
    const s = SPECIES[kind];
    this.kind = kind; this.spec = s;
    const variants = DATA.sizes[s.sizes];
    const fits = variants.filter(size => size.h <= Math.max(1, depth - 4) && size.w <= w);
    const shape = !fits.length
      ? variants.reduce((a, b) => (b.h < a.h ? b : a))
      : (kind === "sub" || kind === "megalodon") ? fits.reduce((a, b) => (b.w > a.w ? b : a))
      : pick(fits);
    this.shapeIndex = Math.max(0, variants.indexOf(shape));
    this.guideId = guideId(kind, this.shapeIndex);
    this.dir = Math.random() < .5 ? 1 : -1;
    this.h = shape.h;
    this.w = shape.w;
    this.animationPhase = Math.random() * Math.PI * 2;
    this.rare = RARE_KINDS.has(kind) && Math.random() < RARE_CHANCE;
    this.color = this.rare ? RARE_COLOR : pick(DATA.colors[s.colors]);
    this.speed = rnd(s.speed[0], s.speed[1]) * (s.small && this.h === 1 ? 1.8 : 1);
    this.rush = 0;
    const [lo, hi] = this.range(depth);
    this.y = Math.floor(rnd(lo, hi + 1));
    this.x = offscreen ? (this.dir === 1 ? -this.w : w) : Math.floor(rnd(0, Math.max(1, w - this.w)));
    this.yf = this.y;
    this.top = lo; this.bottom = hi;
    this.hooked = false;
    this.vdir = Math.random() < .5 ? 1 : -1;
    this.vspeed = s.drift ? rnd(s.drift[0], s.drift[1]) : 0;
    this.turnChance = s.turn === undefined ? .006 : s.turn;
    this.chew = 0;          // 그 자리에 멈춰 있는 시간
  }
  range(depth) {
    const first = 1, last = Math.max(1, depth - 3 - this.h);
    const b = this.spec.band;
    const lo = first + Math.floor((last - first) * b[0]);
    const hi = first + Math.floor((last - first) * b[1]);
    return [lo, Math.max(lo, Math.min(hi, last))];
  }
  turn(d) { this.dir = d; }
  step(u) {
    if (this.chew > 0) {
      this.chew = Math.max(0, this.chew - u);
      return;
    }
    if (this.hooked) return;
    const sp = this.rush ? Math.max(this.speed, FLEE_FLOOR) : this.speed;
    this.x += this.dir * sp * (1 + 3 * this.rush) * u;
    if (this.rush) this.rush = Math.max(0, this.rush - .02 * u);
    if (!this.vspeed) return;
    this.yf += this.vdir * this.vspeed * u;
    if (this.yf <= this.top || this.yf >= this.bottom) {
      this.vdir = -this.vdir;
      this.yf = Math.min(Math.max(this.yf, this.top), this.bottom);
    } else if (Math.random() < this.turnChance * u) {
      this.vdir = -this.vdir;
    }
    this.y = Math.round(this.yf);
  }
  gone(w) { return this.dir === 1 ? this.x > w : this.x + this.w < 0; }
}

class FishingLine {
  constructor(w, depth, cam, view) {
    this.x = 2 + Math.floor(Math.random() * Math.max(1, w - 4));
    this.tip = 0;
    const low = cam + view * .2;
    const high = Math.min(cam + view * .85, depth - 3);
    this.stop = rnd(low, Math.max(low + 1, high));
    this.state = "down";
    this.wait = rnd(90, 200);
    this.catch = null;
    this.mark = null;
  }
  step(u, ocean) {
    if (this.state === "down") {
      this.tip = Math.min(this.stop, this.tip + .6 * u);
      if (this.tip >= this.stop) this.state = "wait";
    } else if (this.state === "wait") {
      this.bite(ocean, u);
      this.wait -= u;
      if (this.wait <= 0 || this.catch) this.state = "up";
    } else {
      this.tip -= .75 * u;
      if (this.catch) {
        this.catch.x = this.x - this.catch.w / 2;
        this.catch.yf = this.tip - this.catch.h / 2;
        this.catch.y = Math.round(this.catch.yf);
      }
      if (this.tip <= 0) return false;
    }
    return true;
  }
  onBody(f) {
    return this.x >= f.x - 1 && this.x <= f.x + f.w + 1 &&
           this.tip >= f.y - 1 && this.tip <= f.y + f.h + 1;
  }
  gapTo(f) {
    const dx = Math.max(f.x - this.x, 0, this.x - (f.x + f.w - 1));
    const dy = Math.max(f.y - this.tip, 0, this.tip - (f.y + f.h - 1));
    return dx + dy * 2;
  }
  aimedAt(ocean) {
    let near = null, nearGap = null;
    for (const kind of CATCHABLE) {
      const flock = ocean.groups[kind];
      if (!flock) continue;
      let on = null, onGap = 0;
      for (const f of flock) {
        if (f.hooked || f.chew > 0) continue;   // 상어에게 물린 것은 건드리지 않는다
        const gap = this.gapTo(f);
        if (this.onBody(f)) {
          if (on === null || gap < onGap) { on = f; onGap = gap; }
        } else if (gap < 45 && (nearGap === null || gap < nearGap)) { near = f; nearGap = gap; }
      }
      if (on) return {f: on, on: true};
    }
    return {f: near, on: false};
  }
  release() {
    const f = this.mark;
    if (f && f.band0) { f.top = f.band0[0]; f.bottom = f.band0[1]; f.band0 = null; }
    this.mark = null;
  }
  bite(ocean, u) {
    if (this.catch) return;
    const cur = this.mark;
    const held = cur && !cur.hooked && cur.chew <= 0 && this.gapTo(cur) < 45;
    const pick = this.aimedAt(ocean);
    const onCur = !!cur && this.onBody(cur);
    if ((!held || (pick.on && !onCur)) && pick.f !== cur) {
      this.release();
      this.mark = pick.f;
      if (pick.f) {   // 미끼를 물러 오는 동안은 제 서식 구간을 벗어나도 둔다
        pick.f.band0 = [pick.f.top, pick.f.bottom];
        pick.f.top = Math.min(pick.f.top, Math.floor(this.tip) - 1);
        pick.f.bottom = Math.max(pick.f.bottom, Math.floor(this.tip) + 1);
      }
    }
    const f = this.mark;
    if (!f) return;
    const cx = f.x + f.w / 2, cy = f.y + f.h / 2;
    const dx = this.x - cx;
    if (dx > 1) f.turn(1); else if (dx < -1) f.turn(-1);
    const pull = Math.max(.22, f.speed) * u;
    f.x += Math.max(-pull, Math.min(pull, dx));
    f.yf += Math.max(-.4, Math.min(.4, (this.tip - cy) * .25)) * u;
    f.y = Math.round(f.yf);
    if (!this.manual &&
        Math.abs(cx - this.x) <= 2 && Math.abs(cy - this.tip) <= 1) {
      f.hooked = true;
      this.catch = f;
    }
  }
}
const ROD_DOWN = 2.6, ROD_UP = 3.0;

class Rod extends FishingLine {
  constructor(w, depth, cam, view, x, y) {
    super(w, depth, cam, view);
    this.w = w;
    this.depth = depth;
    this.x = x === undefined ? Math.floor(w / 2) : Math.floor(x);
    this.stop = y === undefined ? cam + Math.floor(view / 2) : y;
    this.top0 = Math.max(0, cam);
    this.tip = this.top0;
    this.state = "cast";
    this.grace = 0;
    this.hold = 0;               // 걸어 놓은 것을 쥐고 있는 남은 프레임
    this.foe = null;             // 미끼를 문 상어. 물리면 이 캐스팅은 끝난 것이다
    this.manual = true;          // 저절로 걸리지 않는다. 누름 한 번이 곧 챔질이다
  }
  aim(x, y) {
    if (this.state === "up" || this.state === "shark" || this.state === "on") return;
    this.x = Math.max(0, Math.min(this.w - 1, Math.floor(x)));
    this.stop = Math.max(1, Math.min(this.depth - 2, y));
  }
  strike() {
    if (this.state === "on") { this.state = "up"; return; }
    if (this.state === "cast" || this.state === "shark") this.struck = true;
  }
  atBait() {
    const m = this.mark;
    return m && !m.hooked && m.chew <= 0 && this.gapTo(m) <= 1 ? m : null;
  }
  jawNear(s) {
    const hx = s.x + (s.dir === 1 ? s.w - 1 : 0);
    const hy = s.y + Math.floor(s.h / 2);
    return Math.abs(this.x - hx) <= 6 && Math.abs(this.tip - hy) <= 2;
  }
  sharkOnBait(ocean) {
    for (const s of ocean.groups.shark) if (this.jawNear(s)) return s;
    return null;
  }
  step(u, ocean) {
    if (this.state === "cast") {
      const gap = this.stop - this.tip;
      const settled = Math.abs(gap) < 1.5;
      const prey = this.struck && settled ? this.atBait() : null;
      this.tip += Math.max(-ROD_UP * u, Math.min(ROD_DOWN * u, gap));
      if (settled) {
        const foe = this.sharkOnBait(ocean);
        if (foe) {
          this.release();
          this.foe = foe;
          this.state = "shark";
          this.grace = GRACE;
          ocean.alarms.push(new Alarm(foe, GRACE, "angry"));
          return true;
        }
        this.bite(ocean, u);
      }
      if (!this.struck) return true;
      this.struck = false;
      if (!prey) { this.state = "up"; return true; }
      if (Math.random() < HOOK_RATE) {
        prey.hooked = true;
        this.catch = prey;
        this.state = "on";
        this.hold = HOLD_TIME;
        ocean.alarms.push(new Alarm(prey, HOLD_TIME));
        return true;
      }
      for (let b = 0; b < 6; b++)
        ocean.bubbles.push({x: this.x + rnd(-1, 1), y: Math.floor(this.tip), s: rnd(.3, .6)});
      prey.rush = 1;
      ocean.missed = {guideId: prey.guideId, why: "miss"};
      this.release();
      this.state = "up";
      this.missAt = ocean.now;
      return true;
    }
    if (this.state === "shark") {
      const foe = this.foe;
      this.x = Math.max(0, Math.min(this.w - 1,
                                    Math.round(foe.x + (foe.dir === 1 ? foe.w - 1 : 0))));
      this.grace -= u;
      const cut = this.struck;                  // 챔질했는가
      if (!cut && this.grace > 0) return true;
      this.struck = false;
      this.foe = null;
      if (cut) foe.rush = 1;                    // 한 번 크게 젓고 사라진다
      for (let b = 0; b < (cut ? 10 : 5); b++)
        ocean.bubbles.push({x: this.x + rnd(-2, 2), y: Math.floor(this.tip), s: rnd(.3, .7)});
      ocean.missed = {guideId: foe.guideId, why: cut ? "snap" : "stolen"};
      return false;                             // 끊어진 줄은 감을 것도 없다
    }
    if (this.state === "on") {
      const gap = this.stop - this.tip;
      this.tip += Math.max(-ROD_UP * u, Math.min(ROD_DOWN * u, gap));
      this.catch.x = this.x - this.catch.w / 2;   // 바늘에 걸린 채 버둥거린다
      this.hold -= u;
      if (this.hold <= 0) {                       // 너무 오래 뒀다. 미끼만 털고 빠진다
        for (let b = 0; b < 9; b++)
          ocean.bubbles.push({x: this.x + rnd(-1, 1), y: Math.floor(this.tip), s: rnd(.25, .6)});
        this.catch.hooked = false;
        this.catch.rush = 1;
        ocean.missed = {guideId: this.catch.guideId, why: "late"};
        this.catch = null;
        this.release();
        this.state = "up";
        this.missAt = ocean.now;
      }
      return true;
    }
    this.tip -= ROD_UP * u;
    if (this.catch) {
      this.catch.x = this.x - this.catch.w / 2;
      this.catch.yf = this.tip - this.catch.h / 2;
      this.catch.y = Math.round(this.catch.yf);
    }
    return this.tip > Math.min(this.top0, ocean.viewTop || 0);
  }
}

class Ocean {
  constructor(w, depth, viewH) {
    this.w = w; this.depth = depth;
    this.floorY = depth - 1;
    this.room = Math.max(3, Math.min(10, Math.round(depth / 6)));
    const stock = (kind, perScreen, lowest = 1) => {
      const [lo, hi] = SPECIES[kind].band;
      const rows = Math.max(1, (hi - lo) * depth);
      return Math.max(lowest, Math.round(perScreen * rows / Math.max(1, viewH)));
    };
    const counts = {
      fish:     stock("fish", w / 2.6, 12),
      shark:    stock("shark", 0.85),
      jelly:    stock("jelly", 2.4),
      seahorse: Math.max(1, Math.min(5, Math.round(w / 30))),
      squid:    stock("squid", 2.6),
      angler:   stock("angler", 12.0),
      lantern:  stock("lantern", w / 5.5),
      octopus:  stock("octopus", 8.0),
      ray:      stock("ray", 1.6),
      turtle:   stock("turtle", .7),
      crab:     stock("crab", 1.8),
      shrimp:   stock("shrimp", 1.5),
      dolphin:  stock("dolphin", .6),
      whale:    stock("whale", .35),
      oarfish:  stock("oarfish", .6),
      megalodon: 0,          // 처음에는 없다. 상어가 태어날 때 아주 드물게 온다
    };
    this.groups = {};
    for (const kind of Object.keys(counts)) counts[kind] = normalizePopulation(kind, counts[kind]);
    for (const [kind, n] of Object.entries(counts)) {
      const sizes = DATA.sizes[SPECIES[kind].sizes];
      const fits = sizes.some(size => size.h <= Math.max(1, depth - 4) && size.w <= w);
      this.groups[kind] = fits ? Array.from({length: n}, () => new Being(kind, w, depth)) : [];
    }
    this.seed = {};
    for (const [kind, list] of Object.entries(this.groups)) this.seed[kind] = list.length;
    this.base = counts.fish;
    const slow = [].concat(this.groups.jelly, this.groups.seahorse,
                           this.groups.squid, this.groups.angler, this.groups.octopus);
    slow.sort(() => Math.random() - .5);
    slow.forEach((b, i) => { b.x = i * (w / slow.length) + rnd(0, Math.max(0, w / slow.length - b.w)); });

    this.subs = [];
    this.bubbles = [];
    this.bait = null;        // 뿌려 놓은 특별 먹이
    this.chomps = [];
    this.alarms = [];
    this.pending = null;     // [먹힐 물고기, 남은 프레임]
    this.line = null;
    this.nextLine = rnd(6, 18);
    this.rod = null;             // 사용자가 직접 쥐는 낚싯대
    this.caught = 0;
    this.landed = null;          // 방금 손으로 올린 것. 화면이 받아 가면 비운다
    this.missed = null;          // 방금 놓친 것. 마찬가지로 화면이 받아 간다
    this.nextMeal = rnd(6, 11);
    this.now = 0;
    this.weeds = [];
    this.setWeeds(Math.max(2, Math.round(w / 12)));
    this.floor = this.buildFloor();
  }
  makeWeed() {
    return {
      x: 1 + Math.floor(Math.random() * Math.max(1, this.w - 2)),
      h: 3 + Math.floor(Math.random() * Math.max(1, Math.min(9, this.room))),
      phase: Math.random() < .5 ? 0 : 1,
      color: pick(DATA.colors.SEAWEED),
    };
  }
  setWeeds(n) {
    n = normalizeSetting('seaweed', n, Math.max(2, Math.round(this.w / 12)));
    while (this.weeds.length > n) this.weeds.pop();
    while (this.weeds.length < n) this.weeds.push(this.makeWeed());
  }
  buildFloor(coralN, starN) {
    const coral = normalizeSetting('coral', coralN, Math.max(2, Math.min(6, Math.round(this.w / 22))));
    const stars = normalizeSetting('starfish', starN, Math.max(2, Math.min(6, Math.round(this.w / 24))));
    this.coralCount = coral;
    this.starCount = stars;
    const kinds = [].concat(Array(coral).fill("CORAL"), Array(stars).fill("STARFISH"));
    if (!kinds.length) return [];        // 둘 다 0 이면 자리를 나눌 것도 없다
    kinds.sort(() => Math.random() - .5);
    const room = this.room, span = this.w / kinds.length;
    return kinds.map((k, i) => {
      const variants = DATA.sizes[k];
      const fits = variants.filter(size => size.h <= room && size.w <= span);
      const size = fits.length ? pick(fits) : variants[variants.length - 1];
      const w = size.w;
      return {kind: k === "CORAL" ? "coral" : "starfish", guideId: k === "CORAL" ? "coral" : "starfish",
              shapeIndex: variants.indexOf(size), w, h: size.h, color: pick(DATA.colors[k]),
              x: i * span + rnd(0, Math.max(0, span - w)),
              creep: k === "STARFISH" ? (Math.random() < .5 ? 1 : -1) * rnd(.010, .035) : 0};
    });
  }
  scare(x, y, radius = 22) {
    for (const kind of Object.keys(this.groups)) {
      if (kind === "megalodon") continue;
      for (const f of this.groups[kind]) {
        const dx = f.x + f.w / 2 - x, dy = f.y + f.h / 2 - y;
        if (Math.abs(dx) <= radius && Math.abs(dy) <= radius / 3) {
          f.turn(dx >= 0 ? 1 : -1);
          f.rush = 1;
        }
      }
    }
  }
  swallow(u) {
    if (!this.pending) return;
    this.pending[1] -= u;
    if (this.pending[1] > 0) return;
    const prey = this.pending[0], kind = this.pending[2];
    this.pending = null;
    if (prey.hooked) return;   // 낚싯줄이 먼저 채갔으면 식사는 무산
    const flock = this.groups[kind];
    const i = flock.indexOf(prey);
    if (i < 0) return;
    const sx = Math.round(prey.x + prey.w / 2);
    const sy = prey.y + Math.floor(prey.h / 2);
    this.chomps.push(new Chomp(sx, sy));
    for (let b = 0; b < 8; b++)
      this.bubbles.push({x: sx, y: sy, s: rnd(.25, .55)});
    flock[i] = new Being(kind, this.w, this.depth, true);
  }

  feed(now, cam, view) {
    if (now < this.nextMeal) return;
    const sharks = this.groups.shark
      .filter(s => s.y > cam - s.h && s.y < cam + view)
      .sort(() => Math.random() - .5);
    for (const shark of sharks) {
      const hx = shark.x + (shark.dir === 1 ? shark.w - 1 : 0);
      const hy = shark.y + Math.floor(shark.h / 2);
      for (const [kind, prey] of this.menu(shark)) {
        if (prey.hooked) continue;
        if (Math.abs(prey.x + prey.w / 2 - hx) <= 7 &&
            Math.abs(prey.y + prey.h / 2 - hy) <= 2) {
          shark.chew = CHEW_TIME;
          prey.chew = CHEW_TIME;
          this.alarms.push(new Alarm(prey));
          this.pending = [prey, ALARM_TIME, kind];
          this.nextMeal = now + rnd(5, 8);
          return;
        }
      }
    }
    this.nextMeal = now + .5;
  }
  placeSharks() {
    const sharks = this.groups.shark;
    if (!sharks || !sharks.length) return;
    const [lo, hi] = sharks[0].range(this.depth);
    const tall = sharks[0].h;
    const slice = (hi - lo + tall) / sharks.length;
    sharks.forEach((shark, i) => {
      const top = lo + Math.floor(i * slice);
      shark.top = top;
      shark.bottom = Math.max(top, top + Math.floor(slice) - tall);
      if (shark.yf < shark.top || shark.yf > shark.bottom) {
        shark.yf = Math.min(Math.max(shark.yf, shark.top), shark.bottom);
        shark.y = Math.round(shark.yf);
      }
      const livery = i % 2 === 0 ? DATA.colors.MAKO : DATA.colors.WHITE_SHARK;
      if (!shark.rare && !livery.includes(shark.color)) shark.color = pick(livery);
    });
  }

  menu(shark) {
    const limit = shark.w / 2;
    const pool = [];
    for (const kind of Object.keys(this.groups)) {
      if (kind === "shark" || kind === "megalodon" || SIGHT_ONLY.includes(kind)) continue;
      for (const prey of this.groups[kind]) if (prey.w <= limit) pool.push([kind, prey]);
    }
    return pool;
  }
  setCount(kind, n) {
    const list = this.groups[kind];
    if (!Array.isArray(list)) return;
    n = normalizePopulation(kind, n, this.seed[kind]);
    while (list.length > n) list.pop();
    while (list.length < n) list.push(new Being(kind, this.w, this.depth, true));
    if (kind === "shark") this.placeSharks();
  }
  setPopulation(n) {
    n = normalizeSetting('fish', n, this.base);
    const ratio = n / Math.max(1, this.base);
    for (const kind of Object.keys(this.groups)) {
      if (kind === "shark" || kind === "megalodon" || kind === "whale" || kind === "dolphin") continue;
      const seeded = this.seed[kind] || 0;
      if (!n || !seeded) { this.setCount(kind, 0); continue; }
      if (kind === "fish") { this.setCount("fish", n); continue; }
      this.setCount(kind, Math.max(1, Math.round(seeded * ratio)));
    }
  }
  setWhalePopulation(n) {
    n = normalizeSetting('whale', n, this.seed.whale + this.seed.dolphin);
    // Split the combined total evenly, keeping the remainder with dolphins.
    const dolphins = Math.ceil(n / 2);
    this.setCount('dolphin', dolphins);
    this.setCount('whale', n - dolphins);
  }
  replace(being) {
    const flock = this.groups[being.kind];
    if (!flock) return;
    const i = flock.indexOf(being);
    if (i >= 0) flock[i] = new Being(being.kind, this.w, this.depth, true);
  }
  scatterBait(cam, view, x) {
    if (this.groups.megalodon.length) return "already";
    const fits = DATA.sizes.MEGALODON.some(size => size.h <= Math.max(1, this.depth - 4) && size.w <= this.w);
    if (!fits) return "tooSmall";
    const bx = Math.max(2, Math.min(this.w - 3, Math.round(x)));
    const by = Math.round(cam + view / 2);
    this.bait = {x: bx, y: by, life: BAIT_LIFE};
    const m = new Being("megalodon", this.w, this.depth, true);
    const [lo, hi] = m.range(this.depth);
    m.yf = Math.max(lo, Math.min(hi, by - Math.floor(m.h / 2)));
    m.y = Math.round(m.yf);
    m.top = lo; m.bottom = hi;
    const fromLeft = bx >= this.w / 2;
    if ((m.dir === 1) !== fromLeft) m.turn(fromLeft ? 1 : -1);
    m.x = fromLeft ? -m.w : this.w;
    m.speed = rnd(.28, .36);
    m.rush = 1;
    this.groups.megalodon.push(m);
    return "ok";
  }
  castRod(cam, view, x, y) {
    if (!this.rod) this.rod = new Rod(this.w, this.depth, cam, view, x, y);
    else this.rod.strike();
  }

  workRod(u) {
    if (!this.rod || this.rod.step(u, this)) return;
    const caught = this.rod.catch;
    if (caught) {
      this.caught++;
      this.landed = caught;      // 도감 쪽지는 손으로 올린 것에만 뜬다
      this.replace(caught);
    }
    this.rod = null;
  }

  cast(u, now, cam, view) {
    if (!this.line) {
      if (now >= this.nextLine) this.line = new FishingLine(this.w, this.depth, cam, view);
      return;
    }
    if (this.line.step(u, this)) return;
    const caught = this.line.catch;
    if (caught) this.replace(caught);   // 혼자 내려온 줄이 걷어 간 자리도 메운다
    this.line = null;
    this.nextLine = now + rnd(10, 26);
  }
  toggleSub(y) {
    if (this.subs.length) { this.subs = []; return false; }
    const room = DATA.sizes.SUB.some(size => size.h <= Math.max(1, this.depth - 4) && size.w <= this.w);
    if (!room) return false;
    this.subs.push(this.makeSub(y));
    return true;
  }
  makeSub(y) {
    const boat = new Being("sub", this.w, this.depth, true);
    boat.y = Math.max(1, Math.min(this.depth - 1 - boat.h, y));
    boat.yf = boat.y;
    return boat;
  }
  step(u, now, cam = 0, view = 24) {
    this.now = now;
    this.viewTop = cam;          // 낚싯대가 화면 천장을 알아야 거기서 걷힌다
    this.feed(now / 1000, cam, view);
    this.cast(u, now / 1000, cam, view);
    this.workRod(u);
    for (const [kind, list] of Object.entries(this.groups)) {
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        b.step(u);
        if (!b.hooked && b.gone(this.w)) {
          if (kind === "megalodon") { list.splice(i, 1); i--; continue; }
          list[i] = new Being(kind, this.w, this.depth, true);
          if (kind === "shark" && !this.groups.megalodon.length && Math.random() < MEGA_CHANCE) {
            const fits = DATA.sizes.MEGALODON.some(size => size.h <= Math.max(1, this.depth - 4) && size.w <= this.w);
            if (fits) this.groups.megalodon.push(new Being("megalodon", this.w, this.depth, true));
          }
          continue;
        }
        if (Math.random() < b.spec.bubble * u) this.bubbles.push({x: b.x + (b.dir === 1 ? b.w - 1 : 0), y: b.y + b.h / 2, s: rnd(.25, .55)});
      }
    }
    for (let i = 0; i < this.subs.length; i++) {
      const boat = this.subs[i];
      boat.step(u);
      this.scare(boat.x + boat.w / 2, boat.y + boat.h / 2, 16);
      if (Math.random() < boat.spec.bubble * u)
        this.bubbles.push({x: boat.x + (boat.dir === 1 ? 0 : boat.w), y: boat.y + boat.h - 1, s: rnd(.25, .55)});
      if (boat.gone(this.w)) this.subs[i] = this.makeSub(boat.y);
    }
    for (const it of this.floor) {
      if (!it.creep) continue;
      it.x += it.creep * u;
      if (it.x > this.w) it.x = -it.w;
      else if (it.x + it.w < 0) it.x = this.w;
    }
    for (const b of this.bubbles) { b.y -= b.s * u; if (Math.random() < .06 * u) b.x += Math.random() < .5 ? -1 : 1; }
    this.bubbles = this.bubbles.filter(b => b.y > .5).slice(-400);
    if (this.bait) {
      this.bait.life -= u;
      this.bait.y += .06 * u;
      if (Math.random() < .25 * u)
        this.bubbles.push({x: this.bait.x + rnd(-1, 1), y: this.bait.y, s: rnd(.2, .5)});
      if (this.bait.life <= 0) this.bait = null;
    }
    this.chomps = this.chomps.filter(c => c.step(u));
    this.alarms = this.alarms.filter(a => a.step(u));
    this.swallow(u);
    this.onlyOneRare();
    this.placeSharks();      // 새로 태어난 상어까지 이 프레임 안에 자리 잡게
  }
  onlyOneRare() {
    let found = false;
    for (const list of Object.values(this.groups))
      for (const b of list) {
        if (!b.rare) continue;
        if (found) { b.rare = false; b.color = pick(DATA.colors[b.spec.colors]); }
        else found = true;
      }
  }

}

export { Ocean, Being, Rod, FishingLine, Chomp, Alarm, DATA, SPECIES, CATCHABLE, SIGHT_ONLY, guideId, SPEED_DEFAULT, LURE, CHOMP, CHOMP_LIFETIME, ROD, RARE_COLOR, MEGA_COLOR };
