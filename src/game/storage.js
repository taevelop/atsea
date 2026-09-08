// v4.5.0 storage compatibility. Blocked/corrupt storage uses in-memory defaults.
export function loadCounts(key, storage) {
  try { storage ??= globalThis.localStorage; const raw = JSON.parse(storage.getItem(key) || '{}'); const result = {};
    for (const [key,value] of Object.entries(raw)) if (Number.isFinite(value) && value > 0) result[key]=value;
    return result;
  } catch { return {}; }
}
export function loadSliderValues(keys, storage) {
  try { storage ??= globalThis.localStorage; const raw = JSON.parse(storage.getItem('atsea.sliders') || '{}'); const result = {};
    for (const key of keys) if (Number.isFinite(raw[key]) && raw[key]>=0) result[key]=raw[key];
    return result;
  } catch { return {}; }
}

export function loadViewMode(storage) {
  try { storage ??= globalThis.localStorage; return storage.getItem('atsea.view') === '2d' ? '2d' : '3d'; }
  catch { return '3d'; }
}
export function saveViewMode(mode, storage) {
  if (mode !== '2d' && mode !== '3d') return;
  try { storage ??= globalThis.localStorage; storage.setItem('atsea.view', mode); }
  catch { /* Keep the in-memory view when storage is unavailable. */ }
}
