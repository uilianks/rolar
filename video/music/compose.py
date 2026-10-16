"""Background track for the presentation video, synthesized from scratch (no samples, no licences).

120 BPM so every scene cut in index.html (multiples of 0.5 s) lands on a beat. A minor, Am–F–C–G, one
chord per bar. Intro without drums, full groove from the first cut, a soft hit on every scene change,
and the drums drop for the outro.

    python3 music/compose.py   # writes music/track.wav (then encoded to assets/music.m4a)
"""

import wave
from pathlib import Path

import numpy as np

SR = 44100
BPM = 120
BEAT = 60 / BPM
LENGTH = 50.0
DRUMS_IN, DRUMS_OUT = 4.5, 45.0
CUTS = [4.5, 10.5, 16.5, 21.5, 28.5, 34.5, 40.0, 45.0]

rng = np.random.default_rng(7)  # deterministic: same file on every run
n = int(SR * LENGTH)
# Two buses: drums stay dry and tight; the melodic parts get the delay.
drums = np.zeros((2, n))
music = np.zeros((2, n))


def midi(note):
    return 440.0 * 2 ** ((note - 69) / 12)


def place(sig, at, gain=1.0, pan=0.0, bus=None):
    """Add a mono signal at time `at` (s) to a bus (melodic by default), equal-power pan in [-1, 1]."""
    bus = music if bus is None else bus
    i = int(at * SR)
    if i >= n:
        return
    sig = sig[: n - i] * gain
    angle = (pan + 1) * np.pi / 4
    bus[0, i : i + len(sig)] += sig * np.cos(angle)
    bus[1, i : i + len(sig)] += sig * np.sin(angle)


def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def saw(freq, dur, harmonics=12):
    t = t_axis(dur)
    return sum(np.sin(2 * np.pi * freq * k * t) / k for k in range(1, harmonics + 1) if freq * k < SR / 2) * (2 / np.pi)


def env(dur, attack=0.005, release=0.1):
    t = t_axis(dur)
    a = np.clip(t / max(attack, 1e-4), 0, 1)
    r = np.clip((dur - t) / max(release, 1e-4), 0, 1)
    return a * r


# ---------- Instruments ----------


def kick():
    t = t_axis(0.4)
    freq = 45 + 85 * np.exp(-t * 28)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    return np.sin(phase) * np.exp(-t * 9) + 0.15 * np.sin(phase * 2) * np.exp(-t * 40)


def hat(open_=False):
    dur = 0.18 if open_ else 0.05
    t = t_axis(dur)
    raw = rng.standard_normal(len(t) + 3)
    # Band-limited: high-pass by differencing, then a 3-tap smooth to take the fizz off the very top.
    noise = np.convolve(np.diff(raw), [0.25, 0.5, 0.25], mode="valid")
    return noise * np.exp(-t * (22 if open_ else 80)) * 0.3


def clap():
    t = t_axis(0.22)
    noise = np.diff(rng.standard_normal(len(t) + 1)) + 0.5 * rng.standard_normal(len(t))
    bursts = sum(np.exp(-np.clip(t - d, 0, None) * 60) * (t >= d) for d in (0, 0.011, 0.022))
    return noise * bursts * np.exp(-t * 14) * 0.45


def bass(note, dur):
    tone = saw(midi(note), dur, harmonics=6) + 0.6 * np.sin(2 * np.pi * midi(note) * t_axis(dur))
    return np.tanh(tone * 1.4) * env(dur, 0.004, 0.06)


def pad(notes, dur):
    out = np.zeros(int(dur * SR))
    for note in notes:
        for detune in (-0.08, 0.0, 0.08):
            out += saw(midi(note + detune), dur, harmonics=6)
    return out / (len(notes) * 3) * env(dur, 0.5, 0.6)


def pluck(note, dur=0.3):
    t = t_axis(dur)
    f = midi(note)
    tone = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t)
    return tone * np.exp(-t * 11) * env(dur, 0.002, 0.05)


