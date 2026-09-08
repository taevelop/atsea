import { describe, expect, it, vi } from 'vitest';
import { ViewManager } from '../../src/render/view-manager.js';

const fake = () => ({ init: vi.fn(), resize: vi.fn(), render: vi.fn(), dispose: vi.fn(), getStats: () => ({}) });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const setup = (create3d = vi.fn(async () => fake())) => {
  const ascii = fake(), onError = vi.fn();
  const views = new ViewManager({ ascii, create3d, onError });
  return { ascii, views, create3d, onError };
};

describe('one live presentation of a shared game state', () => {
  it('starts in 2D without creating WebGL, and reuses 3D across repeated switches', async () => {
    const { ascii, views, create3d } = setup();
    const state = { ocean: {}, clock: 12 };
    views.resize({ width: 400 });
    views.render(state);
    expect(create3d).not.toHaveBeenCalled();
    await views.setMode('3d');
    const three = views.three;
    expect(three.resize).toHaveBeenCalledWith({ width: 400 });
    for (let i = 0; i < 20; i++) {
      await views.setMode('2d'); views.render(state);
      await views.setMode('3d'); views.render(state);
    }
    expect(create3d).toHaveBeenCalledTimes(1);
    expect(three.init).toHaveBeenCalledTimes(1);
    expect(three.dispose).not.toHaveBeenCalled();
    expect(ascii.render).toHaveBeenCalledTimes(21);
    expect(three.render).toHaveBeenCalledTimes(20);
    expect(three.render.mock.calls.every(([value]) => value === state)).toBe(true);
  });

  it('never activates a late 3D load after the user has chosen 2D', async () => {
    const gate = deferred(), three = fake();
    three.init.mockImplementation(() => gate.promise);
    const { views, create3d } = setup(vi.fn(async () => three));
    const first = views.setMode('3d');
    await views.setMode('2d');
    const second = views.setMode('3d');
    await views.setMode('2d');
    gate.resolve();
    expect(await first).toBe(false);
    expect(await second).toBe(false);
    expect(views.mode).toBe('2d');
    expect(create3d).toHaveBeenCalledTimes(1);
    expect(await views.setMode('3d')).toBe(true);
  });

  it('keeps 2D usable after a download failure and retries only presentation', async () => {
    const broken = fake(); broken.init.mockRejectedValue(new Error('missing model'));
    const good = fake();
    const { views, ascii, onError } = setup(vi.fn().mockResolvedValueOnce(broken).mockResolvedValueOnce(good));
    const state = { ocean: { rod: {} }, clock: 50 };
    expect(await views.setMode('3d')).toBe(false);
    expect(views.status).toBe('error'); expect(views.mode).toBe('2d');
    views.render(state);
    expect(ascii.render).toHaveBeenCalledWith(state);
    expect(broken.dispose).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(await views.setMode('3d')).toBe(true);
    views.render(state);
    expect(good.render).toHaveBeenCalledWith(state);
  });

  it('draws the identical frame in 2D if 3D rendering fails', async () => {
    const { views, ascii } = setup();
    await views.setMode('3d');
    const three = views.three, state = { ocean: {}, paused: true };
    three.render.mockImplementation(() => { throw new Error('lost context'); });
    views.render(state);
    expect(ascii.render).toHaveBeenLastCalledWith(state);
    expect(views.mode).toBe('2d');
    expect(three.dispose).toHaveBeenCalledTimes(1);
  });

  it('disposes an in-flight renderer after page exit without activating it', async () => {
    const gate = deferred(), three = fake();
    three.init.mockImplementation(() => gate.promise);
    const { views, ascii } = setup(vi.fn(async () => three));
    const pending = views.setMode('3d');
    await Promise.resolve();
    views.dispose(); gate.resolve();
    expect(await pending).toBe(false);
    expect(three.dispose).toHaveBeenCalledTimes(1);
    expect(ascii.dispose).toHaveBeenCalledTimes(1);
    expect(await views.setMode('3d')).toBe(false);
  });

  it('ignores an invalidated load when a new 3D retry has already succeeded', async () => {
    const gate = deferred(), old = fake(), current = fake();
    old.init.mockImplementation(() => gate.promise);
    const { views } = setup(vi.fn().mockResolvedValueOnce(old).mockResolvedValueOnce(current));
    const first = views.setMode('3d');
    await Promise.resolve();
    views.fail3d(new Error('context loss while loading'));
    expect(await views.setMode('3d')).toBe(true);
    gate.resolve();
    expect(await first).toBe(false);
    expect(views.three).toBe(current);
    expect(old.dispose).toHaveBeenCalledTimes(1);
    expect(current.dispose).not.toHaveBeenCalled();
  });
});
