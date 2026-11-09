"""Render the five original, noise-free soundtracks (Python + numpy + ffmpeg)."""
import json
import math
from pathlib import Path
import re
import subprocess
import tempfile
import wave

import numpy as np

SR = 24000
ROOT = Path(__file__).resolve().parents[1] / 'assets' / 'audio'
TRACKS = [
    ('01-green-terminal', 16), ('02-rain-on-concrete', 16),
    ('03-signal-drift', 12), ('04-archive-room', 16), ('05-human-node', 16),
]


def tone(out, freq, start, length, amp, pan=0, attack=.04, release=.3, triangle=False, vibrato=0):
    first = round(start * SR)
    t = np.arange(round(length * SR)) / SR
    phase = 2 * np.pi * freq * t + vibrato / 5 * np.sin(2 * np.pi * 5 * t)
    signal = 2 / np.pi * np.arcsin(np.sin(phase)) if triangle else np.sin(phase)
    envelope = np.minimum(1, t / min(attack, length / 3))
    envelope *= np.minimum(1, (length - t) / min(release, length / 3))
    mix(out, first, signal * envelope * amp, pan)


def mix(out, first, mono, pan):
    lo, hi = max(0, first), min(len(out), first + len(mono))
    if hi <= lo:
        return
    signal = mono[lo - first:hi - first]
    out[lo:hi, 0] += signal * math.sqrt((1 - pan) / 2)
    out[lo:hi, 1] += signal * math.sqrt((1 + pan) / 2)


def pad(out, freqs, start, length, amp, pan=0):
    for i, freq in enumerate(freqs):
        tone(out, freq * (1 + (i - 1) * .0025), start, length, amp / len(freqs),
             pan + (i - 1) * .16, 1, 2, vibrato=.12)


def pluck(out, freq, start, length=1.4, amp=.11, pan=0):
    t = np.arange(round(length * SR)) / SR
    phase = 2 * np.pi * freq * t
    signal = np.sin(phase) + .28 * np.sin(2 * phase) + .12 * np.sin(3 * phase)
    envelope = np.exp(-4.8 * t) * np.minimum(1, t / .008)
    envelope *= np.minimum(1, (length - t) / .08)
    mix(out, round(start * SR), signal * envelope * amp, pan)


def render(number, duration):
    out = np.zeros((round(duration * SR), 2), dtype=np.float64)
    if number == 1:
        for start in np.arange(0, duration, 4):
            pad(out, [55, 82.41, 110], start, 4.5, .34, -.08)
            tone(out, 220, start + .05, 1.8, .045, .22, .08, .9, triangle=True)
            tone(out, 330, start + 2.05, 1.3, .035, -.18, .08, .8, triangle=True)
            tone(out, 165, start, .17, .055, 0, .01, .12)
    elif number == 2:
        # Keep the musical pad; omit rain, droplets, air and machine-hum layers.
        for start in np.arange(0, duration, 8):
            pad(out, [65.41, 98, 130.81], start, 8.5, .30)
    elif number == 3:
        scale = [220, 261.63, 329.63, 392, 329.63, 261.63]
        for i, start in enumerate(np.arange(.15, duration, .5)):
            tone(out, scale[i % 6], start, .32, .045, -.35 if i % 2 else .35, .008, .16, triangle=True)
            if i % 4 == 0:
                tone(out, 110, start, .11, .045, 0, .005, .08)
        for start in np.arange(0, duration, 2):
            pad(out, [110, 164.81, 220], start, 1.7, .10)
    elif number == 4:
        chords = [[261.63, 329.63, 392], [220, 277.18, 329.63],
                  [246.94, 311.13, 369.99], [196, 246.94, 293.66]]
        for bar, start in enumerate(np.arange(0, duration, 4)):
            chord = chords[bar % 4]
            pad(out, [f / 2 for f in chord], start, 4.4, .13)
            for j, freq in enumerate(chord):
                pluck(out, freq, start + .35 + j * .42, pan=-.25 + j * .25)
            pluck(out, chord[0] * 2, start + 2.35, 1.2, .07, .2)
    elif number == 5:
        chords = [[220, 277.18, 329.63], [196, 246.94, 293.66],
                  [174.61, 220, 261.63], [196, 246.94, 329.63]]
        motif = [440, 493.88, 523.25, 493.88]
        for bar, start in enumerate(np.arange(0, duration, 4)):
            pad(out, chords[bar % 4], start, 4.8, .26, -.05)
            tone(out, motif[bar % 4], start + 1, 1.2, .045, .25, .15, .6, vibrato=.2)
            tone(out, motif[(bar + 1) % 4] / 2, start + 2.5, 1, .035, -.25, .12, .55)
        for start in np.arange(0, duration, 8):
            tone(out, 110, start, 3, .045, 0, .3, 1.5)
    return np.tanh(out * 1.25)


def wav(path, samples):
    assert np.max(np.abs(samples)) < 1, 'Clipping in generated audio'
    with wave.open(str(path), 'wb') as stream:
        stream.setnchannels(2)
        stream.setsampwidth(2)
        stream.setframerate(SR)
        stream.writeframes((samples * 32767).astype('<i2').tobytes())


def ffmpeg(*args):
    return subprocess.run(['ffmpeg', '-y', '-hide_banner', *map(str, args)],
                          capture_output=True, text=True, check=True)


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='construct-sound-') as directory:
        temp = Path(directory)
        for number, (name, period) in enumerate(TRACKS, 1):
            # A complete middle period includes the preceding phrase's decay.
            full = render(number, period * 3)
            loop = full[period * SR:2 * period * SR]
            np.testing.assert_allclose(loop, full[2 * period * SR:3 * period * SR], atol=1e-10)
            wav(temp / 'loop.wav', loop)
            report = ffmpeg('-i', temp / 'loop.wav', '-af', 'loudnorm=print_format=json', '-f', 'null', '-')
            loudness = json.loads(re.search(r'\{[^{}]+\}', report.stderr).group())
            gain_db = -20 - float(loudness['input_i'])
            loop *= 10 ** (gain_db / 20)
            wav(ROOT / (name + '-loop.wav'), loop)
            preview = render(number, 24) * 10 ** (gain_db / 20)
            preview[:SR // 2] *= np.linspace(0, 1, SR // 2)[:, None]
            preview[-int(SR * 2.5):] *= np.linspace(1, 0, int(SR * 2.5))[:, None]
            wav(temp / 'preview.wav', preview)
            ffmpeg('-loglevel', 'error', '-i', temp / 'preview.wav', '-c:a', 'libmp3lame',
                   '-b:a', '160k', '-ar', '44100', ROOT / (name + '.mp3'))
            step = np.max(np.abs(loop[0] - loop[-1]))
            peak = np.max(np.abs(loop))
            print(f'{name}: {period}s loop, peak {20 * math.log10(peak):.1f} dBFS, seam step {step:.6f}')


if __name__ == '__main__':
    main()
