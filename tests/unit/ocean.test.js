import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Being, CATCHABLE, Ocean, Rod, guideId } from '../../src/game/ocean.js';

const counts = sea => Object.fromEntries(Object.entries(sea.groups).map(([kind, beings]) => [kind, beings.length]));
const emptySea = (width = 200) => {
  const sea = new Ocean(width, 200, 40);
  for (const kind of Object.keys(sea.groups)) sea.groups[kind] = [];
  return sea;
};
const fishAtBait = (sea, kind = 'fish') => {
  const fish = new Being(kind, sea.w, sea.depth);
  fish.x = 40;
  fish.y = fish.yf = 20;
  sea.groups[kind] = [fish];
  const rod = new Rod(sea.w, sea.depth, 0, 40, fish.x + Math.floor(fish.w / 2), fish.y + fish.h / 2);
  rod.tip = rod.stop;
  rod.mark = fish;
  sea.rod = rod;
  return { fish, rod };
};

beforeEach(() => vi.spyOn(Math, 'random').mockReturnValue(0.5));

describe('population and species identity', () => {
  it('keeps the original per-screen population at a 104 by 200 logical sea', () => {
    const sea = new Ocean(104, 200, 40);
    expect(counts(sea)).toMatchObject({ fish: 184, shark: 4, jelly: 8, seahorse: 3, squid: 7, angler: 4, lantern: 57, octopus: 4, ray: 5, megalodon: 0 });
  });

  it('scales all catchable species together while preserving separate shark control', () => {
    const sea = new Ocean(104, 200, 40);
    sea.setPopulation(92);
    expect(counts(sea)).toMatchObject({ fish: 92, shark: 4, jelly: 4, seahorse: 2, squid: 4, angler: 2, lantern: 29, octopus: 2, ray: 3 });
    sea.setPopulation(1);
    for (const kind of CATCHABLE) expect(sea.groups[kind]).toHaveLength(1);
    sea.setPopulation(400);
    expect(counts(sea)).toMatchObject({ fish: 400, shark: 4, jelly: 17, seahorse: 7, squid: 15, angler: 9, lantern: 124, octopus: 9, ray: 11 });
  });

  it('zero empties every catchable species without removing a visiting megalodon', () => {
    const sea = new Ocean(200, 200, 40);
    sea.scatterBait(30, 40, 100);
    sea.setPopulation(0);
    for (const kind of CATCHABLE) expect(sea.groups[kind]).toHaveLength(0);
    expect(sea.groups.shark).toHaveLength(4);
    expect(sea.groups.megalodon).toHaveLength(1);
    sea.setCount('shark', 0);
    expect(sea.groups.shark).toHaveLength(0);
  });

  it('guide identity survives swimming-direction changes', () => {
    for (let shape = 0; shape < 7; shape++) expect(guideId('fish', shape)).toBe(`fish${shape}`);
    const fish = new Being('fish', 104, 200);
    const identity = fish.guideId;
    fish.turn(-fish.dir);
    expect(fish.guideId).toBe(identity);
    expect(guideId('angler', 1)).toBe('angler');
  });

  it('replaces a landed deep-sea species with the same species', () => {
    const sea = new Ocean(104, 200, 40);
    const before = counts(sea);
    const old = sea.groups.angler[0];
    sea.replace(old);
    expect(counts(sea)).toEqual(before);
    expect(sea.groups.angler[0]).not.toBe(old);
    expect(sea.groups.angler[0].guideId).toBe('angler');
  });
});

