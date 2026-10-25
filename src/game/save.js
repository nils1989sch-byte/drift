// Savegame in localStorage (always wrapped in try/catch – private mode, blocked storage …).
// Content projects (index.html?content=…) use their own slot; editor playtests (slot null) never touch storage.
let KEY = 'drift_save_v1';
let mem = null;
export function setSaveSlot(slot) { KEY = slot === null ? null : slot ? `drift_save_v1:${slot}` : 'drift_save_v1'; mem = null; }
export function saveGame(data) {
  const s = { v: 1, t: Date.now(), ...data };
  if (KEY === null) { mem = s; return true; }
  try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch { return false; }
}
export function loadGame() {
  if (KEY === null) return mem;
  try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}
export function hasSave() { return !!loadGame(); }
export function clearSave() { if (KEY === null) { mem = null; return; } try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
