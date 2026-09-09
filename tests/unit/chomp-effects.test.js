import { describe, expect, it, vi } from 'vitest';
import { Matrix4, Vector3 } from 'three';
import { Chomp, CHOMP_LIFETIME } from '../../src/game/ocean.js';
import { ChompEffects } from '../../src/render/chomp-effects.js';

const view = { aspect: 2, cam: 10, rows: 40 };

describe('3D predation feedback', () => {
  it('shows a large burst at the swallowed fish and freezes when the simulation pauses', () => {
    const effects = new ChompEffects(), chomp = new Chomp(30, 20);
    chomp.step(6);
    effects.update([chomp], view);
    const matrix = new Matrix4();
    effects.rings.getMatrixAt(0, matrix);
    expect(new Vector3().setFromMatrixPosition(matrix)).toEqual(new Vector3(30, -40, 12));
    expect(new Vector3().setFromMatrixScale(matrix).x * 2).toBeGreaterThan(7);
    const positions = effects.sparks.instanceMatrix.array.slice();
    effects.update([chomp], view);
    expect(effects.sparks.instanceMatrix.array).toEqual(positions);
    expect(effects.sparks.count).toBeGreaterThan(0);
    for (const mesh of effects.children) {
      expect(mesh.material.fog).toBe(false);
      expect(mesh.material.depthTest).toBe(false);
    }
    chomp.step(CHOMP_LIFETIME);
    effects.update([chomp], view);
    expect(effects.children.every(mesh => mesh.count === 0)).toBe(true);
    effects.dispose();
  });

  it('bounds simultaneous bursts, ignores offscreen events, and disposes GPU resources', () => {
    const effects = new ChompEffects();
    effects.update([new Chomp(30, 200)], view);
    expect(effects.rings.count).toBe(0);
    effects.update(Array.from({ length: 100 }, () => new Chomp(30, 20)), view);
    for (const mesh of effects.children) expect(mesh.count).toBeLessThanOrEqual(mesh.instanceMatrix.count);
    const dispose = effects.children.flatMap(mesh => [vi.spyOn(mesh, 'dispose'), vi.spyOn(mesh.geometry, 'dispose'), vi.spyOn(mesh.material, 'dispose')]);
    effects.dispose();
    expect(effects.children).toHaveLength(0);
    for (const spy of dispose) expect(spy).toHaveBeenCalledOnce();
  });
});
