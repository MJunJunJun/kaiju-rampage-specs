"""
Synthesizes short, original arcade SFX for Kaiju Rampage as 16-bit mono WAVs.
Pure Python (no deps). Run:  python tools/audio/make_sfx.py
Out: build/audio/*.wav  -> copied into KaijuRampage/Assets/Audio
"""
import math
import os
import random
import struct
import wave

SR = 44100
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "build", "audio")
random.seed(7)


def write(name, samples, gain=0.9):
    os.makedirs(OUT, exist_ok=True)
    peak = max(1e-6, max(abs(s) for s in samples))
    k = gain / peak
    path = os.path.join(OUT, name + ".wav")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, s * k)) * 32767)) for s in samples))
    print(f"{name:12s} {len(samples) / SR:.2f}s")


def env(t, attack, decay_rate):
    a = min(1.0, t / attack) if attack > 0 else 1.0
    return a * math.exp(-t * decay_rate)


def fade_out(samples, ms=15):
    n = int(SR * ms / 1000)
    for i in range(n):
        samples[-1 - i] *= i / n
    return samples


def lowpass(samples, cutoff_fn):
    out, y = [], 0.0
    for i, x in enumerate(samples):
        fc = cutoff_fn(i / SR)
        a = 1 - math.exp(-2 * math.pi * fc / SR)
        y += a * (x - y)
        out.append(y)
    return out


def punch():
    n = int(SR * 0.22)
    s, ph = [], 0.0
    noise = lowpass([random.uniform(-1, 1) for _ in range(n)], lambda t: 2500 * math.exp(-t * 40) + 200)
    for i in range(n):
        t = i / SR
        f = 55 + 120 * math.exp(-t * 30)
        ph += 2 * math.pi * f / SR
        thump = math.sin(ph) * env(t, 0.002, 18)
        click = noise[i] * env(t, 0.0005, 70) * 1.6
        s.append(thump + click)
    return fade_out(s)


def explode():
    n = int(SR * 0.8)
    raw = [random.uniform(-1, 1) for _ in range(n)]
    boom = lowpass(raw, lambda t: 3000 * math.exp(-t * 6) + 120)
    s, ph = [], 0.0
    for i in range(n):
        t = i / SR
        ph += 2 * math.pi * (40 + 50 * math.exp(-t * 12)) / SR
        sub = math.sin(ph) * env(t, 0.003, 6)
        crackle = (random.random() < 0.004 * math.exp(-t * 4)) * random.uniform(-1, 1) * 2
        s.append(boom[i] * env(t, 0.004, 4.5) * 1.4 + sub * 0.9 + crackle)
    return fade_out(s, 40)


def zap():
    n = int(SR * 0.5)
    s, ph = [], 0.0
    for i in range(n):
        t = i / SR
        f = 1500 * math.exp(-t * 5) + 180 + 40 * math.sin(2 * math.pi * 30 * t)
        ph += 2 * math.pi * f / SR
        sq = 1.0 if math.sin(ph) > 0 else -1.0
        s.append((0.6 * math.sin(ph) + 0.4 * sq) * env(t, 0.004, 5))
    return fade_out(lowpass(s, lambda t: 6000), 30)


def spawn():
    n = int(SR * 0.65)
    s, ph = [], 0.0
    for i in range(n):
        t = i / SR
        f = 520 + 160 * math.sin(2 * math.pi * 11 * t) + 220 * t
        ph += 2 * math.pi * f / SR
        a = math.sin(math.pi * min(1, t / 0.65))  # swell in/out
        s.append(math.sin(ph) * a * 0.8)
    return fade_out(s)


def blip(f0, f1, dur, square=0.3):
    n = int(SR * dur)
    s, ph = [], 0.0
    for i in range(n):
        t = i / SR
        f = f0 + (f1 - f0) * (t / dur)
        ph += 2 * math.pi * f / SR
        sq = 1.0 if math.sin(ph) > 0 else -1.0
        s.append(((1 - square) * math.sin(ph) + square * sq) * env(t, 0.003, 9))
    return fade_out(s)


def sweep_up():
    n = int(SR * 0.6)
    s, ph = [], 0.0
    for i in range(n):
        t = i / SR
        f = 200 * math.pow(8, t / 0.6)
        ph += 2 * math.pi * f / SR
        s.append((math.sin(ph) + 0.3 * math.sin(2 * ph)) * min(1, t / 0.05) * (1 - t / 0.6) ** 0.5)
    return fade_out(s)


def arpeggio(freqs, note_dur, wave_mix=0.35, decay=5.0, tail=0.4):
    n_total = int(SR * (note_dur * len(freqs) + tail))
    s = [0.0] * n_total
    for k, f in enumerate(freqs):
        start = int(SR * note_dur * k)
        ph = 0.0
        for i in range(start, n_total):
            t = (i - start) / SR
            ph += 2 * math.pi * f / SR
            sq = 1.0 if math.sin(ph) > 0 else -1.0
            s[i] += ((1 - wave_mix) * math.sin(ph) + wave_mix * sq) * env(t, 0.005, decay) * 0.6
    return fade_out(s, 40)


def main():
    write("sfx_punch", punch())
    write("sfx_explode", explode())
    write("sfx_zap", zap(), 0.75)
    write("sfx_spawn", spawn(), 0.6)
    write("sfx_button", blip(880, 1400, 0.12))
    write("sfx_countdown", blip(660, 660, 0.18, 0.5), 0.7)
    write("sfx_start", sweep_up(), 0.8)
    write("sfx_win", arpeggio([523.25, 659.25, 783.99, 1046.5, 1318.5], 0.11, 0.3, 4.0, 0.6))
    write("sfx_lose", arpeggio([392.0, 311.13, 261.63, 196.0], 0.22, 0.5, 3.0, 0.5), 0.8)


if __name__ == "__main__":
    main()