def impact():
    t = t_axis(1.6)
    boom = np.sin(2 * np.pi * (38 + 40 * np.exp(-t * 6)) * t) * np.exp(-t * 3.2)
    air = rng.standard_normal(len(t)) * np.exp(-t * 7) * 0.05
    return boom + air


def riser(dur):
    t = t_axis(dur)
    noise = np.diff(rng.standard_normal(len(t) + 1))
    sweep = np.sin(2 * np.pi * np.cumsum(200 + 1800 * (t / dur) ** 2) / SR)
    return (noise * 0.25 + sweep * 0.08) * (t / dur) ** 2.5


# ---------- Arrangement ----------

# A minor, one chord per bar (2 s): Am, F, C, G. Roots for the bass, triads for pad and arpeggio.
CHORDS = [(45, (57, 60, 64)), (41, (53, 57, 60)), (36, (52, 55, 60)), (43, (55, 59, 62))]
bar = 4 * BEAT
bars = int(np.ceil(LENGTH / bar))

for b in range(bars):
    start = b * bar
    root, triad = CHORDS[b % 4]
    place(pad(triad, bar + 0.6), start, gain=0.22, pan=-0.2)
    place(pad(tuple(x + 12 for x in triad), bar + 0.6), start, gain=0.08, pan=0.3)

    for step in range(16):  # 16th-note grid
        at = start + step * BEAT / 4
        groove = DRUMS_IN <= at < DRUMS_OUT
        # Arpeggio: up and down the triad, an octave higher; quieter in the intro and outro.
        arp = list(triad) + [triad[0] + 12]
        note = arp[[0, 1, 2, 3, 2, 1, 0, 1][step % 8]] + 12
        place(pluck(note), at, gain=0.16 if groove else 0.1, pan=0.35 if step % 2 else -0.35)
        if not groove:
            continue
        if step % 4 == 0:
            place(kick(), at, gain=0.9, bus=drums)
        if step in (4, 12):
            place(clap(), at, gain=0.4, pan=0.05, bus=drums)
        if step % 2 == 0:
            place(hat(open_=step % 4 == 2), at, gain=0.26 if step % 4 == 2 else 0.16, pan=0.25, bus=drums)
        if step % 2 == 0:  # 8th-note bass, octave jump on the off-beats
            place(bass(root + (12 if step % 4 == 2 else 0), BEAT / 2 * 0.9), at, gain=0.42, bus=drums)

# Build-up into the first cut, and a soft hit on every scene change.
place(riser(3.5), DRUMS_IN - 3.5, gain=0.4, bus=drums)
for cut in CUTS:
    place(impact(), cut, gain=0.35, bus=drums)
# Final chord rings out over the end card.
place(pad((57, 60, 64, 69), 5.0), DRUMS_OUT, gain=0.25)

# ---------- Space and master ----------

# Stereo ping-pong delay (dotted eighth) on the melodic bus only, for a little room.
delay = int(SR * BEAT * 0.75)
wet = np.zeros_like(music)
for k in range(1, 5):
    shift = delay * k
    g = 0.28 * (0.5 ** (k - 1))
    src = music[::-1] if k % 2 else music
    wet[:, shift:] += src[:, : n - shift] * g
mix = drums + music + wet

fade_in = np.clip(t_axis(LENGTH) / 0.4, 0, 1)
fade_out = np.clip((LENGTH - t_axis(LENGTH)) / 2.5, 0, 1)
mix *= fade_in * fade_out
mix = np.tanh(mix * 1.1)  # gentle saturation / limiting
mix *= 0.89 / np.max(np.abs(mix))  # about -1 dBFS peak

out = Path(__file__).with_name("track.wav")
with wave.open(str(out), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix.T * 32767).astype("<i2").tobytes())
print(f"wrote {out} ({LENGTH:.0f} s, {BPM} BPM)")
