import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, normalizeSettings } from './client-settings.js';
import { SKIN_ORDER } from './shared-game.js';

test('settings are bounded and malformed values fall back safely', () => {
  const settings = normalizeSettings({
    sens: 999,
    touchSens: -5,
    fov: 'not-a-number',
    volume: 9,
    showFps: 'yes',
    name: '  <admin>\n' + 'x'.repeat(30),
    adminKey: { toString: () => 'bad' },
    knifeModel: 'unknown',
  });
  assert.equal(settings.sens, 3);
  assert.equal(settings.touchSens, 0.2);
  assert.equal(settings.fov, DEFAULTS.fov);
  assert.equal(settings.volume, 1);
  assert.equal(settings.showFps, DEFAULTS.showFps);
  assert.equal(settings.name, 'adminxxxxxxx');
  assert.equal(settings.adminKey, '');
  assert.equal(settings.knifeModel, 'tanto');
});

test('only recognized weapon skins are loaded', () => {
  const validSkin = SKIN_ORDER[0];
  const settings = normalizeSettings({
    skins: { pistol: validSkin, knife: validSkin, unknown: validSkin, rifle: '__proto__' },
  });
  assert.equal(settings.skins.pistol, validSkin);
  assert.equal(settings.skins.knife, validSkin); // ナイフにもスキンを付けられる
  assert.equal(settings.skins.unknown, undefined);
  assert.equal(settings.skins.rifle, undefined);
});

test('invalid settings roots and empty names do not crash or persist invalid data', () => {
  assert.deepEqual(normalizeSettings(null).skins, {});
  assert.equal(normalizeSettings([]).name, DEFAULTS.name);
  assert.equal(normalizeSettings({ name: '\u0000<>  ' }).name, DEFAULTS.name);
});
