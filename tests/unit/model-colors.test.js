import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ModelLibrary } from '../../src/render/model-library.js';
import { SeaRenderer } from '../../src/render/sea-renderer.js';

const material = (instance, name) => {
  let found;
  instance.object.traverse(mesh => {
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    found ||= materials.find(value => value.name === name);
  });
  return found;
};

describe('3D colors on real model assets', () => {
  const library = new ModelLibrary();
  const instances = [];
  const create = (...args) => {
    const instance = library.create(...args);
    instances.push(instance);
    return instance;
  };

  beforeAll(async () => {
    vi.stubGlobal('document', { getElementById: () => null });
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(async url => {
      const bytes = await readFile(new URL('../../public/models/' + url.split('/').at(-1), import.meta.url));
      return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    });
    await library.load();
  });

  afterAll(() => {
    for (const instance of instances) library.release(instance);
    library.dispose();
    vi.unstubAllGlobals();
  });

  it.each([
    ['fish0', 'Tetra_Main'], ['fish1', 'Top'], ['fish2', 'BlueTang_Main'],
    ['fish3', 'Butterfly_Main'], ['fish4', 'Pufferfish_Main'], ['fish5', 'Top'],
    ['fish6', 'Body'], ['lantern', 'Top'], ['shark', 'Top'], ['ray', 'Top'],
    ['jelly', 'Jelly bell'], ['seahorse', 'Seahorse ochre'], ['squid', 'Squid mantle'],
    ['octopus', 'Octopus mantle'], ['angler', 'Anglerfish_Main'],
    ['turtle', 'Turtle shell'], ['crab', 'Crab shell'], ['shrimp', 'Shrimp shell'],
    ['dolphin', 'Top'], ['whale', 'Top'], ['oarfish', 'Oarfish silver'],
  ])('shows the entity color on %s skin without recoloring other individuals', (id, skin) => {
    const original = create(id), originalColor = material(original, skin).color.clone();
    const orange = create(id, false, '#ff8700'), cyan = create(id, false, '#00ffff');
    expect(material(orange, skin).color.getHexString()).toBe('ff8700');
    expect(material(cyan, skin).color.getHexString()).toBe('00ffff');
    expect(material(original, skin).color).toEqual(originalColor);
    expect(material(orange, skin)).not.toBe(material(cyan, skin));
  });

  it('preserves clownfish stripes, eyes, and angler/lantern light sources', () => {
    for (const [id, names] of [
      ['fish6', ['Stripes', 'Outline', 'Natural dark eyes']],
      ['angler', ['Eyes', 'Anglerfish_Teeth', 'Light']],
      ['lantern', ['Natural dark eyes', 'Lantern photophores']],
    ]) {
      const original = create(id), tinted = create(id, false, '#ff00af');
      for (const name of names) expect(material(tinted, name)).toBe(material(original, name));
    }
  });

  it('keeps normal and rare angler bulbs yellow independently of skin tint', () => {
    const normal = create('angler', false, '#ff00af'), rare = create('angler', true);
    for (const instance of [normal, rare]) {
      const bulb = material(instance, 'Light');
      expect(bulb.color.getHexString()).toBe('fff700');
      expect(bulb.emissive.getHexString()).toBe('fff700');
      expect(bulb.emissiveIntensity).toBeGreaterThan(1);
      expect(instance.lure.glow.material.color).toEqual(bulb.color);
    }
    expect(rare.glow.material.color).not.toEqual(rare.lure.glow.material.color);
    expect(normal.lure.glow.material).toBe(rare.lure.glow.material);
    expect(normal.lure.glow.material.map).toBe(rare.glow.material.map);
  });

  it('keeps the yellow halo on the animated bulb after scaling and turning, and freezes when paused', () => {
    const instance = create('angler');
    instance.pivot.scale.setScalar(3);
    instance.group.position.set(40, -200, -5);
    const positions = [];
    for (const yaw of [0, Math.PI]) {
      instance.pivot.rotation.y = yaw;
      instance.mixer.setTime(.7);
      library.updateGlow(instance, 1, 1.5);
      const { mesh, glow, position } = instance.lure;
      const bulb = new THREE.Box3().setFromObject(mesh, true);
      expect(position.distanceTo(bulb.getCenter(new THREE.Vector3()))).toBeLessThan(.00001);
      expect(glow.getWorldPosition(new THREE.Vector3()).distanceTo(position)).toBeLessThan(.00001);
      positions.push(position.clone());
    }
    expect(positions[0].x).toBeGreaterThan(instance.group.position.x);
    expect(positions[1].x).toBeLessThan(instance.group.position.x);
    const frozen = instance.lure.glow.scale.clone();
    library.updateGlow(instance, 1, 1.5);
    expect(instance.lure.glow.scale).toEqual(frozen);
    instance.mixer.setTime(1.4);
    library.updateGlow(instance, 2, 1.5);
    expect(instance.lure.position.distanceTo(positions[1])).toBeGreaterThan(.001);
  });

  it('preserves rare and megalodon materials regardless of the entity color', () => {
    for (const [id, rare] of [['fish1', true], ['megalodon', false]]) {
      const instance = create(id, rare), skin = material(instance, 'Top');
      const before = { color: skin.color.clone(), emissive: skin.emissive.clone() };
      library.setColor(instance, '#ff8700');
      expect(material(instance, 'Top')).toBe(skin);
      expect(skin.color).toEqual(before.color);
      expect(skin.emissive).toEqual(before.emissive);
    }
  });

  it('makes rare skin emissive while keeping recognizable eyes and stripes', () => {
    const original = create('fish6'), rare = create('fish6', true);
    expect(material(rare, 'Body').emissiveIntensity).toBeGreaterThan(1);
    expect(material(rare, 'Body').emissive.getHex()).not.toBe(0);
    for (const name of ['Stripes', 'Outline', 'Natural dark eyes']) {
      expect(material(rare, name)).toBe(material(original, name));
    }
    expect(material(original, 'Body').emissiveIntensity).toBe(1);
    expect(material(original, 'Body').emissive.getHex()).toBe(0);
  });

  it.each([
    ['turtle', 'Turtle shell'], ['crab', 'Crab shell'], ['shrimp', 'Shrimp shell'],
    ['dolphin', 'Top'], ['whale', 'Top'], ['oarfish', 'Oarfish silver'],
  ])('gives rare %s the same luminous skin and halo as existing rare species', (id, skin) => {
    const rare = create(id, true), normal = create(id);
    const reference = create('shark', true);
    expect(material(rare, skin).color).toEqual(material(reference, 'Top').color);
    expect(material(rare, skin).emissive).toEqual(material(reference, 'Top').emissive);
    expect(material(rare, skin).emissiveIntensity).toBe(material(reference, 'Top').emissiveIntensity);
    expect(rare.glow.material).toBe(reference.glow.material);
    expect(normal.glow).toBeNull();
    library.updateGlow(rare, 2);
    const scale = rare.glow.scale.clone();
    library.updateGlow(rare, 2);
    expect(rare.glow.scale).toEqual(scale);
    normal.object.traverse(mesh => {
      if (mesh.isMesh && /eyes|iris/i.test(mesh.material.name)) {
        expect(material(rare, mesh.material.name)).toBe(mesh.material);
      }
    });
  });

  it('keeps small rare animals visible and freezes their individual glow with the clock', () => {
    const a = create('fish0', true), b = create('fish6', true);
    expect(create('fish0').glow).toBeNull();
    expect(a.glow).not.toBe(b.glow);
    expect(a.glow.material).toBe(b.glow.material);
    expect(a.glow.material.depthWrite).toBe(false);
    expect(a.glow.material.depthTest).toBe(true);
    a.pivot.scale.setScalar(.1);
    library.updateGlow(a, 0, 1.5);
    const size = a.glow.scale.clone();
    expect(size.y).toBeGreaterThan(2.5);
    const otherSize = b.glow.scale.clone();
    library.updateGlow(a, 0, 1.5);
    expect(a.glow.scale).toEqual(size);
    library.updateGlow(a, .7, 1.5);
    expect(a.glow.scale).not.toEqual(size);
    expect(b.glow.scale).toEqual(otherSize);
  });

  it('does not leave a rare halo on a normal animal after renderer pool reuse', () => {
    const renderer = Object.assign(Object.create(SeaRenderer.prototype), {
      library, instances: new Map(), pool: new Map(), world: new THREE.Group(),
    });
    const entity = { rare: true, color: '#f2fbff' };
    const acquire = () => renderer.acquire(entity, 'fish6', 8, 3, 0, 0);
    const rare = acquire();
    instances.push(rare);
    expect(rare.glow.parent).toBe(rare.group);
    entity.rare = false;
    const normal = acquire();
    instances.push(normal);
    expect(normal.glow).toBeNull();
    expect(rare.group.parent).toBeNull();
    entity.rare = true;
    expect(acquire()).toBe(rare);
    expect(normal.group.parent).toBeNull();
    expect(rare.glow.parent.parent).toBe(renderer.world);
  });

  it('refreshes colors when an instance is reused from the renderer pool', () => {
    const renderer = Object.assign(Object.create(SeaRenderer.prototype), {
      library, instances: new Map(), pool: new Map(), world: new THREE.Group(),
    });
    const first = { color: '#ff8700' }, second = { color: '#00ffff' };
    const acquire = entity => renderer.acquire(entity, 'fish1', 5, 2, 0, 0);
    const instance = acquire(first);
    instances.push(instance);
    expect(material(instance, 'Top').color.getHexString()).toBe('ff8700');
    renderer.recycle(first, instance);
    expect(acquire(second)).toBe(instance);
    expect(material(instance, 'Top').color.getHexString()).toBe('00ffff');
    second.color = '#ff00af';
    expect(acquire(second)).toBe(instance);
    expect(material(instance, 'Top').color.getHexString()).toBe('ff00af');
    delete second.color;
    acquire(second);
    expect(material(instance, 'Top')).toBe(material(create('fish1'), 'Top'));
  });

  it('draws 3D shrimp at twice the second-smallest fish length while retaining its ASCII footprint', () => {
    const renderer = Object.assign(Object.create(SeaRenderer.prototype), {
      library, instances: new Map(), pool: new Map(), world: new THREE.Group(),
      aspect: 2, metrics: {},
    });
    const animal = (kind, guideId, w, h, x) => ({ kind, guideId, w, h, x, y: 10, yf: 10, dir: 1, color: '#efb1b5' });
    const shrimp = animal('shrimp', 'shrimp', 22, 7, 60);
    const smallest = animal('fish', 'fish0', 3, 1, 10), next = animal('fish', 'fish1', 5, 1, 20);
    const ocean = { w: 160, floorY: 1000, groups: { fish: [smallest, next], shrimp: [shrimp] }, subs: [] };
    renderer.syncOcean({ ocean, cam: 0, rows: 40, clock: 0 });
    const width = being => { const i = renderer.instances.get(being); return i.size.x * i.pivot.scale.x; };
    expect(width(shrimp)).toBeCloseTo(width(next) * 2, 5);
    expect(width(shrimp)).toBeGreaterThan(width(smallest));
    expect(shrimp.w).toBe(22);
    expect(renderer.instances.get(shrimp).group.position.x).toBe(shrimp.x + shrimp.w / 2);
    instances.push(...renderer.instances.values());
  });

  it('reuses cached color materials across individuals and repeated color changes', () => {
    const a = create('fish6', false, '#ff8700'), b = create('fish6', false, '#ff8700');
    const skin = material(a, 'Body');
    expect(material(b, 'Body')).toBe(skin);
    library.setColor(a, '#00ffff');
    const count = library.materials.size;
    for (let i = 0; i < 20; i++) library.setColor(a, i % 2 ? '#00ffff' : '#ff8700');
    expect(library.materials.size).toBe(count);
    library.setColor(a, '#ff8700');
    expect(material(a, 'Body')).toBe(skin);
  });
});
