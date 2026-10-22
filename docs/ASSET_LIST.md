# Verbindliche Asset-Liste (Regie)

Alle Schlüssel müssen in `buildAssets()` existieren. Fehlt etwas, nutzt der Code Fallbacks – aber Ziel ist Vollständigkeit.
Richtungen `{dir}` = down, up, left, right (alle vier liefern; right darf gespiegeltes left sein, aber als eigenes Canvas).
Ankerpunkt bei allen Sprites: `canvas.ax`, `canvas.ay` = Fußpunkt (Default unten-mittig).

## tiles (16×16) – IDs aus src/data/tiles.js
grass (mode variant, ≥4 Varianten), grass_dark, grass_flowers (animiert, 2–3 Frames, phase), grass_tall (Halme, 2 Frames sway),
dirt, path, sand, water (animiert 3–4 Frames, phase), water_edge_n, shallow (animiert), stairs, bridge (Holzplanken),
stone_floor, dungeon_floor (variant), dungeon_wall, pit, wood_floor, void

## edges (16×16 Overlays) – Gruppen grass, path, dirt, sand, water, shallow, stone_floor
z. B. grass_n/s/w/e (Grasbüschel-Kante, die über Erde/Pfad/Sand/Wasser lappt), sand_n/... (Strand über Wasser),
path_* über dirt usw. `edgeGroup` + `edgePriority` mitliefern.

## faces (16×16, [top, mid, bottom])
rock (graue/braune Felsklippe mit vertikalen Rillen, Graslippe oben), dirt (Erdwand mit Wurzeln), brick (Dungeon-Mauer),
plinth_earth, plinth_stone (Sockel-Muster, z. B. 32×28)

## sprites
Held: hero_idle_{dir} (1–2), hero_walk_{dir} (6–8), hero_attack_{dir} (4–5, inkl. Schwert, Canvas ~32×32, Anker setzen),
hero_spin (8, optional), hero_hurt_{dir} (1), hero_lift_{dir} (2), hero_carry_{dir} (4, Hände über Kopf),
hero_item_get (1, Arme hoch), hero_fall (4, schrumpfend), hero_dead (2–3), hero_push_{dir} (2–4)
Gegner: octorok_walk_{dir} (2), octorok_rock (Projektil, 1–2), soldier_walk_{dir} (2–4), soldier_attack_{dir} (2),
slime_idle (3, hüpfen/quetschen), bat_fly (2), boss_golem_idle (2, ~40×40), boss_golem_attack (3), boss_golem_hurt (1)
NPC: npc_elder_idle_down (2), npc_girl_idle_down (2), npc_merchant_idle_down (2) – optional weitere Richtungen
Objekte: tree (groß, ~32×44, Anker Stammfuß), tree_small, bush, rock (hebbar), rock_big (32×24), pot, sign,
chest_closed, chest_open, house (~64×64, Dach + Tür, Anker unten-mittig), fence_h, fence_v, flower (2–3 sway),
statue, torch (3–4 Flammen), door_locked (16×32), block (schiebbar), switch_up, switch_down, heart_container,
bomb (2–3 Zündschnur), stump, mushroom, lilypad
Pickups: heart_pickup, rupee_green, rupee_blue, rupee_red (je 3 Frames Glanz), key_small
FX: fx_slash_{dir} (3 Frames Schwertbogen), fx_poof (5), fx_leaf (4 Varianten/Rotationen), fx_grass_bit (3), fx_spark (3),
fx_splash (4), fx_dust (3), fx_sparkle (4), fx_explosion (6, ~32×32), fx_heart_pop (3), fx_rock_bit (3)

## icons (UI, Canvas)
heart_full, heart_half, heart_empty, rupee, key, bomb, sword, shield, potion, map, compass, button_a, button_b
