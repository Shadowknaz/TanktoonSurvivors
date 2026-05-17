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

### SFX (One-Shot & Cinematic Multi-Layered)

| Preset | Layers | Synthesis Mechanics | Processing & Buses | Notes |
|--------|--------|---------------------|--------------------|-------|
| `shot` | **1. Crack** (Pink NoiseSynth)<br>**2. Wave** (Sine OscSweep)<br>**3. Blast** (Brown Noise LPF Sweep) | • **Crack:** A: 1ms, D: 200ms, Vol: -10dB (smooth pink punch)<br>• **Wave:** 250Hz→20Hz (0.3s sweep), Distortion (0.6), Vol: -12dB<br>• **Blast:** Muffled LPF sweep 1.5kHz→60Hz (1.5s, -48dB/oct), Distortion (0.9), Vol: -14dB | Master cinematic compression bus (threshold: -24dB, ratio: 20, attack: 1ms, release: 500ms) + 6-second epic Reverb (decay: 6s, pre-delay: 50ms, wet: 0.5) | Muffled premium cinematic tank cannon fire |
| `explosion` | **1. Boom** (Brown Noise Sweep)<br>**2. Debris** (Pink Noise HPF) | • **Boom:** Muffled LPF sweep 1.2kHz→100Hz (1.5s, -24dB/oct), Distortion (0.7), Vol: -12dB<br>• **Debris:** HPF 1.5kHz, A: 100ms, D: 1.5s, Vol: -18dB | Routing through the epic cinematic Reverb (decay 6s) + heavy Master Compressor | Muffled target detonation and physical wreckage crash |
| `hit` | **1. Armor** (MetalSynth)<br>**2. Debris** (Pink Noise HPF) | • **Armor:** Freq: 200Hz, Harms: 5.1, ModIdx: 32, Resonance: 2kHz, Octaves: 1.5, Vol: -8dB<br>• **Debris:** HPF 1.5kHz, A: 100ms, D: 1.5s, Vol: -18dB | • **Armor:** Master Cinematic Compressor<br>• **Debris:** Epic Cinematic Reverb send | Direct shell impact and armor penetration clang |
| `bombDrop` | *Single* (White Noise) | A: 100ms, D: 400ms, S: 0.0, R: 500ms | LPF sweep 4kHz→400Hz (1.0s), routed through standard Master Reverb (2.5s) | Falling bomb whistle |
| `lootDrop` | *Tonal* (Sine PolySynth) | A: 10ms, D: 200ms, S: 0.0, R: 400ms | LPF 6.0kHz, routed through standard Master Reverb (2.5s) | Tonal jingle: 880→1100→1320 Hz (A5→C#6→E6) |

### Vehicle (Continuous)

| Element | Source | Filter | Modulation |
|---------|--------|--------|------------|
| Engine | FatOscillator (3× sawtooth, 25ct spread) 45–90 Hz | LPF 120–700 Hz | Pitch + cutoff sweep mapped linearly to player speed |
| Exhaust | Pink Noise | LPF 150–900 Hz | Gain modulated by LFO (2–6 Hz) for rhythmic "chug"; cutoff sweeps by speed |

### Music

The music system is programmatically orchestrated using a single high-performance `Tone.Loop` running on eighth notes (`8n`). This avoids multi-loop CPU overhead, minimizes Garbage Collection, and guarantees perfect track alignment.

- **Harmonies & Key:** Normal gameplay plays in D-minor. Gold Rush mode transitions smoothly to D-major (ramping up tempo by 1.25x).
- **Crescendo / Dynamic Intensity Engine:** The music engine reacts dynamically to global game state, wave numbers, and survival time, opening up instruments step-by-step using smooth volume ramp sweeps (1.5s):
  - **Intensity 0 (Wave 1, survival time < 30s):** *Ambient Intro* — Only Pad chords and slow Arpeggiator are active.
  - **Intensity 1 (Wave 2, survival time >= 30s):** *Rhythmic Pulse* — Bassline fades in, adding low-end pulse.
  - **Intensity 2 (Wave 3, survival time >= 60s):** *Thumping Groove* — Membrane Kick drum fades in, playing syncopated downbeats.
  - **Intensity 3 (Wave 4, survival time >= 90s):** *Backbeat Drive* — Noise Snare drum fades in, delivering a solid backbeat.
  - **Intensity 4 (Wave 5+, survival time >= 120s):** *Full Battle Charge* — Hi-Hats fade in, completing the dynamic drive.
  - **Gold Rush Overdrive:** Accelerates tempo to 137.5 BPM, transitions bass to high-energy alternate-octave driving rhythm, triggers 16th-note hyper-speed chiptune leads, plays four-on-the-floor kick patterns, and layers sizzling off-beat hi-hats.
- **Track & Drum Layout:**
  - **Pad Track:** Warm `Tone.PolySynth` with a triangle oscillator and LPF (800Hz) triggering 2-measure (`2m`) sustained chords. Adds a bright, soaring octave root during Gold Rush.
  - **Bass Track:** Thick `Tone.Synth` with a sawtooth oscillator and LPF (250Hz). Alternates octaves dynamically in Gold Rush, or pulses on quarter beats during normal gameplay.
  - **Arpeggiator Track:** Retro `Tone.Synth` with a square oscillator and BPF (1.5kHz). Cycles slow, gentle landscapes, or unleashes hyper-speed chiptune lines in Gold Rush.
  - **Kick Drum:** Synthesized thumping `Tone.MembraneSynth` that plays syncopated downbeat patterns in normal play, or a four-on-the-floor club beat in Gold Rush.
  - **Snare Drum:** Synthesized `Tone.NoiseSynth` utilizing bandpassed pink noise (1.2kHz) for a crisp backbeat crack on beats 2 and 4.
  - **Hi-Hats:** Sizzling `Tone.NoiseSynth` with an HPF (8.0kHz) triggering upbeat hi-hats.

## Anti-8-Bit & Warmth Techniques

Every preset applies the following techniques to avoid typical harsh chiptune character and sound premium:

1. **Dedicated DAW Bus Routing** — Incorporates parallel compression and reverb:
   - **Standard Bus:** Master `Tone.Reverb` (decay 2.5s, wet 25%) + master lowpass filter.
   - **Cinematic Bus:** Dedicated parallel `Tone.Compressor` (20:1 ratio, 1ms attack) + heavy `Tone.Reverb` (decay 6.0s, wet 50%) for cinema-grade low-end saturation, physical rumble, and massive epic tail.
2. **Sub-Bass Layering & Wave Shaping** — Custom low-frequency oscillator sweeps down to 20Hz and wave-shaping distortion (up to 0.9 wet) create rich harmonics and physical impacts that shake the headphones.
3. **ADSR & Slopes** — Avoids instant on/off states. Minimum attack times prevent click artifacts, and extended release stages allow natural acoustic fades.
4. **Low-Pass Filtering** — Every synthesizer and noise generator is passed through high-order low-pass filters (LPF) to warm the high end.
5. **Micro-variation** — Triggers introduce random detuning (±5%), timing jitter (±20ms), and gain offsets (±2dB) to create an organic, non-repetitive response.

## Adding a New Sound

1. Add a preset object to `AudioConfig.SFX` (or `AudioConfig.MUSIC`, etc.).
2. If it is a basic noise-based SFX, `SfxPlayer.initVoices()` will initialize the signal chain automatically. Tonal sounds must be added under `lootDrop` or triggered directly via `playTonalSequence`.
3. If it is a highly customized cinematic multi-layered sound, declare the private class nodes in `SfxPlayer.ts` and initialize them manually under `SfxPlayer.initCinematicVoices()`.
4. If it requires a low-frequency thump layer, add its membrane synth configuration to `SfxPlayer.initThumpSynths()`.
5. Emit the appropriate event from the relevant ECS system or `GameApp`.
6. Document the preset in this file.

