export const SOUNDTRACKS = Object.freeze({
  green: { file: '01-quiet-threshold', title: '静谧边界' },
  rain: { file: '02-rain-on-concrete', title: '混凝土上的雨' },
  signal: { file: '03-signal-drift', title: '信号漂流' },
  archive: { file: '04-archive-room', title: '档案室' },
  human: { file: '05-human-node', title: '人类节点' },
});

const LEVEL = 0.55;
const TRANSITION = 2;
const smooth = t => t * t * (3 - 2 * t);

// Dependencies are injectable for deterministic async/lifecycle checks.
export function createSoundtrack({
  onState = () => {},
  onError = () => {},
  contextFactory = () => {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error('Web Audio unavailable');
    return new Context();
  },
  fetchAudio = url => fetch(url),
} = {}) {
  let context, master, enabled = false, hidden = false, desired = 'green', current = null;
  let version = 0, activation = 0, loading = false, waiting = false, suspendTimer;
  const pending = new Map();
  const layers = new Map();
  const emit = () => onState({ enabled, loading, waiting, track: current, desired });

  function ensureContext() {
    if (context) return;
    context = contextFactory();
    master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
  }

  function rampMaster(level, seconds = .35) {
    if (!context) return;
    const now = context.currentTime;
    if (master.gain.cancelAndHoldAtTime) master.gain.cancelAndHoldAtTime(now);
    else {
      const value = master.gain.value;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(value, now);
    }
    master.gain.linearRampToValueAtTime(level, now + seconds);
  }

  function gainAt(layer, time) {
    const t = Math.max(0, Math.min(1, (time - layer.start) / TRANSITION));
    return layer.from + (layer.to - layer.from) * smooth(t);
  }

  function crossfade(track) {
    const now = context.currentTime;
    for (const [id, layer] of layers) {
      const value = gainAt(layer, now);
      const target = id === track ? 1 : 0;
      layer.gain.gain.cancelScheduledValues(now);
      layer.gain.gain.setValueAtTime(value, now);
      for (let i = 1; i <= 64; i++) {
        layer.gain.gain.linearRampToValueAtTime(value + (target - value) * smooth(i / 64), now + TRANSITION * i / 64);
      }
      Object.assign(layer, { from: value, to: target, start: now });
    }
    current = track;
  }

  async function load(track) {
    if (layers.has(track)) return;
    if (pending.has(track)) return pending.get(track);
    const work = (async () => {
      const url = new URL('../assets/audio/' + SOUNDTRACKS[track].file + '-loop.wav', import.meta.url);
      const response = await fetchAudio(url);
      if (!response.ok) throw new Error('Audio resource unavailable');
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      const gain = context.createGain();
      gain.gain.value = 0;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      gain.connect(master);
      source.start();
      // At most five silent/running sources. Reusing them preserves musical phase.
      layers.set(track, { source, gain, start: context.currentTime, from: 0, to: 0 });
    })();
    pending.set(track, work);
    try { await work; } finally { pending.delete(track); }
  }

  async function changeTrack() {
    const request = ++version;
    const track = desired;
    loading = current !== track && !layers.has(track);
    emit();
    try {
      await load(track);
      if (request !== version || !enabled) return;
      if (current !== track) crossfade(track);
      loading = false;
      if (!hidden) rampMaster(LEVEL);
      emit();
    } catch (error) {
      if (request !== version || !enabled) return;
      loading = false;
      if (!current) {
        enabled = false;
        rampMaster(0);
        context.suspend().catch(() => {});
      }
      emit();
      onError(error, Boolean(current));
    }
  }

  function failResume(error) {
    enabled = false;
    loading = false;
    waiting = false;
    ++version;
    rampMaster(0);
    emit();
    onError(error, false);
  }

  function resumePlayback() {
    const request = ++activation;
    // This call must stay synchronous with a gesture when autoplay is blocked.
    const resume = context.resume();
    waiting = context.state !== 'running';
    loading = !waiting && !current;
    emit();
    resume.then(() => {
      if (request !== activation || !enabled) return;
      waiting = false;
      if (hidden) { context.suspend().catch(() => {}); emit(); }
      else changeTrack();
    }).catch(error => {
      if (request !== activation || !enabled) return;
      if (error.name === 'NotAllowedError') {
        waiting = true; loading = false; emit();
      } else failResume(error);
    });
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    ++version;
    ++activation;
    clearTimeout(suspendTimer);
    if (!enabled) {
      loading = false;
      waiting = false;
      rampMaster(0);
      if (context) suspendTimer = setTimeout(() => {
        if (!enabled) context.suspend().catch(() => {});
      }, 400);
      emit();
      return;
    }
    try {
      ensureContext();
      if (hidden) { waiting = true; emit(); }
      else resumePlayback();
    } catch (error) { failResume(error); }
  }

  function select(track) {
    if (!SOUNDTRACKS[track] || track === desired) return;
    desired = track;
    if (enabled && context?.state === 'running' && !hidden) changeTrack();
    else emit();
  }

  function setHidden(value) {
    hidden = Boolean(value);
    clearTimeout(suspendTimer);
    if (!context) return;
    if (hidden) {
      ++activation;
      // Suspend immediately: page timers may freeze as soon as it is hidden.
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setValueAtTime(0, context.currentTime);
      context.suspend().catch(() => {});
    } else if (enabled) {
      try { resumePlayback(); } catch (error) { failResume(error); }
    } else context.suspend().catch(() => {});
  }

  emit();
  return { select, setEnabled, setHidden, unlock() {
    if (enabled && !hidden && context && (waiting || context.state !== 'running')) {
      try { resumePlayback(); } catch (error) { failResume(error); }
    }
  } };
}
