# Audio Engine

All audio is synthesized programmatically via **Tone.js** (v15). No external audio files are used.

## Architecture

The audio layer lives in `src/services/audio/` and follows strict SRP:

- **`AudioEngine`** — global initialization, master effects chain (Reverb → LPF → Gain → Destination), volume binding to `GameStore`, and event subscriptions.
- **`SfxPlayer`** — one-shot sound synthesis using pooled `Tone.Noise` + `Tone.AmplitudeEnvelope` nodes. No `new` allocations in the hot path.
- **`MusicPlayer`** — background music loop using `Tone.PolySynth` and `Tone.Loop`. Switches to a denser, faster "Gold Rush" theme on demand.
- **`VehicleAudio`** — continuous engine/exhaust audio mapped to player speed. Uses `Tone.FatOscillator` (fat detuned sawtooth) for the engine rumble and `Tone.Noise` (pink) + `Tone.LFO` for rhythmic exhaust "chugging".

## Integration Rules

ECS systems **do not** import audio classes. They publish events through `globalEventBus`:

| Event | Emitter | Consumer (Audio) |
|-------|---------|------------------|
| `PlaySfxEvent` | `WeaponSystem`, `CollisionSystem` | `SfxPlayer.trigger(...)` |
| `BombDropEvent` | `EventSystem` | `SfxPlayer.trigger('bombDrop')` |
| `LootDropEvent` | `EventSystem` | `SfxPlayer.playTonalSequence(...)` |
| `StartVehicleAudioEvent` | `GameApp` | `VehicleAudio.start()` |
| `StopVehicleAudioEvent` | `GameApp` | `VehicleAudio.stop()` |
| `GoldRushStartedEvent` | `GameApp` | `MusicPlayer.enterGoldRush()` + jingle |
| `GoldRushEndedEvent` | `GameApp` | `MusicPlayer.exitGoldRush()` |

## Preset Catalog

All synthesis parameters are defined in `src/config/AudioConfig.ts`.

### SFX (One-Shot)

| Preset | Noise / Osc | Envelope (ADSR) | Filter Setup | Reverb Send | Thump Layer (MembraneSynth) | Notes |
|--------|-------------|-----------------|--------------|-------------|-----------------------------|-------|
| `shot` | White Noise | A: 1ms, D: 500ms, S: 0.0, R: 1.5s | LPF 1.5kHz (-24dB) | 35% | Note: `C2`, Decay: 0.6s, Octaves: 4, Release: 1.2s (-8dB) | Tank cannon fire |
| `explosion` | Brown Noise | A: 5ms, D: 1.5s, S: 0.1, R: 3.0s | LPF sweep 2kHz→200Hz (0.6s) | 60% | Note: `A1`, Decay: 1.5s, Octaves: 6, Release: 2.5s (-4dB) | Bomb / mine / kamikaze detonation |
| `hit` | Pink Noise | A: 1ms, D: 200ms, S: 0.0, R: 600ms | LPF 3.0kHz (-12dB) | 20% | Note: `C3`, Decay: 0.15s, Octaves: 2, Release: 0.4s (-12dB) | Projectile impact |
| `bombDrop` | White Noise | A: 100ms, D: 400ms, S: 0.0, R: 500ms | LPF sweep 4kHz→400Hz (1.0s) | 20% | *None* | Falling bomb whistle |
| `lootDrop` | Sine (PolySynth) | A: 10ms, D: 200ms, S: 0.0, R: 400ms | LPF 6.0kHz (-12dB) | 25% | *None* | Tonal jingle: 880→1100→1320 Hz (A5→C#6→E6) |

### Vehicle (Continuous)

| Element | Source | Filter | Modulation |
|---------|--------|--------|------------|
| Engine | FatOscillator (3× sawtooth, 25ct spread) 45–90 Hz | LPF 120–700 Hz | Pitch + cutoff sweep mapped linearly to player speed |
| Exhaust | Pink Noise | LPF 150–900 Hz | Gain modulated by LFO (2–6 Hz) for rhythmic "chug"; cutoff sweeps by speed |

### Music

- **Normal:** D-minor chord progression (`D3-F3-A3`, `G3-B3-D4`, `A3-C4-E4`, `D3-F3-A3`), 2 synth layers (sine + triangle polyphonic synths, LPF 2.0kHz), BPM 110.
- **Gold Rush:** D-major chord progression (`D3-F#3-A3`, `G3-B3-D4`, `A3-C#4-E4`, `D3-F#3-A3`), 4 layers (detuned polyphonic synths with sine, triangle, and square waveforms, LPF 3.5kHz), BPM 137.5 (1.25×).

## Anti-8-Bit & Warmth Techniques

Every preset applies the following techniques to avoid typical harsh chiptune character and sound premium:

1. **Reverb** — A global master `Tone.Reverb` (decay 2.5s, pre-delay 30ms, wet 25%) creates space and depth.
2. **Sub-Bass Layering (Thump)** — membrana synth layers (`MembraneSynth`) generate clean low-end punches for physically impactful events.
3. **ADSR & Slopes** — Avoids instant on/off states. Minimum attack times prevent click artifacts, and extended release stages allow natural acoustic fades.
4. **Low-Pass Filtering** — Every synthesizer and noise generator is passed through high-order low-pass filters (LPF) to warm the high end.
5. **Micro-variation** — Triggers introduce random detuning (±5%), timing jitter (±20ms), and gain offsets (±2dB) to create an organic, non-repetitive response.

## Adding a New Sound

1. Add a preset object to `AudioConfig.SFX` (or `AudioConfig.MUSIC`, etc.).
2. If it is a noise-based SFX, `SfxPlayer.initVoices()` will initialize the signal chain automatically. Tonal sounds must be added under `lootDrop` or triggered directly via `playTonalSequence`.
3. If it requires a low-frequency thump layer, add its membrane synth configuration to `SfxPlayer.initThumpSynths()`.
4. Emit the appropriate event from the relevant ECS system or `GameApp`.
5. Document the preset in this file.

