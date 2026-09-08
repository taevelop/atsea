import { describe, expect, it, vi } from 'vitest';
import { ASCII_DATA } from '../../src/render/ascii-data.js';
import { Grid, beingArt, composeAsciiGrid, flip, speciesArt } from '../../src/render/ascii-renderer.js';
import { DATA, Ocean, SPECIES, MEGA_COLOR } from '../../src/game/ocean.js';
import { loadViewMode, saveViewMode } from '../../src/game/storage.js';

describe('original ASCII art on the shared simulation', () => {
  it('matches the existing collision dimensions for every one of the 44 variants', () => {
    let variants = 0;
    for (const [family, shapes] of Object.entries(ASCII_DATA.shapes)) {
      expect(shapes.map(lines => ({ w: Math.max(...lines.map(line => line.length)), h: lines.length }))).toEqual(DATA.sizes[family]);
      variants += shapes.length;
      for (const lines of shapes) expect(flip(flip(lines))).toEqual(lines);
    }
    expect(variants).toBe(44);
  });
  it('clips edge sprites and preserves transparent margins with opaque interiors', () => {
    const grid = new Grid(7, 2);
    grid.draw(0, 0, 'abcdefg', 'blue');
    grid.sprite(0, 0, ['  ( )  '], 'red', true);
    expect(grid.ch[0].join('')).toBe('ab( )fg');
    grid.draw(-2, 1, '12345', 'white');
    expect(grid.ch[1].join('')).toBe('345    ');
    grid.sprite(5, -1, ['xx', 'yyy', 'zz'], 'white', true);
    expect(grid.ch[0].join('')).toBe('ab( )yy');
  });
  it('derives direction and ray animation from state without changing the animal', () => {
    const being = Object.freeze({ kind: 'ray', shapeIndex: 0, dir: -1, animationPhase: 0, spec: SPECIES.ray });
    expect(beingArt(being, 0)).toEqual(flip(ASCII_DATA.flap.RAY[0][0]));
    expect(beingArt(being, 10)).toEqual(flip(ASCII_DATA.flap.RAY[0][1]));
    expect(speciesArt('fish', 0)).toEqual(['><>']);
  });
  it('renders the same frozen ocean without consuming game randomness or mutating state', () => {
    const ocean = new Ocean(160, 180, 36);
    const state = { ocean, cols: 160, rows: 36, cam: 144, clock: 5, motion: 100, redTide: false };
    const before = JSON.stringify(ocean);
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Rendering consumed game randomness'); });
    try {
      const first = composeAsciiGrid(state), second = composeAsciiGrid(state);
      expect(first.ch).toEqual(second.ch);
      expect(first.ch.flat().filter(c => c !== ' ').length).toBeGreaterThan(160);
      expect(JSON.stringify(ocean)).toBe(before);
    } finally { random.mockRestore(); }
  });
  it('shows a hidden megalodon direction marker and the original red ocean banner', () => {
    const ocean = new Ocean(160, 180, 36);
    ocean.groups.megalodon = [{ x: 30, y: 100, w: 61, h: 15, kind: 'megalodon', shapeIndex: 2, dir: 1, spec: SPECIES.megalodon, color: MEGA_COLOR }];
    const state = { ocean, cols: 160, rows: 36, cam: 0, clock: 0, motion: 0 };
    const normal = composeAsciiGrid(state);
    expect(normal.ch.at(-1).join('')).toContain('vvvvvvvvv 533m vvvvvvvvv');
    expect(composeAsciiGrid({ ...state, redTide: true }).ch.flat()).toContain('█');
  });
});

describe('view preference compatibility', () => {
  it.each([null, '', 'invalid', '3d'])('defaults to 3D for %s', value => {
    expect(loadViewMode({ getItem: () => value })).toBe('3d');
  });
  it('stores only a valid view and tolerates unavailable storage', () => {
    expect(loadViewMode({ getItem: () => '2d' })).toBe('2d');
    const storage = { setItem: vi.fn() };
    saveViewMode('2d', storage); saveViewMode('unknown', storage);
    expect(storage.setItem).toHaveBeenCalledExactlyOnceWith('atsea.view', '2d');
    expect(loadViewMode({ getItem() { throw new Error('denied'); } })).toBe('3d');
    expect(() => saveViewMode('2d', { setItem() { throw new Error('denied'); } })).not.toThrow();
  });
});
