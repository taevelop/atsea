import { CATCHABLE, guideId } from './ocean.js';
const GUIDE = [
  ["fish", 0, "#00d7ff"],
  ["fish", 1, "#00afff"],
  ["fish", 6, "#ff8700"],
  ["fish", 2, "#00ffff"],
  ["fish", 3, "#ffd700"],
  ["fish", 4, "#ffff00"],
  ["fish", 5, "#d78700"],
  ["jelly", 0, "#ffafff"],
  ["seahorse", 0, "#ffd75f"],
  ["squid", 0, "#d787af"],
  ["ray", 0, "#87afd7"],
  ["lantern", 0, "#5fffff"],
  ["octopus", 0, "#d787d7"],
  ["angler", 0, "#af875f"],
  ["megalodon", 2, "#a8e6ff"],
  ["shark", 0, "#87d7ff"],
  ["turtle", 0, "#9ebf89"],
  ["crab", 0, "#ed996f"],
  ["shrimp", 0, "#efb1b5"],
  ["dolphin", 0, "#8cc7da"],
  ["whale", 0, "#729ab9"],
  ["oarfish", 0, "#d8d5e5"],
];
const FISH_IDS = ["fish0", "fish1", "fish2", "fish3", "fish4", "fish5", "fish6"];
// Keep earned legacy titles and the permanent bait requirement stable as the guide grows.
const COAST_IDS = [...FISH_IDS, 'jelly', 'seahorse', 'squid', 'ray', 'lantern', 'octopus', 'angler'];
const CATCH_ENTRIES = () => GUIDE.filter(e => CATCHABLE.includes(e[0]));
const has = (log, ...ids) => ids.every(i => log[i]);
const TITLES = [
  ["cast",     t => t.total >= 1],
  ["basket",   t => t.total >= 50],
  ["hundred",  t => t.total >= 100],
  ["seven",    t => FISH_IDS.every(i => t.log[i])],
  ["dark",     t => has(t.log, "lantern", "octopus", "angler")],
  ["slow",     t => has(t.log, "jelly", "seahorse", "ray")],
  ["ten",      t => t.species >= 10],
  ["coast",    t => COAST_IDS.every(id => t.log[id])],
  ["luck",     t => t.rareTotal >= 1],
  ["pale",     t => t.rareSpecies >= 5],
  ["whitefin", t => !!t.rare.shark],
  ["well",     t => t.mostOfOne >= 50],
  ["cups",     t => TROPHY_GOT(trophyState(t)) >= TROPHY_ALL],
  ["snapped",  t => t.stat.snap >= 1],
  ["regular",  t => t.stat.snap >= 10],
  ["seabed",   t => !!t.stat.seabed],
  ["real",     t => !!t.seen.megalodon],
];
const LURE_IDS = TITLES.filter(x => x[0] !== "real").map(x => x[0]);
const TROPHIES = [
  ["plain", [10, 50, 150, 300], t => t.plainTotal],
  ["rare",  [1, 3, 6, 12],      t => t.rareLanded],
];
const trophyKey = (track, tier) => "trophy." + track + "." + tier;
const TROPHY_ALL = TROPHIES.reduce((a, x) => a + x[1].length, 0);
const TROPHY_GOT = cups => cups.reduce((a, c) => a + c.tier, 0);
function trophyState(t) {
  return TROPHIES.map(([track, steps, count]) => {
    const now = count(t);
    let tier = 0;
    for (const step of steps) if (now >= step) tier++;
    return {track, tier, now, next: tier < steps.length ? steps[tier] : null};
  });
}

function tallyRecords({guideLog = {}, rareLog = {}, statLog = {}, seenLog = {}} = {}) {
  const t = {
    log: guideLog, rare: rareLog, seen: seenLog,
    total: Object.values(guideLog).reduce((a, b) => a + b, 0),
    species: GUIDE.filter(e => guideLog[guideId(e[0], e[1])] || seenLog[e[0]]).length,
    rareTotal: Object.values(rareLog).reduce((a, b) => a + b, 0),
    rareSpecies: Object.keys(rareLog).length,
  };
  const landedIds = new Set(CATCH_ENTRIES().map(e => guideId(e[0], e[1])));
  t.rareLanded = Object.entries(rareLog)
    .reduce((a, [id, v]) => a + (landedIds.has(id) ? v : 0), 0);
  t.plainTotal = t.total - t.rareLanded;
  const counts = Object.values(guideLog);
  t.mostOfOne = counts.length ? Math.max(...counts) : 0;
  t.stat = {snap: statLog.snap || 0, seabed: statLog.seabed || 0};
  return t;
}
function earnedTitles(t = tallyRecords()) {
  return TITLES.filter(x => { try { return x[1](t); } catch { return false; } });
}

function baitUnlocked(t = tallyRecords()) { const ids = new Set(earnedTitles(t).map(x => x[0])); return LURE_IDS.every(id => ids.has(id)); }
export { GUIDE, TITLES, TROPHIES, TROPHY_GOT, TROPHY_ALL, LURE_IDS, FISH_IDS, CATCH_ENTRIES, trophyKey, trophyState, tallyRecords, earnedTitles, baitUnlocked };
