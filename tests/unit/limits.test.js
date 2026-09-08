import { describe, expect, it } from 'vitest';
import { LIMITS, normalizeSetting, normalizePopulation } from '../../src/game/limits.js';
import { loadSliderValues, loadCounts } from '../../src/game/storage.js';
import { Ocean, CATCHABLE } from '../../src/game/ocean.js';

const storage = values => ({ getItem: () => JSON.stringify(values) });

describe('bounded aquarium settings', () => {
  it.each(Object.keys(LIMITS))('bounds %s before allocation', key => {
    const [min, max] = LIMITS[key];
    expect(normalizeSetting(key, 1e9)).toBe(max);
    expect(normalizeSetting(key, -100)).toBe(min);
    expect(normalizeSetting(key, max - 0.1)).toBe(max - 1);
    for (const invalid of [NaN, Infinity, -Infinity, null, true, '12', {}, []]) {
      expect(normalizeSetting(key, invalid, max)).toBe(max);
    }
  });

  it('only restores known numeric settings and preserves collection records', () => {
    const raw = { fish: 1e9, sharks: -4, coral: 5.9, starfish: true, seaweed: '30', speed: 0, unknown: 9 };
    expect(loadSliderValues(Object.keys(raw), storage(raw))).toEqual({ fish: 1000, sharks: 0, coral: 5, speed: 6 });
    expect(loadSliderValues(['fish', 'speed'], storage({ fish: 17, speed: 33 }))).toEqual({ fish: 17, speed: 33 });
    expect(loadCounts('atsea.guide', storage({ fish0: 1e9 }))).toEqual({ fish0: 1e9 });
  });

  it.each(['null', '[]', 'true', 'broken', '1e999'])('uses defaults for malformed storage %s', raw => {
    expect(loadSliderValues(['fish', 'speed'], { getItem: () => raw })).toEqual({});
  });

  it('bounds initial allocation even for extreme logical dimensions', () => {
    const sea = new Ocean(1e9, 1e9, 1);
    for (const [kind, list] of Object.entries(sea.groups)) expect(list.length).toBeLessThanOrEqual(normalizePopulation(kind, 1e9));
    expect(sea.base).toBe(1000);
    expect(sea.weeds).toHaveLength(100);
  });

  it('bounds direct population, predator and floor calls', () => {
    const sea = new Ocean(104, 200, 40);
    sea.setPopulation(1e9);
    expect(sea.groups.fish).toHaveLength(1000);
    for (const kind of CATCHABLE) {
      expect(sea.groups[kind].length).toBeLessThanOrEqual(1000);
      sea.setCount(kind, 1e9);
      expect(sea.groups[kind]).toHaveLength(1000);
    }
    sea.setCount('shark', 1e9);
    sea.setCount('megalodon', 1e9);
    expect(sea.groups.shark).toHaveLength(24);
    expect(sea.groups.megalodon).toHaveLength(1);
    sea.setWeeds(1e9);
    expect(sea.weeds).toHaveLength(100);
    expect(sea.buildFloor(1e9, 1e9)).toHaveLength(56);
    expect(sea.buildFloor(2.9, -1)).toHaveLength(2);
    sea.setWeeds(-1);
    sea.setPopulation(-1);
    expect(sea.weeds).toHaveLength(0);
    for (const kind of CATCHABLE) expect(sea.groups[kind]).toHaveLength(0);
    expect(sea.groups.megalodon).toHaveLength(1);
  });

  it('uses original seed defaults for invalid direct engine inputs', () => {
    const sea = new Ocean(104, 200, 40);
    for (const invalid of [NaN, Infinity, -Infinity, null, true, '1000', {}]) {
      sea.setPopulation(invalid);
      expect(sea.groups.fish).toHaveLength(184);
      sea.setCount('shark', invalid);
      expect(sea.groups.shark).toHaveLength(4);
      sea.setWeeds(invalid);
      expect(sea.weeds).toHaveLength(9);
      expect(sea.buildFloor(invalid, invalid)).toHaveLength(9);
    }
    sea.setCount('fish', 12.9);
    expect(sea.groups.fish).toHaveLength(12);
  });
});