describe('manual rod behavior', () => {
  it('casts, hooks only on strike, reels up, and records exactly one landed fish', () => {
    const sea = emptySea();
    const { fish, rod } = fishAtBait(sea);
    rod.step(1, sea);
    expect(rod.state).toBe('cast');
    expect(fish.hooked).toBe(false);
    Math.random.mockReturnValue(0.69);
    rod.strike();
    rod.step(1, sea);
    expect(rod.state).toBe('on');
    expect(fish.hooked).toBe(true);
    expect(sea.caught).toBe(0);
    rod.strike();
    expect(rod.state).toBe('up');
    sea.workRod(100);
    expect(sea.rod).toBeNull();
    expect(sea.caught).toBe(1);
    expect(sea.landed).toBe(fish);
    expect(sea.groups.fish).toHaveLength(1);
    expect(sea.groups.fish[0]).not.toBe(fish);
  });

  it('a failed strike releases the fish and leaves catch totals unchanged', () => {
    const sea = emptySea();
    const { fish, rod } = fishAtBait(sea);
    Math.random.mockReturnValue(0.7);
    rod.strike();
    rod.step(1, sea);
    expect(rod.state).toBe('up');
    expect(fish.hooked).toBe(false);
    expect(sea.missed.why).toBe('miss');
    sea.workRod(100);
    expect(sea.caught).toBe(0);
    expect(sea.landed).toBeNull();
  });

  it('striking before bait settles retrieves an empty line', () => {
    const sea = emptySea();
    sea.castRod(0, 40, 40, 30);
    sea.rod.strike();
    sea.workRod(1);
    expect(sea.rod.state).toBe('up');
    sea.workRod(100);
    expect(sea.rod).toBeNull();
    expect(sea.caught).toBe(0);
  });

  it('a hooked fish escapes when the player never reels it in', () => {
    const sea = emptySea();
    const { fish, rod } = fishAtBait(sea);
    rod.strike();
    rod.step(1, sea);
    expect(rod.state).toBe('on');
    rod.step(85, sea);
    expect(rod.state).toBe('up');
    expect(fish.hooked).toBe(false);
    expect(sea.caught).toBe(0);
  });

  it('an accurately aimed shark bites and snaps the line without becoming catchable', () => {
    const sea = emptySea();
    const shark = new Being('shark', sea.w, sea.depth);
    shark.x = 40; shark.y = shark.yf = 20; shark.dir = 1;
    sea.groups.shark = [shark];
    const rod = new Rod(sea.w, sea.depth, 0, 40, shark.x + shark.w - 1, shark.y + Math.floor(shark.h / 2));
    rod.tip = rod.stop;
    rod.step(1, sea);
    expect(rod.state).toBe('shark');
    rod.strike();
    expect(rod.step(1, sea)).toBe(false);
    expect(sea.missed.why).toBe('snap');
    expect(rod.catch).toBeNull();
    expect(shark.hooked).toBe(false);
    expect(CATCHABLE).not.toContain('shark');
    expect(CATCHABLE).not.toContain('megalodon');
  });

  it('aims at a ray wing instead of stealing the aim for a nearby small fish', () => {
    const sea = emptySea();
    const { rod } = fishAtBait(sea);
    const ray = new Being('ray', sea.w, sea.depth);
    ray.x = rod.x; ray.y = ray.yf = Math.floor(rod.tip); ray.hooked = false; ray.chew = 0;
    sea.groups.ray = [ray];
    expect(rod.aimedAt(sea).f).toBe(ray);
  });
});

describe('rare events, predation, and submarine', () => {
  it('birth randomness is reproducible and only one rare animal survives the sea update', () => {
    Math.random.mockReturnValue(0);
    const sea = new Ocean(200, 200, 40);
    expect(Object.values(sea.groups).flat().filter(fish => fish.rare).length).toBeGreaterThan(1);
    sea.onlyOneRare();
    expect(Object.values(sea.groups).flat().filter(fish => fish.rare)).toHaveLength(1);
    Math.random.mockReturnValue(0.5);
    expect(new Being('fish', 200, 200).rare).toBe(false);
    expect(new Being('sub', 200, 200).rare).toBe(false);
  });

  it('special bait summons a single megalodon from offscreen and does not duplicate it', () => {
    const sea = emptySea();
    expect(sea.scatterBait(40, 40, 100)).toBe('ok');
    const mega = sea.groups.megalodon[0];
    expect(mega.x >= sea.w || mega.x + mega.w <= 0).toBe(true);
    expect(sea.bait.life).toBeGreaterThan(0);
    expect(sea.scatterBait(40, 40, 100)).toBe('already');
    expect(sea.groups.megalodon).toHaveLength(1);
  });

  it('a departing shark can trigger the rare visitor, which leaves without respawning', () => {
    const sea = emptySea();
    const shark = new Being('shark', sea.w, sea.depth);
    shark.x = sea.w + 100; shark.dir = 1;
    sea.groups.shark = [shark];
    Math.random.mockReturnValue(0);
    sea.step(0, 0, 0, 40);
    expect(sea.groups.megalodon).toHaveLength(1);
    const mega = sea.groups.megalodon[0];
    mega.x = sea.w + 200; mega.dir = 1;
    sea.step(0, 0, 0, 40);
    expect(sea.groups.megalodon).toHaveLength(0);
  });

  it('predation replaces prey but cancels when the player hooked it first', () => {
    const sea = emptySea();
    const fish = new Being('fish', sea.w, sea.depth);
    sea.groups.fish = [fish];
    sea.pending = [fish, 1, 'fish'];
    sea.swallow(1);
    expect(sea.groups.fish).toHaveLength(1);
    expect(sea.groups.fish[0]).not.toBe(fish);
    const survivor = sea.groups.fish[0];
    survivor.hooked = true;
    sea.pending = [survivor, 1, 'fish'];
    sea.swallow(1);
    expect(sea.groups.fish[0]).toBe(survivor);
  });

  it('the submarine toggle remains on after crossing the screen and off after toggling again', () => {
    const sea = emptySea();
    expect(sea.toggleSub(60)).toBe(true);
    expect(sea.subs).toHaveLength(1);
    const boat = sea.subs[0];
    boat.x = sea.w + 100; boat.dir = 1;
    sea.step(0, 0, 40, 40);
    expect(sea.subs).toHaveLength(1);
    expect(sea.subs[0]).not.toBe(boat);
    expect(sea.toggleSub(60)).toBe(false);
    expect(sea.subs).toHaveLength(0);
  });
});
