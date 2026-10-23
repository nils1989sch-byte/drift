// Attacks. form: melee | dash | projectile | area | cone | buff.
// power, cooldown (s), windup (s, the enemy AI telegraphs ~2.5× as long), range (px), plus form-specific fields.
export const MOVES = {
  // Normal
  rempler:     { name: 'Rempler',      type: 'normal', form: 'melee', power: 30, cooldown: 0.6, windup: 0.12, range: 20 },
  sturmlauf:   { name: 'Sturmlauf',    type: 'normal', form: 'dash', power: 45, cooldown: 2.4, windup: 0.25, range: 72 },
  kampfruf:    { name: 'Kampfruf',     type: 'normal', form: 'buff', cooldown: 9, windup: 0.2, buff: { stat: 'atk', mult: 1.4, dur: 8 } },
  haerten:     { name: 'Härten',       type: 'normal', form: 'buff', cooldown: 9, windup: 0.2, buff: { stat: 'def', mult: 1.5, dur: 8 } },
  // Feuer
  glutbiss:    { name: 'Glutbiss',     type: 'fire', form: 'melee', power: 40, cooldown: 0.9, windup: 0.15, range: 20 },
  funkenflug:  { name: 'Funkenflug',   type: 'fire', form: 'projectile', power: 34, cooldown: 1.2, windup: 0.18, range: 150, speed: 170 },
  flammenring: { name: 'Flammenring',  type: 'fire', form: 'area', power: 55, cooldown: 4.5, windup: 0.35, range: 34 },
  feuerwalze:  { name: 'Feuerwalze',   type: 'fire', form: 'cone', power: 62, cooldown: 4, windup: 0.3, range: 54, angle: 0.75 },
  // Wasser
  spritzer:    { name: 'Spritzer',     type: 'water', form: 'projectile', power: 34, cooldown: 1.1, windup: 0.16, range: 150, speed: 180 },
  wellenstoss: { name: 'Wellenstoß',   type: 'water', form: 'dash', power: 50, cooldown: 2.6, windup: 0.25, range: 70 },
  strudel:     { name: 'Strudel',      type: 'water', form: 'area', power: 58, cooldown: 4.5, windup: 0.35, range: 36 },
  nebel:       { name: 'Nebelschleier', type: 'water', form: 'buff', cooldown: 10, windup: 0.2, buff: { stat: 'def', mult: 1.6, dur: 7 } },
  // Pflanze
  blattwurf:   { name: 'Blattwurf',    type: 'plant', form: 'projectile', power: 34, cooldown: 1.1, windup: 0.16, range: 140, speed: 165 },
  dornenhieb:  { name: 'Dornenhieb',   type: 'plant', form: 'melee', power: 44, cooldown: 1.0, windup: 0.15, range: 22 },
  sporenwolke: { name: 'Sporenwolke',  type: 'plant', form: 'area', power: 38, cooldown: 5, windup: 0.4, range: 40, slow: 2.5 },
  wurzelkraft: { name: 'Wurzelkraft',  type: 'plant', form: 'buff', cooldown: 12, windup: 0.3, heal: 0.25 },
  // Blitz
  funkenschlag:{ name: 'Funkenschlag', type: 'bolt', form: 'melee', power: 40, cooldown: 0.8, windup: 0.12, range: 20 },
  blitzpfeil:  { name: 'Blitzpfeil',   type: 'bolt', form: 'projectile', power: 44, cooldown: 1.6, windup: 0.2, range: 170, speed: 260 },
  donnerkreis: { name: 'Donnerkreis',  type: 'bolt', form: 'area', power: 60, cooldown: 5, windup: 0.4, range: 38 },
  // Stein
  steinwurf:   { name: 'Steinwurf',    type: 'stone', form: 'projectile', power: 40, cooldown: 1.4, windup: 0.22, range: 130, speed: 140 },
  felsramme:   { name: 'Felsramme',    type: 'stone', form: 'dash', power: 56, cooldown: 2.8, windup: 0.3, range: 66 },
  beben:       { name: 'Beben',        type: 'stone', form: 'area', power: 66, cooldown: 5.5, windup: 0.45, range: 46 },
  steinhaut:   { name: 'Steinhaut',    type: 'stone', form: 'buff', cooldown: 10, windup: 0.25, buff: { stat: 'def', mult: 1.7, dur: 8 } },
  // Wind
  windklinge:  { name: 'Windklinge',   type: 'wind', form: 'projectile', power: 38, cooldown: 1.1, windup: 0.14, range: 160, speed: 220 },
  boeensturz:  { name: 'Böensturz',    type: 'wind', form: 'dash', power: 46, cooldown: 2.2, windup: 0.2, range: 80 },
  wirbelsturm: { name: 'Wirbelsturm',  type: 'wind', form: 'cone', power: 56, cooldown: 4, windup: 0.3, range: 58, angle: 0.8 },
};
export const move = (id) => MOVES[id] || MOVES.rempler;
