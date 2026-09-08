import { describe, expect, it } from 'vitest';
import { loadCounts, loadSliderValues } from '../../src/game/storage.js';

const storage = raw => ({ getItem: () => raw });
const blocked = { getItem: () => { throw new DOMException('Storage is blocked', 'SecurityError'); } };

describe('existing atsea.* records', () => {
  it('preserves all seven fish identities and legacy species/count records', () => {
    const records = { fish0: 1, fish1: 2, fish2: 3, fish3: 4, fish4: 5, fish5: 6, fish6: 7, angler: 9, shark: 2, megalodon: 1 };
    expect(loadCounts('atsea.guide', storage(JSON.stringify(records)))).toEqual(records);
  });

  it.each(['broken json', 'null', '[]', 'false', '0'])('loads a safe empty record from malformed input %s', raw => {
    expect(loadCounts('atsea.guide', storage(raw))).toEqual({});
  });

  it('rejects string, boolean, null, zero, and negative collection counts', () => {
    expect(loadCounts('atsea.guide', storage(JSON.stringify({ fish0: 2, fish1: '4', fish2: true, fish3: null, fish4: 0, fish5: -1 })))).toEqual({ fish0: 2 });
  });

  it('keeps the aquarium usable when browser storage is denied', () => {
    expect(loadCounts('atsea.guide', blocked)).toEqual({});
    expect(loadSliderValues(['fish', 'speed'], blocked)).toEqual({});
  });

  it('accepts real nonnegative slider values without coercing corrupt values', () => {
    const saved = { fish: 0, sharks: 8, speed: 20, coral: null, starfish: true, seaweed: '20', extra: 9 };
    expect(loadSliderValues(['fish', 'sharks', 'speed', 'coral', 'starfish', 'seaweed'], storage(JSON.stringify(saved)))).toEqual({ fish: 0, sharks: 8, speed: 20 });
  });
});
