import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, WEAPONS, WEAPON_ORDER, TICK, newPhys, normAngle, rayBoxT, blocked, inMeleeCone, resolveBoxes, stepMove } from './shared-game.js';

test('weapon order references valid weapon definitions', () => {
  assert.ok(WEAPON_ORDER.length > 0);
  for (const key of WEAPON_ORDER) {
    assert.ok(WEAPONS[key], `missing weapon definition: ${key}`);
    assert.ok(Number.isFinite(WEAPONS[key].damage) && WEAPONS[key].damage > 0);
    assert.ok(Number.isFinite(WEAPONS[key].cooldown) && WEAPONS[key].cooldown > 0);
  }
});

test('maps have valid bounds and collision boxes', () => {
  assert.ok(MAPS.length > 0);
  for (const map of MAPS) {
    assert.ok(Number.isFinite(map.bound) && map.bound > 0);
    assert.ok(Array.isArray(map.boxes));
    for (const box of map.boxes) {
      for (const key of ['x', 'z', 'w', 'd']) assert.ok(Number.isFinite(box[key]), `${map.name}: ${key}`);
      assert.ok(box.w > 0 && box.d > 0);
    }
  }
});

test('angle normalization stays within [-PI, PI)', () => {
  for (const value of [-100 * Math.PI, -Math.PI, 0, Math.PI, 100 * Math.PI, 1e12]) {
    const result = normAngle(value);
    assert.ok(Number.isFinite(result));
    assert.ok(result >= -Math.PI && result < Math.PI);
  }
});

test('movement remains finite and inside map bounds', () => {
  const map = MAPS[0];
  const p = newPhys(0, 0);
  for (let i = 0; i < 2000; i++) stepMove(p, { x: 1, z: 1, j: i % 3 === 0 }, 0.75, TICK, map);
  for (const key of ['x', 'y', 'z', 'vx', 'vy', 'vz']) assert.ok(Number.isFinite(p[key]), `${key} must remain finite`);
  assert.ok(Math.abs(p.x) <= map.bound && Math.abs(p.z) <= map.bound);
});

test('collision resolution returns finite coordinates', () => {
  const map = MAPS[0];
  const r = resolveBoxes(0, 0, map.boxes);
  assert.ok(Number.isFinite(r.x) && Number.isFinite(r.z));
});


test('ray-box intersection returns the nearest forward hit only', () => {
  const box = { x: 5, z: 0, w: 2, d: 2, h: 2 };
  assert.equal(rayBoxT(0, 0, 1, 0, box), 4);
  assert.equal(rayBoxT(0, 3, 1, 0, box), -1);
  assert.equal(rayBoxT(8, 0, 1, 0, box), -1);
});

test('line of sight and melee cone respect direction and range', () => {
  const box = { x: 2, z: 0, w: 1, d: 2, h: 2 };
  assert.equal(blocked(0, 0, 4, 0, [box]), true);
  assert.equal(blocked(0, 3, 4, 3, [box]), false);
  assert.equal(inMeleeCone(0, 0, 0, 0, -1, 2, 0.7), true);
  assert.equal(inMeleeCone(0, 0, 0, 0, 2.5, 2, 0.7), false);
});



test('leap launches once and is limited by cooldown', () => {
  const map = { ...MAPS[0], bound: 100, boxes: [] };
  const p = newPhys(0, 0);
  stepMove(p, { x: 0, z: -1, j: false, l: true }, 0, TICK, map);
  assert.ok(p.vy > 0, 'leap should lift the player');
  assert.ok(Math.hypot(p.vx, p.vz) > 5, 'leap should add horizontal speed');
  assert.ok(p.lc > 0, 'leap should start a cooldown');
  const before = p.vx;
  stepMove(p, { x: 1, z: 0, j: false, l: true }, 0, TICK, map);
  assert.ok(Math.abs(p.vx - before) < 5, 'a second leap during cooldown must not fire');
});
