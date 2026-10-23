// Inventory with stacks, money and an 8-slot hotbar (slots 0..7 of the bag). Pure logic, no DOM.
//   const inv = createInventory({ size: 24 });
//   inv.add('seeds_ruebe', 5) → leftover (0 = all fit)   inv.remove(id, n) → bool   inv.count(id)   inv.has(id, n)
//   inv.select(slot) / inv.next() / inv.prev()   inv.active → { id, n, def, slot } | null   inv.activeId
//   inv.money (number), inv.addMoney(n), inv.spend(n) → bool    inv.onChange(fn) → unsubscribe
import { ITEMS, itemDef, iconKey } from './items.js';

export const HOTBAR = 8;

export function createInventory(opts = {}) {
  const size = Math.max(HOTBAR, opts.size ?? 24);
  const slots = new Array(size).fill(null);     // { id, n }
  const listeners = new Set();
  let activeSlot = 0;
  let money = opts.money ?? 0;
  // optional external money (e.g. { get: () => player.rupees, set: (v) => player.rupees = v })
  const ext = opts.moneyAccessor && typeof opts.moneyAccessor.get === 'function' ? opts.moneyAccessor : null;
  const changed = (why) => { for (const f of listeners) { try { f(why, inv); } catch (e) { console.warn('[farm] inventory listener', e); } } };
  const stackOf = (id) => itemDef(id)?.stack ?? 99;

  const inv = {
    size, slots, HOTBAR,
    get money() { return ext ? (+ext.get() || 0) : money; },
    set money(v) { v = Math.max(0, Math.min(999999, Math.floor(v || 0))); if (ext) ext.set(v); else money = v; changed('money'); },
    addMoney(n) { inv.money = inv.money + n; return inv.money; },
    spend(n) { if (inv.money < n) return false; inv.money = inv.money - n; return true; },

    /** Adds n items; fills existing stacks first, then free slots (hotbar first). Returns what did not fit. */
    add(id, n = 1) {
      if (!ITEMS[id] || n <= 0) return n;
      const max = stackOf(id);
      let left = n;
      for (const s of slots) { if (left <= 0) break; if (s && s.id === id && s.n < max) { const k = Math.min(max - s.n, left); s.n += k; left -= k; } }
      for (let i = 0; i < size && left > 0; i++) { if (!slots[i]) { const k = Math.min(max, left); slots[i] = { id, n: k }; left -= k; } }
      if (left !== n) changed('add');
      return left;
    },
    /** Removes n items (from the active slot first, then from the back). false (and nothing removed) if not enough. */
    remove(id, n = 1) {
      if (inv.count(id) < n) return false;
      let left = n;
      const order = [activeSlot, ...[...slots.keys()].reverse().filter((i) => i !== activeSlot)];
      for (const i of order) {
        const s = slots[i];
        if (!s || s.id !== id) continue;
        const k = Math.min(s.n, left); s.n -= k; left -= k;
        if (s.n <= 0) slots[i] = null;
        if (left <= 0) break;
      }
      changed('remove');
      return true;
    },
    removeAt(slot, n = 1) {
      const s = slots[slot]; if (!s) return 0;
      const k = Math.min(s.n, n); s.n -= k; if (s.n <= 0) slots[slot] = null; changed('remove'); return k;
    },
    count(id) { let c = 0; for (const s of slots) if (s && s.id === id) c += s.n; return c; },
    has(id, n = 1) { return inv.count(id) >= n; },
    /** Swap two slots (for a UI drag/drop or "move to hotbar"). */
    swap(a, b) { if (a === b || a < 0 || b < 0 || a >= size || b >= size) return; [slots[a], slots[b]] = [slots[b], slots[a]]; changed('swap'); },

    select(slot) { const s = ((slot % HOTBAR) + HOTBAR) % HOTBAR; if (s !== activeSlot) { activeSlot = s; changed('select'); } return activeSlot; },
    next() { return inv.select(activeSlot + 1); },
    prev() { return inv.select(activeSlot - 1); },
    get activeSlot() { return activeSlot; },
    get active() { const s = slots[activeSlot]; return s ? { ...s, def: itemDef(s.id), slot: activeSlot } : null; },
    get activeId() { return slots[activeSlot]?.id ?? null; },
    get activeIcon() { return iconKey(slots[activeSlot]?.id); },
    /** Hotbar view for the UI: 8 entries { id, n, icon, name, active } | null-ish entries with active flag. */
    hotbar() { return slots.slice(0, HOTBAR).map((s, i) => (s ? { id: s.id, n: s.n, icon: iconKey(s.id), name: itemDef(s.id)?.name, kind: itemDef(s.id)?.kind, active: i === activeSlot } : { id: null, n: 0, icon: null, active: i === activeSlot })); },
    /** All non-empty stacks (bag view). */
    list() { return slots.map((s, i) => (s ? { slot: i, id: s.id, n: s.n, icon: iconKey(s.id), name: itemDef(s.id)?.name, kind: itemDef(s.id)?.kind } : null)).filter(Boolean); },
    /** Select the first hotbar slot holding `id` (e.g. auto-select the orb in battle). */
    selectItem(id) { const i = slots.findIndex((s, k) => k < HOTBAR && s?.id === id); if (i >= 0) inv.select(i); return i; },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    clear() { slots.fill(null); activeSlot = 0; changed('clear'); },

    serialize() { return { slots: slots.map((s) => (s ? [s.id, s.n] : 0)), active: activeSlot, money: ext ? undefined : money }; },
    deserialize(d) {
      if (!d || !Array.isArray(d.slots)) return false;
      slots.fill(null);
      d.slots.forEach((s, i) => { if (i < size && Array.isArray(s) && ITEMS[s[0]] && s[1] > 0) slots[i] = { id: s[0], n: Math.min(stackOf(s[0]), s[1] | 0) }; });
      activeSlot = Math.max(0, Math.min(HOTBAR - 1, d.active | 0));
      if (!ext && typeof d.money === 'number') money = d.money;
      changed('load');
      return true;
    },
  };
  return inv;
}

/** Starting kit for a new game. */
export function giveStarterKit(inv) {
  inv.add('hoe'); inv.add('can'); inv.add('sickle');
  inv.add('seeds_ruebe', 10); inv.add('orb', 5); inv.add('potion', 2);   // Bodo schenkt 10 Rübensaat (Guide §3)
  if (!inv.money) inv.money = 100;
}
