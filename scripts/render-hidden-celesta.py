"""Render the selected legato celesta + harp score on macOS. Requires numpy/ffmpeg."""
import json
import math
from pathlib import Path
import re
import subprocess
import tempfile

import numpy as np

PROJECT = Path(__file__).resolve().parents[1]
OUTPUT = PROJECT / 'assets' / 'audio'
NAME = '01-hidden-celesta-legato'
SR = 44100
PERIOD = 64
PRE_ROLL = .55

MELODY = [
    [(0, 69), (1.25, 74), (2.5, 77)],
    [(.25, 76), (1, 74), (2.3, 72)],
    [(0, 69), (1.6, 67), (2.5, 65)],
    [(.25, 64), (1.7, 69)],
    [(0, 74), (1, 77), (2.4, 79)],
    [(.1, 77), (1.1, 76), (2.65, 72)],
    [(0, 74), (1.6, 69), (2.5, 67)],
    [(.15, 64), (1.3, 69), (2.5, 74)],
]
CHORDS = [[62, 69, 74, 77], [62, 65, 69, 74], [58, 65, 69, 74], [57, 64, 67, 74],
          [62, 69, 74, 77], [62, 65, 69, 74], [58, 65, 69, 74], [57, 64, 69, 74]]


def build_score(destination):
    phrase = []
    for repeat in range(2):
        for bar, notes in enumerate(MELODY):
            for i, (offset, pitch) in enumerate(notes):
                phrase.append({'time': repeat * 32 + bar * 4 + offset,
                               'note': pitch, 'velocity': [48, 52, 47][i % 3] - repeat * 3,
                               'instrument': 0})
    for i, event in enumerate(phrase):
        next_time = phrase[i + 1]['time'] if i + 1 < len(phrase) else PERIOD
        event['duration'] = next_time - event['time'] + .22
    for bar in range(16):
        for j, index in enumerate([0, 1, 2, 1, 3, 2]):
            phrase.append({'time': bar * 4 + j * 2 / 3 + (.012 if j % 2 else 0),
                           'note': CHORDS[bar % 8][index], 'duration': 1.85,
                           'velocity': [34, 30, 33, 28, 31, 29][j] - (2 if bar >= 8 else 0),
                           'instrument': 1})
    events = []
    for repeat in range(3):
        for event in phrase:
            events.append({**event, 'time': round(PRE_ROLL + repeat * PERIOD + event['time'], 5)})
    events.sort(key=lambda event: event['time'])
    # A note-off must never terminate a later instance of the same pitch/part.
    last = {}
    for event in events:
        key = event['instrument'], event['note']
        if key in last:
            previous = last[key]
            previous['duration'] = min(previous['duration'], event['time'] - previous['time'] - .015)
        last[key] = event
    return [{'id': NAME, 'programs': [8, 46], 'events': events,
             'duration': PERIOD * 3 + 5, 'output': str(destination)}]


def ffmpeg(*args):
    return subprocess.run(['ffmpeg', '-y', '-hide_banner', *map(str, args)],
                          capture_output=True, check=True)


def metrics(path):
    result = ffmpeg('-i', path, '-af', 'loudnorm=print_format=json', '-f', 'null', '-')
    return json.loads(re.search(rb'\{[^{}]+\}', result.stderr).group())


