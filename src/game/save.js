// Savegame in localStorage (always wrapped in try/catch – private mode, blocked storage …).
const KEY = 'drift_save_v1';
export function saveGame(data) {
  try { localStorage.setItem(KEY, JSON.stringify({ v: 1, t: Date.now(), ...data })); return true; } catch { return false; }
}
export function loadGame() {
  try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch { return null; }
}
export function hasSave() { return !!loadGame(); }
export function clearSave() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
