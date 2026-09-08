import { describe, expect, it } from 'vitest';
import { GUIDE, LURE_IDS, TITLES, TROPHY_ALL, TROPHY_GOT, trophyState, tallyRecords, earnedTitles, baitUnlocked } from '../../src/game/progression.js';

const tally = (overrides = {}) => tallyRecords({ guideLog: {}, rareLog: {}, seenLog: {}, statLog: {}, ...overrides });
const earned = t => earnedTitles(t).map(entry => Array.isArray(entry) ? entry[0] : entry.id || entry);
const speciesIds = ['fish0', 'fish1', 'fish2', 'fish3', 'fish4', 'fish5', 'fish6', 'jelly', 'seahorse', 'squid', 'ray', 'lantern', 'octopus', 'angler'];

describe('legacy collection and trophy rules', () => {
  it('preserves separate fish0 through fish6 guide entries', () => {
    const ids = GUIDE.filter(entry => entry[0] === 'fish').map(entry => `fish${entry[1]}`).sort();
    expect(ids).toEqual(speciesIds.slice(0, 7));
  });

  it('an empty aquarium record has no trophy, title, or special bait', () => {
    const state = tally();
    expect(state).toMatchObject({ total: 0, rareTotal: 0, plainTotal: 0, rareLanded: 0, mostOfOne: 0, species: 0 });
    expect(earned(state)).toEqual([]);
    expect(TROPHY_GOT(trophyState(state))).toBe(0);
    expect(baitUnlocked(state)).toBe(false);
  });

  it.each([[9, 0, 10], [10, 1, 50], [49, 1, 50], [50, 2, 150], [149, 2, 150], [150, 3, 300], [299, 3, 300], [300, 4, null]])('plain catches %s award tier %s with next %s', (count, tier, next) => {
    expect(trophyState(tally({ guideLog: { fish0: count } })).find(track => track.track === 'plain')).toMatchObject({ now: count, tier, next });
  });

  it.each([[0, 0, 1], [1, 1, 3], [2, 1, 3], [3, 2, 6], [5, 2, 6], [6, 3, 12], [11, 3, 12], [12, 4, null]])('rare catches %s award tier %s with next %s', (count, tier, next) => {
    expect(trophyState(tally({ guideLog: { fish0: count }, rareLog: { fish0: count } })).find(track => track.track === 'rare')).toMatchObject({ now: count, tier, next });
  });

  it('rare shark sightings unlock Whitefin without contributing to landed trophies', () => {
    const state = tally({ guideLog: { fish0: 10 }, rareLog: { shark: 12 } });
    expect(state).toMatchObject({ total: 10, rareTotal: 12, rareLanded: 0, plainTotal: 10 });
    expect(earned(state)).toContain('whitefin');
    expect(trophyState(state).find(track => track.track === 'rare').tier).toBe(0);
  });

  it('requires all seven fish and the correct deep/shallow species for their titles', () => {
    expect(earned(tally({ guideLog: Object.fromEntries(speciesIds.slice(0, 6).map(id => [id, 1])) }))).not.toContain('seven');
    const state = tally({ guideLog: Object.fromEntries(speciesIds.map(id => [id, 1])) });
    expect(earned(state)).toEqual(expect.arrayContaining(['cast', 'seven', 'dark', 'slow', 'ten', 'coast']));
    expect(earned(state)).not.toContain('real');
  });

  it('seabed and snapped-line titles depend on activity, not collection count', () => {
    expect(earned(tally({ statLog: { snap: 1, seabed: 1 } }))).toEqual(expect.arrayContaining(['snapped', 'seabed']));
    expect(earned(tally({ statLog: { snap: 9 } }))).not.toContain('regular');
    expect(earned(tally({ statLog: { snap: 10 } }))).toContain('regular');
    expect(earned(tally({ seenLog: { megalodon: 1 } }))).toContain('real');
  });

  it('unlocks permanent bait after every ordinary title without requiring a megalodon sighting', () => {
    const records = {
      guideLog: { ...Object.fromEntries(speciesIds.map(id => [id, 1])), fish0: 400 },
      rareLog: { fish0: 12, fish1: 1, fish2: 1, fish3: 1, shark: 1 },
      statLog: { snap: 10, seabed: 1 },
    };
    const state = tally(records);
    expect(TROPHY_ALL).toBe(8);
    expect(TROPHY_GOT(trophyState(state))).toBe(8);
    expect(LURE_IDS).toHaveLength(TITLES.length - 1);
    expect(LURE_IDS).not.toContain('real');
    expect(earned(state)).not.toContain('real');
    expect(baitUnlocked(state)).toBe(true);
    expect(baitUnlocked(tally({ ...records, statLog: { snap: 9, seabed: 1 } }))).toBe(false);
  });
});
