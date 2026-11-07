# KAIJU RAMPAGE: Alien Invasion

A mixed-reality arcade game for **Snap Spectacles**, built in **Lens Studio 5.23.2**.
You are a giant Kaiju defending a miniature city: your hands become monster claws, and you
**punch alien UFOs** before they zap the city. Survive 60 seconds to win.

> Built for the *Learn AR with SPECS* hackathon. Developed and tested in **Lens Studio Preview only**:
> no Spectacles hardware was available. See the [verification status](#verification-status).

---

## Design brief

The design decisions are in [`KaijuRampage/devpost/design-brief.md`](KaijuRampage/devpost/design-brief.md).
They come from an interview using the Devpost **plan-lens** skill pack (status: approved). The brief was written
after a first prototype existed and drove the second iteration: higher long-range UFOs, the right-side HUD,
the red directional damage warning, and coins with upgrades.

**The twist:** Kaiju usually destroy cities. In this game, **the Kaiju protects the city**.

## English project description

A tabletop city floats in your room. Purple saucers warp in from the edges and fly toward it.
When one hovers over a building it charges a tractor beam and zaps it. Your real hands are your
weapons: on Spectacles, glowing teal Kaiju claws follow your hand-tracked hands, and a fast swing
through a UFO smashes it. Chain hits for combos and score multipliers. Protect the reactor and keep
the city standing for 60 seconds.

## Features

- **Miniature city**: hover platform with roads, 6 low-poly buildings, central energy reactor,
  trees and street lights. Buildings show two damage stages (tilt + smoke, then collapse with lights out).
- **UFO prefab** (`Assets/Prefabs/UFO.prefab`): saucer hull, glowing dome with alien eyes, neon rim,
  under-lights and tractor beam. Idle spin, hover bob, warp-in, beam charge pulse, white hit flash,
  knockback wobble, and an explosion on death. Pooled (6 instances).
- **Kaiju claws**: separate left and right meshes (3 talons, thumb, dorsal spikes, cyan glow accents).
  On impact they pop and flash.
- **Punch detection**: swept collision between fist and UFO, a minimum fist speed (55 cm/s), and the
  fist must be moving *into* the target. Per-hand and per-UFO cooldowns apply. A closed fist (curled
  fingertips) does 2 damage; an open hand does 1.
- **60-second waves**: 0–20 s slow, 20–40 s moderate with 2-HP UFOs, 40–60 s fast and frequent.
- **Long-range UFOs**: saucers park at a comfortable punching height (8–16 cm below eye level), stand off
  10–15 cm from their target, and fire a beam that grows toward the building while it charges. The player
  never has to bend down.
- **Coins and upgrades**: every round pays 5 coins per UFO destroyed, **win or lose**, plus random bonus
  coins. The main-menu shop sells three upgrades with 5 levels each, and every level costs 1.6× the last:
  **ATTACK** (+1 punch damage at Lv1, +2 at Lv3, +3 at Lv5), **CITY HP** (+20 max health per level) and
  **BONUS COIN** (+10% chance per level of +3 coins per kill). Coins and levels are saved with
  persistent storage.
- **Red damage warning**: when the city is hit, a red glow flashes at the edge of the view on the side the
  attacking UFO is on.
- **Score, combo and multiplier**: kill 100, hit 10, ×1 to ×5 multiplier, a survival bonus, and a
  best score saved with persistent storage.
- **Holographic HUD**: main menu (high score, coins, upgrade shop), START button, 3-2-1-SMASH countdown, a score/timer/city-health
  panel on the player's **right side** (timer flashes in the last 10 s; health bar goes green → yellow → red),
  combo counter, result panel (score and coins earned) with RESTART and MENU buttons.
- **Effects** (pooled meshes, no particle systems): impact stars and rings, UFO explosion shards,
  city-damage smoke, floating score popups, victory fireworks, defeat collapse.
- **Built for real glasses** (see [Device readiness](#device-readiness)): table-top surface snapping via
  World Query, an arm's-reach layout, and hand-tracking glitch guards.
- **Audio**: 9 original synthesized SFX (`tools/audio/make_sfx.py`) plus an ambient loop from the
  Asset Library's SCI-FI SFX Pack.

## Input modes

Both modes feed the same `KaijuHandController` → `PunchDetector` path. The fallback never bypasses
the combat rules: the simulated claw physically lunges through the UFO and is judged by the same
collision, speed and cooldown checks.

| Mode | Where | How |
|---|---|---|
| **A: Spectacles hand tracking** | On device | SIK `HandInputData.getHand()` keypoints (wrist, knuckles, fingertips, palm) drive each claw. Punch = real hand motion. START/RESTART: pinch, poke or punch the button. |
| **B: Preview simulation** | Lens Studio Preview only (`deviceInfoSystem.isEditor()`) | Click or tap a UFO to aim; the nearest claw lunges at it. **Space** punches the most dangerous UFO. **S** starts, **R** restarts, **M** goes to the menu from the result screen, and **1 / 2 / 3** buy the ATTACK / CITY HP / BONUS COIN upgrades on the menu. Click START, RESTART, MENU or an upgrade button. The HUD shows `INPUT: PREVIEW SIMULATION`. |

Simulated input is labelled as simulation in the HUD and is disabled on device.

## Device readiness

Changes made specifically so the game behaves well on Specs, beyond what Preview can show:

| Area | What it does |
|---|---|
| **Surface snapping** (`SurfacePlacer.ts`) | Uses `WorldQueryModule` hit tests (rays 30–50° below the view) to find a horizontal table or desk 18–62 cm below the eyes and 38–70 cm away, and puts the city on it. With no suitable surface (or in Preview, where World Query is wearable-only) it floats 52 cm ahead and 32 cm below the eyes. The HUD keeps the same height relative to the eyes either way. |
| **Arm's-reach layout** | The city sits closer (52 cm). The far buildings are about 61 cm away and the near ones about 42 cm, so every UFO attack point can be punched without leaning. UFOs only attack from the front half. |
| **Pose smoothing** | Light exponential smoothing on the claw *visual* only. The punch contact point stays raw so hits feel instant. |
| **Re-acquire warm-up** | When a hand is (re)acquired, velocity is ignored for 4 frames, so a hand appearing beside a UFO never fires a punch. |
| **Glitch guard** | A fist jump of more than 18 cm **and** more than 1,100 cm/s in one frame is treated as a tracking glitch, not a punch. Speed caps at 650 cm/s. Hands use the real (unclamped) frame time, so slow frames don't swallow real punches. |
| **Size-normalised fist** | Fist = average fingertip→palm distance ÷ palm length < 0.75. This works for small and large hands; it replaced a fixed 6.5 cm threshold. |
| **Touchpad safety** | Mouse/tap/keyboard fallbacks are registered only in the editor, so the Specs touchpad can't fire screen-space picks. |
| **Comfort** | Punch speed threshold is 55 cm/s (a relaxed jab, not a full swing), the fist hit radius is a generous 6.5 cm, and there's no overhead or behind-the-player content. |

## Setup

1. Install **Lens Studio 5.23.x** (tested on 5.23.2.26081320, Windows).
2. Open `KaijuRampage/KaijuRampage.esproj`.
3. Built with **CLAD** (`ls-clad@ls-extensions` 1.0.0, Snap's Lens Studio agent plugin) and the **Lens Studio MCP**.
   I followed CLAD's `lens-studio-router` gate (project, MCP and sign-in checks) and its `verify-preview` / see-and-fix QA loop
   (recompile → logs → capture → judge → fix). I used CLAD's `specs-world-query` guidance for surface placement
   and `specs-preview-interaction` for hand-input testing.
4. The project already includes:
   - Spectacles Interaction Kit (Asset Library package v2.0.0; it reports `SIK Version : 0.18.0` at runtime).
     SIK **v4.0.0 does not compile on Lens Studio 5.23.2** because it needs the newer
     `SpecsInteractionModule` API.
   - Camera with Device Tracking set to **World**; project platform set to **Spectacles**.
   - SCI-FI SFX Pack (ambience) and AI Preview Agent – Inspect (editor-only debugging aid).

## Testing in Lens Studio Preview

1. In the Preview panel, set the device to **Spectacles** and the input to **Interactive → Sunlit Room**
   (or any room).
2. The city appears about 66 cm in front of and 30 cm below the camera. Tilt the preview camera
   down slightly to see it.
3. Press **S** or click **START**, then wait for the countdown.
4. Click UFOs or press **Space** to punch. Watch the score, combo, timer and city bar.
5. Do nothing for about 30 s to see the **defeat** path; defend for 60 s to see **victory**.
6. Press **R** or click **RESTART** to play again.

**Synthetic hand test (editor only):** on the `GameManager` component, enable `syntheticHandTest`. Two
scripted hand skeletons (right = closed fist, left = open hand) then drive the claws through the **same code
path as real Specs hand tracking**. The run also includes scripted adversarial checks: a slow touch must not
punch, an 80 cm one-frame teleport must be rejected, and a 0.5 s hand dropout must not fire. The HUD shows
`SYNTHETIC HAND TEST`, and `ROUND OVER ... handDiag=` reports re-acquires and rejected glitches.

The script logs `[Kaiju] ...` lines (state changes, every punch, zaps, 5-second stats with UFO screen
positions). Turn them off with `debugLogs` on the `GameManager` component.

## Technical architecture

```
KaijuGame (GameManager.ts – @component, state machine Title → Countdown → Playing → Result)
├── GameRoot (placed yaw-only in front of the user at load and on every START)
│   ├── City (Platform, Buildings/B_*, Reactor/Core, Decor)    ← CityHealthManager
│   ├── UFOs  (6 × UFO.prefab instances)                        ← EnemySpawner + UFOController
│   ├── FX    (pooled shards/stars/rings/puffs/popups)          ← EffectsManager
│   └── HUD   (runtime-built panels, text, buttons)             ← UIManager / HoloButton
└── KaijuHands (LeftClaw, RightClaw)                            ← KaijuHandController ×2
```

| Script | Role |
|---|---|
| `Scripts/Gameplay/ProgressionManager.ts` | Coins, upgrade levels and costs, persistent save/load, upgrade effects |
| `Scripts/UI/DamageIndicator.ts` | Red edge warning on the attacker's side of the view |
| `Scripts/GameManager.ts` | Orchestrator, game states, placement, event wiring, debug logs |
| `Scripts/Core/KaijuConfig.ts` | All tuning (waves, distances, punch thresholds, scoring, HUD layout) |
| `Scripts/Core/MathUtil.ts` | Easing, helpers, material tinting |
| `Scripts/Input/KaijuHandController.ts` | Claw pose from a hand skeleton (SIK or synthetic) or Preview simulation; smoothing, warm-up, glitch guard, fist state, velocity |
| `Scripts/Input/HandPoseSource.ts` | `SikHandSource` (real Specs tracking) and `SyntheticHandSource` (scripted skeleton for tests) |
| `Scripts/Input/SyntheticHandDriver.ts` | Editor-only scripted punches and adversarial tests for the tracked path |
| `Scripts/Gameplay/SurfacePlacer.ts` | WorldQueryModule table snapping with a comfort band and floating fallback |
| `Scripts/Input/PunchDetector.ts` | Swept collision + speed + direction + cooldowns → `onPunch` (UFOs and HUD buttons) |
| `Scripts/Input/InputManager.ts` | Preview fallback: tap ray-pick, keyboard, simulated lunges |
| `Scripts/Gameplay/UFOController.ts` | One UFO: flight, hover, beam charge, hit reaction, death |
| `Scripts/Gameplay/EnemySpawner.ts` | Pool + 60 s wave schedule + target spreading |
| `Scripts/Gameplay/CityHealthManager.ts` | City HP, building damage stages, reactor, target selection |
| `Scripts/Gameplay/ScoreManager.ts` / `ComboManager.ts` | Score, kills, best score / combo chain and multiplier |
| `Scripts/UI/UIManager.ts` | World-space holographic HUD, panels, `HoloButton` (SIK Interactable + punchable + clickable) |
| `Scripts/Effects/EffectsManager.ts` / `AudioManager.ts` | Pooled VFX / pooled SFX voices |

### Assets pipeline

All 3D models are generated procedurally, with no external art:

- `tools/lowpoly/meshkit.py`: a dependency-free low-poly toolkit (chamfered boxes, lathes, icospheres,
  mirroring) with flat shading and per-face vertex colors, and a binary glTF (`.glb`) writer.
- `tools/lowpoly/build_assets.py`: generates 32 meshes (city, buildings, reactor, decor, UFO parts,
  both claws, FX and UI shapes). About **4,000 triangles total**.
- Run `python tools/lowpoly/build_assets.py` and copy `build/meshes/*.glb` into
  `KaijuRampage/Assets/Meshes/`. Lens Studio reimports them in place.
- Materials: `M_Lit` (Uber PBR, vertex color = base color), `M_Glow` (Uber Unlit, vertex color),
  `M_Flash` (unlit tint for hit flashes and FX; cloned per tint once at startup) and `M_Panel`
  (translucent HUD).

### Performance notes

- Shared meshes and 4 base materials. All UFOs, FX and audio voices are pooled; nothing is
  instantiated during play.
- No physics simulation. Colliders exist only on the 2 HUD buttons (for SIK).
- Effects are simple mesh transforms; no particle systems, post effects or custom shaders.
- Colors are bright and saturated because the Spectacles display is **additive**: dark colors render
  transparent.

## Verification status

| Item | Status |
|---|---|
| Project opens and compiles (0 TypeScript errors) | ✅ Verified |
| City, UFOs, claws and HUD render in Spectacles Preview | ✅ Verified (screenshots) |
| START via keyboard **S** and via tap/click on the START button | ✅ Verified |
| UFOs spawn, fly to targets, charge and zap buildings/reactor | ✅ Verified (logs) |
| Preview punch (Space / click a UFO) → lunge → hit → destroy → score | ✅ Verified (logs) |
| Combo/multiplier, survival bonus | ✅ Verified (round: 28 kills, best combo 37, score 10,540) |
| Defeat path (city 0 HP → "CITY DESTROYED") | ✅ Verified |
| Victory path (60 s survived → "CITY SAVED!") | ✅ Verified |
| Restart after a finished round (R key, and tap on RESTART) | ✅ Verified |
| **Tracked-hand code path with synthetic skeletons** (orientation, closed vs open fist, velocity) | ✅ Verified in Preview: right fist 26/26 → dmg 2, left open 21/21 → dmg 1; full round won |
| Slow touch does **not** count as a punch | ✅ Verified (0 punches during the slow-touch window) |
| One-frame teleport glitch rejected; hand dropout gives no false punch | ✅ Verified (`teleportRejected` counted, no punch fired) |
| START pressed instantly after load shows the city (bug found and fixed by CLAD-style verify loop) | ✅ Verified |
| World Query surface snapping | ⚠️ Session starts without errors; Preview has no real surfaces, so the floating fallback is what got verified. **Snapping itself is untested.** |
| Peak render load (wave 3) | ✅ ~79 visible meshes, ~5k triangles, 0 runtime errors |
| No runtime errors in Preview logs | ✅ Verified |
| **Design-brief done criteria 1–7** (menu with high score and coins; Start → countdown → battle; punch destroys UFO and difficulty rises; right-side progress and health; red warning on the attacker's side; game-over with score and coins plus Restart; buying upgrades raises level, spends coins and changes the next round) | ✅ All 7 verified in Preview (logs and screenshots). Example: won 25 kills → +125 coins; ATTACK Lv1 → punches dmg 2; CITY HP Lv2 → cityMax 140; lost round still paid +10 coins; costs 30 → 48 (×1.6) |
| Coins and upgrades **persist after quitting the Lens** | ⚠️ Saved with `persistentStorageSystem`. Coins and levels survived repeated Lens resets in Preview (e.g. 52 → 87 → 122 coins, and CITY HP Lv2 kept), but a real app restart on Specs is untested |
| **LEAF automated tests for the done criteria** | ✅ **7/7 pass** in Preview (see [LEAF tests](#leaf-tests)) |
| SFX playback | ⚠️ Plays without errors; **sound not checked by ear** |
| SIK pinch/poke on buttons | ⚠️ `Interactable` components present; not exercised (no hand simulation available) |
| **Real hand tracking on Specs** | ❌ **Unverified on hardware.** The same code path passed the synthetic-skeleton tests, but real tracker noise, claw alignment over the real hand and the 0.75 fist ratio still need on-device tuning. |
| On-device performance / frame rate | ❌ Unverified |

## LEAF tests

Seven LEAF scenarios live in `KaijuRampage/Assets/Tests/KaijuLeaf/`, registered by the `LeafIndex` scene object.
They map one-to-one to the done criteria in the design brief. Run them from the LEAF panel, or through the
Lens Studio MCP (`run_leaf_scenario`), with the Preview camera facing forward.

| Scenario | Criterion | How it tests | Last result |
|---|---|---|---|
| `k1-main-menu` | 1 | Menu panel, `BEST … COINS …` line, START and 3 upgrade buttons present | ✅ (`BEST 8880 COINS 122`) |
| `k2-start-ik-reach` | 2 + reach | A full-arm **IK avatar** reaches and pinches START (a reachability check); countdown, then a UFO launches | ✅ |
| `k3-right-side-hud` | 4 | Score, timer and health bar shown; HUD sits 34 cm to the right of the head | ✅ |
| `k4-tracked-punch` | 3 | LEAF drives SIK's real `TrackedHand` (closed fist) through the UFOs: **6 kills via the Specs hand-tracking code path** (`PUNCH right(tracked) dmg=3`); wave table gets harder over time | ✅ |
| `k5-damage-warning` | 5 | Undefended city takes a hit; the red side warning appears | ✅ (`side=right`) |
| `k6-game-over-restart` | 6 | Round ends; result shows score and coins; RESTART starts a countdown | ✅ |
| `k7-upgrade` | 7 | On the menu, buying the cheapest affordable upgrade raises its level, spends exactly its cost, and the next level costs more | ✅ (`bonus Lv0→1, coins 122→72, next cost 50→80`) |

Not covered by a test: the upgrade's *effect* in the next round (verified through `ROUND OVER … cityMax=140` and
`PUNCH … dmg=2/3` log lines instead).

**Bugs the LEAF and verify loops caught, all fixed:**
- MENU and upgrade buttons never fired from a pinch, poke, punch or click. Their per-frame `update()` wasn't
  ticked, and the keyboard shortcuts had hidden this.
- A fast reach to *pinch* START counted as a *punch* and pressed it early. Punching a HUD button now needs a
  closed fist at ≥120 cm/s.
- HUD buttons now fire on pinch **release** (standard Specs behavior), with a 0.3 s press pop before the
  screen changes.
- START pressed during the first 0.3 s left the city hidden.
- At low frame rates, real fast punches were being rejected as "tracking glitches". The glitch guard now uses
  implied speed, not just distance.

## Known limitations

- Hand tracking (Mode A) has not been tested on real Specs. It is verified only with synthetic
  skeletons. Tuning values live in `KaijuConfig.ts`: `fistRatio`, `minPunchSpeed`, `teleport*`, `poseSmoothingRate`.
- Surface snapping relies on World Query (wearable-only) and is untested on hardware. If no surface is in
  the comfort band, the city floats.
- The HUD is hand-built (meshes, Text, SIK `Interactable`) rather than built from UIKit components: UIKit
  v4 needs a newer Lens Studio than 5.23.2.
- CLAD's Perfetto-based perf loop needs traces from a Specs device, so only a static budget check was done.
- The Preview's "VirtualHands" input could not render here, so tracked-hand simulation was not possible.
- The project targets Lens Studio 5.23.2 with SIK 0.18.0 / package v2.0.0. Newer Lens Studio versions
  may need the InteractionKit v4 migration.
- In Preview, the saved best score resets whenever the Lens reloads, so "NEW BEST!" can appear for low
  scores. Persistence on device is untested.
- Screenshots in `docs/screenshots/` come from Lens Studio Preview (simulated Spectacles display).
- The official *Learn AR with SPECS* rules page could not be found online, so check the submission
  format against the organizer's brief.

## Demo video storyboard (under 3 minutes)

| Time | Shot | Voice-over / caption |
|---|---|---|
| 0:00–0:10 | Title card over the room; the city fades in | "KAIJU RAMPAGE: Alien Invasion, a Spectacles arcade game." |
| 0:10–0:25 | Close-up of the low-poly city: reactor glow, towers, trees | "Your coffee table is now a miniature city…" |
| 0:25–0:40 | UFOs warp in, a beam charges, a building gets zapped and smokes | "…and aliens want it gone." |
| 0:40–1:05 | Claws on screen; punches land: flash, star, explosion, +100 popups | "Your hands become Kaiju claws. Punch the saucers out of the sky." |
| 1:05–1:25 | Combo counter climbs to ×5, score jumps | "Chain hits for combos and multipliers." |
| 1:25–1:50 | Wave 3: fast saucers, 2-hit UFOs (hit flash and knockback), timer flashing red | "Three waves in 60 seconds, each faster than the last." |
| 1:50–2:10 | "CITY SAVED!" with fireworks; then a defeat take with the reactor exploding | "Save the city… or watch it fall." |
| 2:10–2:35 | Split screen: Lens Studio Preview with mouse/Space fallback, scene hierarchy, generated assets | "Built in Lens Studio with SIK hand tracking, procedural low-poly assets and pooled effects." |
| 2:35–2:50 | RESTART pressed, quick replay | "One more round?" |
| 2:50–3:00 | End card: title, team, hackathon | — |

*(Footage would come from Preview recordings. Label any simulated-input shots as Preview simulation.)*

## Repository layout

```
Kaiju/
├── README.md                 ← this file
├── KaijuRampage/             ← Lens Studio project (open KaijuRampage.esproj)
│   └── Assets/{Scripts, Meshes, Materials, Prefabs, Audio}
├── tools/lowpoly/            ← procedural mesh generator (Python, no deps)
├── tools/audio/              ← SFX synthesizer (Python, no deps)
└── build/                    ← generated .glb / .wav outputs
```