def main():
    OUTPUT.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='construct-celesta-') as folder:
        temp = Path(folder)
        score = temp / 'score.json'
        dry_path = temp / 'dry.wav'
        score.write_text(json.dumps(build_score(dry_path)))
        subprocess.run(['swift', '-module-cache-path', str(temp / 'swift-cache'),
                        str(PROJECT / 'scripts' / 'render-midi-score.swift'), str(score)], check=True)
        raw = ffmpeg('-loglevel', 'error', '-i', dry_path, '-af', 'highpass=f=140,lowpass=f=3800',
                     '-f', 'f32le', '-ac', '2', '-ar', SR, '-').stdout
        samples = np.frombuffer(raw, '<f4').reshape(-1, 2).astype(np.float64)
        # Diffuse short reflections of the music; no independent noise or drone layer.
        length = round(SR * 1.0)
        t = np.arange(length) / SR
        impulse = np.random.default_rng(514).normal(size=(length, 2)) * np.exp(-t[:, None] / .22)
        impulse[:round(SR * .025)] = 0
        impulse[-round(SR * .1):] *= np.linspace(1, 0, round(SR * .1))[:, None]
        impulse /= np.sqrt(np.sum(impulse ** 2, axis=0))[None, :]
        n = 1 << (len(samples) + length - 2).bit_length()
        frequency = np.fft.rfftfreq(n, 1 / SR)
        damping = 1 / np.sqrt(1 + (frequency / 2400) ** 6)
        wet = np.fft.irfft(np.fft.rfft(samples, n, axis=0) * np.fft.rfft(impulse, n, axis=0)
                          * damping[:, None], n, axis=0)[:len(samples)]
        samples += .24 * wet
        start = round((PERIOD + PRE_ROLL) * SR)
        loop = samples[start:start + PERIOD * SR].copy()
        # Match the preceding cycle's tail to this cycle's first sample exactly.
        overlap = round(.18 * SR)
        blend = np.linspace(0, 1, overlap)[:, None]
        blend = blend * blend * (3 - 2 * blend)
        loop[-overlap:] = loop[-overlap:] * (1 - blend) + samples[start - overlap:start] * blend
        pcm = temp / 'loop.f32'
        loop.astype('<f4').tofile(pcm)
        input_args = ['-f', 'f32le', '-ar', SR, '-ac', '2', '-i', pcm]
        report = ffmpeg(*input_args, '-af', 'loudnorm=print_format=json', '-f', 'null', '-')
        measured = json.loads(re.search(rb'\{[^{}]+\}', report.stderr).group())
        gain = min(-23 - float(measured['input_i']), -3 - float(measured['input_tp']))
        loop *= 10 ** (gain / 20)
        assert np.max(np.abs(loop)) < 1
        loop.astype('<f4').tofile(pcm)
        loop_path = OUTPUT / (NAME + '-loop.wav')
        # Keep resampling periodic so it cannot add edge ringing or zero padding.
        repeated = temp / 'periodic.f32'
        np.tile(loop.astype('<f4'), (3, 1)).tofile(repeated)
        ffmpeg('-loglevel', 'error', '-f', 'f32le', '-ar', SR, '-ac', '2', '-i', repeated,
               '-af', 'aresample=24000,atrim=start_sample=1536000:end_sample=3072000',
               '-c:a', 'pcm_s16le', loop_path)
        preview = loop[:40 * SR].copy()
        preview[:round(.2 * SR)] *= np.linspace(0, 1, round(.2 * SR))[:, None]
        preview[-round(2.5 * SR):] *= np.linspace(1, 0, round(2.5 * SR))[:, None]
        preview_path = temp / 'preview.f32'
        preview.astype('<f4').tofile(preview_path)
        ffmpeg('-loglevel', 'error', '-f', 'f32le', '-ar', SR, '-ac', '2', '-i', preview_path,
               '-c:a', 'libmp3lame', '-b:a', '192k', OUTPUT / (NAME + '.mp3'))
        windows = loop.reshape(-1, 441, 2)
        rms = np.sqrt(np.mean(windows ** 2, axis=(1, 2)))
        summary = {'file': loop_path.name, 'duration': PERIOD, 'loudness': metrics(loop_path)['input_i'],
                   'peak_db': 20 * math.log10(float(np.max(np.abs(loop)))),
                   'near_silence_seconds': float(np.sum(rms < 10 ** (-55 / 20))) / 100,
                   'seam_step': float(np.max(np.abs(loop[0] - loop[-1])))}
        assert summary['near_silence_seconds'] == 0, 'Unintended gaps in loop'
        assert summary['seam_step'] < .02, 'Unexpected loop boundary discontinuity'
        print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
