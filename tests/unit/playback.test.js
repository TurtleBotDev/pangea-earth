import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlaybackClock } from '../../src/playback.js';
import { eraAt, nearestSnapshot } from '../../src/geological-time.js';
import { rotatePoint, rotationAt, futureRotationAt } from '../../motion.js';

test('playback caps stalled frames and resets timing after a pause', () => {
  const clock = new PlaybackClock();
  clock.start(240);
  assert.equal(clock.advance(0, 240, 10), 240);
  assert.equal(clock.advance(5000, 240, 10), 239);
  clock.stop();
  assert.equal(clock.advance(6000, 239, 10), 239);
  clock.start(239);
  assert.equal(clock.advance(9000, 239, 10), 239);
  assert.equal(clock.advance(9050, 239, 10), 238.5);
});

test('playback reverses, stops exactly at endpoints, and restarts', () => {
  const clock = new PlaybackClock();
  clock.start(-99.5);
  clock.advance(0, -99.5, 10);
  assert.equal(clock.advance(100, -99.5, 10), -100);
  assert.equal(clock.playing, false);
  assert.equal(clock.start(-100), 300);
  clock.reverse();
  clock.advance(0, 299.5, 10);
  assert.equal(clock.advance(100, 299.5, 10), 300);
  assert.equal(clock.playing, false);
  assert.equal(clock.start(300), -100);
});

test('rotation interpolation supports uneven sampling and clamps to its extent', () => {
  const data = {
    times: [0, 10, 30],
    rotations: {
      1: [
        [1, 0, 0, 0],
        [Math.SQRT1_2, 0, 0, Math.SQRT1_2],
        [0, 0, 0, 1],
      ],
    },
  };
  const [longitude, latitude] = rotatePoint(rotationAt(data, 1, 20), [0, 0]);
  assert.ok(Math.abs(longitude - 135) < 1e-10);
  assert.ok(Math.abs(latitude) < 1e-10);
  assert.deepEqual(rotationAt(data, 1, -1), data.rotations[1][0]);
  assert.deepEqual(rotationAt(data, 1, 50), data.rotations[1][2]);
  assert.throws(() => rotationAt(data, 2, 10), /Missing plate rotation 2/);
});

test('geological labels and snapshot selection handle boundary ages', () => {
  assert.equal(eraAt(0), 'Present day');
  assert.equal(eraAt(240), 'Middle Triassic');
  assert.equal(eraAt(237), 'Middle Triassic');
  assert.equal(eraAt(236.9), 'Late Triassic');
  assert.equal(nearestSnapshot(125).age, 160);
  assert.equal(nearestSnapshot(5).age, 0);
});

test('future projection follows a constant angular rate, with continuity at today', () => {
  const rotation = (angle) => [Math.cos(angle / 2), 0, 0, Math.sin(angle / 2)];
  const data = { times: [0, 5], rotations: { 1: [rotation(0), rotation(Math.PI / 4)] } };
  for (const [age, expectedLongitude] of [
    [0, 0],
    [-5, -45],
    [-10, -90],
    [-15, -135],
  ]) {
    const quaternion = futureRotationAt(data, 1, age);
    const [longitude] = rotatePoint(quaternion, [0, 0]);
    assert.ok(Math.abs(longitude - expectedLongitude) < 1e-10);
    assert.ok(Math.abs(Math.hypot(...quaternion) - 1) < 1e-10);
  }
  const [nearToday] = rotatePoint(futureRotationAt(data, 1, -1e-8), [0, 0]);
  assert.ok(Math.abs(nearToday) < 1e-6);
  const staticData = { times: [0, 5], rotations: { 1: [rotation(0), rotation(0)] } };
  assert.deepEqual(futureRotationAt(staticData, 1, -100), [1, 0, 0, 0]);
});

test('future stage composition is correct when the present orientation is nonidentity', () => {
  const halfZ = Math.PI / 8;
  const present = [Math.SQRT1_2, Math.SQRT1_2, 0, 0];
  // Older orientation = a 45-degree Z rotation composed with today's X rotation.
  const older = [
    Math.cos(halfZ) * Math.SQRT1_2,
    Math.cos(halfZ) * Math.SQRT1_2,
    Math.sin(halfZ) * Math.SQRT1_2,
    Math.sin(halfZ) * Math.SQRT1_2,
  ];
  const data = { times: [0, 5], rotations: { 1: [present, older] } };
  const [longitude, latitude] = rotatePoint(futureRotationAt(data, 1, -5), [0, 0]);
  assert.ok(Math.abs(longitude + 45) < 1e-10);
  assert.ok(Math.abs(latitude) < 1e-10);
  data.rotations[1][1] = older.map((value) => -value);
  const [signEquivalent] = rotatePoint(futureRotationAt(data, 1, -5), [0, 0]);
  assert.ok(Math.abs(signEquivalent + 45) < 1e-10);
});
