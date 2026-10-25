// Catch formula (MONSTER_FARM_GUIDE §4): p = clamp(basis × (1 − 0.8 × hp%) × ball × lvMod, 0.05, 0.95).
// The roll is spread over three shakes: p_shake = p^(1/3).
import { ITEMS } from '../farm/items.js';

export function ballFactor(id) { return ITEMS[id]?.ball ?? 1; }
export function captureChance(wild, own, ballId = 'orb') {
  const hpFrac = wild.hp / wild.maxHp;
  const lvMod = Math.max(0.6, Math.min(1.1, 1 - (wild.level - (own?.level ?? wild.level)) * 0.04));
  const p = wild.sp.catch * (1 - 0.8 * hpFrac) * ballFactor(ballId) * lvMod;
  return Math.max(0.05, Math.min(0.95, p));
}
export const shakeChance = (p) => Math.pow(p, 1 / 3);
