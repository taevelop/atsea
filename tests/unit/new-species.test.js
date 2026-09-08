import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { AnimationMixer, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Being, CATCHABLE, DATA, Ocean, RARE_COLOR, SIGHT_ONLY, SPECIES } from '../../src/game/ocean.js';
import { GUIDE, tallyRecords } from '../../src/game/progression.js';
import { beingArt, flip, speciesArt } from '../../src/render/ascii-renderer.js';
import { NEW_ASCII_FRAMES } from '../../src/render/new-species-art.js';
import { MODEL_IDS } from '../../src/render/model-library.js';

const kinds = ['turtle', 'crab', 'shrimp', 'dolphin', 'whale', 'oarfish'];

describe('six new species across the shared ocean and both views', () => {
  it.each(kinds)('%s has aligned, mirrored animation frames and stable identity', kind => {
    const animal = new Being(kind, 160, 200);
    const frames = NEW_ASCII_FRAMES[SPECIES[kind].sizes];
    expect(GUIDE.some(entry => entry[0] === kind)).toBe(true);
    expect(MODEL_IDS).toContain(kind);
    for (const frame of frames) {
      expect(frame.length).toBe(animal.h);
      expect(frame.every(line => line.length === animal.w)).toBe(true);
      expect(flip(flip(frame))).toEqual(frame);
    }
    expect(new Set(frames.map(f => f.join('\n'))).size).toBeGreaterThan(1);
    animal.animationPhase = 0;
    animal.dir = 1;
    expect(beingArt(animal, 0)).toEqual(speciesArt(kind));
    animal.turn(-1);
    expect(animal.guideId).toBe(kind);
    expect(beingArt(animal, 0)).toEqual(animal.spec.mirror ? flip(frames[0]) : frames[0]);
  });

  it('preserves requested relative sizes and an upright oarfish', () => {
    expect(DATA.sizes.DOLPHIN[0].w / DATA.sizes.SHARK[0].w).toBeCloseTo(1, 1);
    expect(DATA.sizes.WHALE[0].w / DATA.sizes.SHARK[0].w).toBeCloseTo(1.2, 1);
    expect(DATA.sizes.OARFISH[0].h).toBeGreaterThan(DATA.sizes.OARFISH[0].w);
  });

  it.each(kinds)('%s uses the same rare probability boundary and color as existing fish', kind => {
    const random = vi.spyOn(Math, 'random');
    try {
      for (const [roll, expected] of [[.005999, true], [.006, false]]) {
        random.mockReturnValue(roll);
        const animal = new Being(kind, 160, 200);
        expect(animal.rare).toBe(new Being('fish', 160, 200).rare);
        expect(animal.rare).toBe(expected);
        if (expected) expect(animal.color).toBe(RARE_COLOR);
      }
    } finally { random.mockRestore(); }
  });

  it('shares the one-rare-per-ocean limit with all existing species', () => {
    const sea = new Ocean(160, 200, 40);
    for (const group of Object.values(sea.groups)) for (const animal of group) animal.rare = false;
    for (const kind of kinds) sea.groups[kind][0].rare = true;
    sea.groups.fish[0].rare = true;
    sea.onlyOneRare();
    expect(Object.values(sea.groups).flat().filter(animal => animal.rare)).toHaveLength(1);
    for (const kind of kinds) {
      const animal = sea.groups[kind][0];
      if (!animal.rare) expect(DATA.colors[animal.spec.colors]).toContain(animal.color);
    }
  });

  it('scales all new populations, respawns them, and avoids spawning in a sea too small', () => {
    const sea = new Ocean(160, 200, 40);
    for (const kind of kinds) {
      expect(sea.groups[kind].length).toBeGreaterThan(0);
      const old = sea.groups[kind][0];
      sea.replace(old);
      expect(sea.groups[kind][0]).not.toBe(old);
      expect(sea.groups[kind][0].kind).toBe(kind);
    }
    sea.setPopulation(0);
    for (const kind of kinds) expect(sea.groups[kind]).toHaveLength(0);
    sea.setPopulation(sea.base);
    for (const kind of kinds) expect(sea.groups[kind].length).toBeGreaterThan(0);
    const small = new Ocean(16, 30, 20);
    small.setPopulation(1000);
    for (const kind of kinds) expect(small.groups[kind]).toHaveLength(0);
  });

  it('keeps the three large visitors outside fishing and predation', () => {
    const sea = new Ocean(160, 200, 40);
    expect(SIGHT_ONLY).toEqual(['turtle', 'dolphin', 'whale']);
    for (const kind of SIGHT_ONLY) expect(CATCHABLE).not.toContain(kind);
    for (const kind of ['crab', 'shrimp', 'oarfish']) expect(CATCHABLE).toContain(kind);
    expect(sea.menu({ w: 1000 }).some(([kind]) => SIGHT_ONLY.includes(kind))).toBe(false);
    const tally = tallyRecords({ seenLog: { turtle: 1, dolphin: 1, whale: 1 }, rareLog: { whale: 1 }, guideLog: { shrimp: 1 } });
    expect(tally).toMatchObject({ species: 4, total: 1, rareLanded: 0, plainTotal: 1 });
  });

  it.each(kinds)('%s GLB has a working Swim clip and geometry in the correct orientation', async kind => {
    const bytes = readFileSync(new URL(`../../public/models/${kind}.glb`, import.meta.url));
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    expect(gltf.animations).toHaveLength(1);
    expect(gltf.animations[0].name).toBe('Swim');
    const mixer = new AnimationMixer(gltf.scene);
    mixer.clipAction(gltf.animations[0]).play();
    const positions = time => {
      mixer.setTime(time);
      gltf.scene.updateMatrixWorld(true);
      const points = [];
      gltf.scene.traverse(mesh => {
        if (!mesh.isMesh) return;
        mesh.skeleton?.update();
        for (let i = 0; i < mesh.geometry.attributes.position.count; i++) points.push(mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld));
      });
      return points;
    };
    const a = positions(0), b = positions(gltf.animations[0].duration * .25);
    expect(a.length).toBe(b.length);
    expect(Math.max(...a.map((p, i) => p.distanceTo(b[i])))).toBeGreaterThan(.001);
    const spans = ['x', 'y', 'z'].map(axis => Math.max(...a.map(p => p[axis])) - Math.min(...a.map(p => p[axis])));
    expect(spans.every(s => Number.isFinite(s) && s > 0)).toBe(true);
    if (kind === 'oarfish') expect(spans[1]).toBeGreaterThan(spans[0] * 3);
    if (kind === 'whale' || kind === 'dolphin') expect(spans[0]).toBeGreaterThan(spans[1] * 2);
    mixer.stopAllAction();
    mixer.uncacheRoot(gltf.scene);
  });

  it('renders a paused animation without consuming random numbers', () => {
    const being = new Being('whale', 160, 200);
    const before = JSON.stringify(being);
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Unexpected render randomness'); });
    try { expect(beingArt(being, 50)).toEqual(beingArt(being, 50)); }
    finally { random.mockRestore(); }
    expect(JSON.stringify(being)).toBe(before);
  });
});
