import test from 'node:test';
import assert from 'node:assert/strict';
import { createSoundtrack } from '../src/soundtrack.js';

const settle = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture() {
  const requests = [], states = [], errors = [], sources = [], gains = [];
  let creations = 0;
  const context = {
    currentTime: 0, state: 'suspended',
    resume() { this.state = 'running'; return Promise.resolve(); },
    suspend() { this.state = 'suspended'; return Promise.resolve(); },
    decodeAudioData: async () => ({ duration: 16 }),
    destination: {},
    createGain() {
      const gain = { value: 0, events: [],
        cancelScheduledValues(time) { this.events = this.events.filter(event => event.time < time); },
        setValueAtTime(value, time) { this.value = value; this.events.push({ value, time }); },
        linearRampToValueAtTime(value, time) { this.events.push({ value, time }); },
      };
      const node = { gain, connect() {} }; gains.push(node); return node;
    },
    createBufferSource() {
      const source = { starts: 0, connect() {}, start() { this.starts++; } };
      sources.push(source); return source;
    },
  };
  const audio = createSoundtrack({
    contextFactory() { creations++; return context; },
    fetchAudio(url) { const task = deferred(); requests.push({ url: String(url), ...task }); return task.promise; },
    onState: state => states.push(state), onError: (error, continuing) => errors.push({ error, continuing }),
  });
  const resolve = index => requests[index].resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) });
  return { audio, context, requests, states, errors, sources, gains, resolve, creations: () => creations };
}

test('stays silent and downloads nothing until explicitly enabled', async () => {
  const f = fixture();
  f.audio.select('archive');
  await settle();
  assert.equal(f.creations(), 0);
  assert.equal(f.requests.length, 0);
  f.audio.setEnabled(true);
  assert.equal(f.context.state, 'running');
  await settle();
  assert.match(f.requests[0].url, /04-archive-room-loop.wav$/);
  f.resolve(0); await settle();
  assert.equal(f.states.at(-1).track, 'archive');
  assert.equal(f.sources[0].loop, true);
});

test('late downloads cannot select a stale scene or unmute after disabling', async () => {
  const f = fixture();
  f.audio.setEnabled(true); await settle();
  f.audio.select('human');
  f.resolve(1); await settle();
  assert.equal(f.states.at(-1).track, 'human');
  f.resolve(0); await settle();
  assert.equal(f.states.at(-1).track, 'human');
  f.audio.select('archive');
  f.audio.setEnabled(false);
  f.resolve(2); await settle();
  assert.equal(f.states.at(-1).enabled, false);
  assert.equal(f.states.at(-1).track, 'human');
  assert.equal(f.gains[0].gain.events.at(-1).value, 0);
});

test('switching back cancels the stale target, reuses sources and maintains fade continuity', async () => {
  const f = fixture();
  f.audio.setEnabled(true); await settle(); f.resolve(0); await settle();
  f.context.currentTime = 3;
  f.audio.select('archive'); f.resolve(1); await settle();
  f.context.currentTime = 4;
  f.audio.select('green'); await settle();
  assert.equal(f.sources.length, 2);
  assert.ok(f.sources.every(source => source.starts === 1));
  const curves = f.gains.slice(1).map(node => node.gain.events.filter(event => event.time >= 4));
  assert.equal(curves[0][0].value, .5);
  assert.equal(curves[1][0].value, .5);
  assert.equal(curves[0].at(-1).time, 6);
  for (let i = 0; i < curves[0].length; i++) {
    assert.ok(Math.abs(curves[0][i].value + curves[1][i].value - 1) < 1e-10);
  }
  f.audio.select('human');
  f.audio.select('green'); await settle();
  f.resolve(2); await settle();
  assert.equal(f.states.at(-1).track, 'green');
  assert.equal(f.requests.length, 3);
});

test('failed next track keeps the current music, failed first load allows retry', async () => {
  const f = fixture();
  f.audio.setEnabled(true); await settle();
  f.requests[0].reject(new Error('offline')); await settle();
  assert.equal(f.states.at(-1).enabled, false);
  f.audio.setEnabled(true); await settle(); f.resolve(1); await settle();
  f.audio.select('human'); f.requests[2].reject(new Error('offline')); await settle();
  assert.equal(f.states.at(-1).enabled, true);
  assert.equal(f.states.at(-1).track, 'green');
  assert.equal(f.errors.at(-1).continuing, true);
});

test('background/pagehide pauses the audio clock and return resumes the same sources', async () => {
  const f = fixture();
  f.audio.setEnabled(true); await settle(); f.resolve(0); await settle();
  f.audio.setHidden(true);
  assert.equal(f.context.state, 'suspended');
  assert.equal(f.gains[0].gain.value, 0);
  f.audio.setHidden(false); await settle();
  assert.equal(f.context.state, 'running');
  assert.equal(f.sources.length, 1);
  assert.equal(f.requests.length, 1);
  f.audio.setEnabled(false);
  f.audio.setHidden(true); f.audio.setHidden(false); await settle();
  assert.equal(f.context.state, 'suspended');
  assert.equal(f.states.at(-1).enabled, false);
});

test('blocked autoplay waits for a gesture, then starts the most recent scene', async () => {
  const f = fixture();
  const blocked = deferred();
  f.context.resume = () => blocked.promise;
  f.audio.setEnabled(true);
  assert.equal(f.states.at(-1).enabled, true);
  assert.equal(f.states.at(-1).waiting, true);
  f.audio.select('rain');
  assert.equal(f.requests.length, 0);
  f.context.resume = function () { this.state = 'running'; return Promise.resolve(); };
  f.audio.unlock(); await settle();
  assert.match(f.requests[0].url, /02-rain-on-concrete-loop.wav$/);
  f.resolve(0); blocked.resolve(); await settle();
  assert.equal(f.states.at(-1).waiting, false);
  assert.equal(f.states.at(-1).track, 'rain');
  assert.equal(f.requests.length, 1);
});

test('autoplay denial is recoverable and later gestures respect a manual mute', async () => {
  const f = fixture();
  f.context.resume = () => Promise.reject(Object.assign(new Error('gesture required'), { name: 'NotAllowedError' }));
  f.audio.setEnabled(true); await settle();
  assert.equal(f.states.at(-1).waiting, true);
  assert.equal(f.errors.length, 0);
  f.audio.setEnabled(false);
  f.audio.unlock(); await settle();
  assert.equal(f.requests.length, 0);
  assert.equal(f.states.at(-1).enabled, false);
  assert.equal(f.states.at(-1).waiting, false);
});
