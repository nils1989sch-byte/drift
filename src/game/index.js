// STUB (Regie) – wird vom Gameplay-Agenten ersetzt. Zeigt eine Test-Diorama-Karte.
import { parseMap } from '../engine/world.js';
import { Animator } from '../anim/index.js';
export function createGame({ assets, input, camera }) {
  const world = parseMap({
    id: 'test',
    rows: [
      '....................',
      '....................',
      '.......~~~~.........',
      '.......~~~~.........',
      '....................',
      '..........H.........',
      '....................',
      '....................',
      '....................',
      '....................',
    ],
    heights: [
      '11111111111111111111',
      '11111111111111111111',
      '11111110000111111111',
      '11111110000111111111',
      '11111111111111111111',
      '00000000001000000000',
      '00000000000000000000',
      '00000000000000002200',
      '00000000000000002200',
      '00000000000000000000',
    ],
  });
  const anim = new Animator(assets, 'hero');
  const player = { x: 80, y: 120, z: 0, shadow: 6, hp: 6, maxHp: 6, rupees: 0, keys: 0,
    draw(ctx, r) { r.sprite(anim.frame, this.x, this.y, this.z); } };
  camera.follow = player; camera.snap();
  return {
    world, player, entities: [player], state: 'play',
    update(dt) {
      const sp = 70 * dt;
      const nx = player.x + input.axis.x * sp, ny = player.y + input.axis.y * sp;
      if (world.walkable(nx, ny, player.z)) { player.x = nx; player.y = ny; }
      else {
        const h = world.heightAtPx(nx, ny);
        if (world.walkable(nx, ny, h) && world.def(Math.floor(nx/16), Math.floor(ny/16)).stairs) { player.z = h; player.x = nx; player.y = ny; }
      }
      if (world.def(Math.floor(player.x/16), Math.floor(player.y/16)).stairs) player.z = world.heightAtPx(player.x, player.y);
      anim.update(dt);
    },
  };
}
