/**
 * Central tuning values for KAIJU RAMPAGE. All distances are in centimeters
 * (Lens Studio world units), all times in seconds.
 */
export const KaijuConfig = {
  // ---------------------------------------------------------------- session
  roundDuration: 60,
  cityMaxHealth: 100,

  // Where the miniature city is placed relative to the player's head when a
  // round starts (yaw-only, so the table-top city is always level).
  // Kept within arm's reach: the far buildings sit ~61cm ahead, the near ones ~42cm.
  cityForward: 52,
  cityDown: 32,
  // Surface snapping (WorldQueryModule, Specs only): a detected horizontal surface
  // is used when it lies inside this comfortable band below the eyes.
  surfaceMinDrop: 18,
  surfaceMaxDrop: 62,
  surfaceMinDistance: 38,
  surfaceMaxDistance: 70,
  // HUD layout in GameRoot space (+Y up from the platform, -Z away from the player).
  // in-game score/time/health panel on the player's RIGHT (brief): ~35 deg right,
  // a little below eye level, ~60 cm away, turned to face the player
  hudBarPos: [34, 25, 3],
  hudBarYaw: -35,
  hudBarScale: 0.62,
  panelPos: [0, 33, -4], // title + result panels: floating above the city center
  countdownPos: [0, 27, 2],

  // ---------------------------------------------------------------- waves
  // 0-20s slow, 20-40s moderate, 40-60s fast / frequent.
  waves: [
    {from: 0, spawnInterval: 2.3, speed: 9, maxAlive: 3, hp: 1, chargeTime: 2.4},
    {from: 20, spawnInterval: 1.7, speed: 13, maxAlive: 4, hp: 2, chargeTime: 2.0},
    {from: 40, spawnInterval: 1.15, speed: 17, maxAlive: 6, hp: 2, chargeTime: 1.6}
  ],
  ufoPoolSize: 6,
  ufoRadius: 8.5, // hit sphere radius of a saucer (scaled model ~16cm wide)
  ufoSpawnRadiusMin: 40,
  ufoSpawnRadiusMax: 50,
  ufoSpawnBelowEyeMin: 4, // spawn heights, relative to eye level
  ufoSpawnBelowEyeMax: 16,
  ufoAttackHover: 9, // minimum clearance above the target's roof
  // UFOs stop at range and shoot down at the city, hovering 8-16 cm below eye
  // level so the player can punch them without bending (brief: "not too low").
  ufoAttackBelowEyeMin: 8,
  ufoAttackBelowEyeMax: 16,
  ufoStandOffMin: 10, // horizontal distance from the target where the UFO hovers
  ufoStandOffMax: 15,
  ufoMaxReach: 62, // hover points are pulled within this horizontal distance of the player
  zapDamageBuilding: 10,
  zapDamageReactor: 15,

  // ---------------------------------------------------------------- punching
  fistRadius: 6.5,
  minPunchSpeed: 55, // cm/s – hand must actually be moving, a touch is not a punch
  buttonPunchSpeed: 120, // punching a HUD button needs a fist AND this speed (avoids accidental presses)
  handCooldown: 0.22,
  ufoHitCooldown: 0.3,
  fistDamage: 2,
  openHandDamage: 1,
  previewPunchDamage: 1,
  velocitySmoothing: 0.5,
  // Tracked-hand robustness (Specs): smoothing, re-acquire warm-up, teleport guard, speed cap.
  poseSmoothingRate: 35, // 1/s – exponential smoothing of the wrist pose
  warmupFrames: 4, // frames after (re)acquiring a hand before velocity counts
  teleportDistance: 18, // a jump this big in one frame...
  teleportSpeed: 1100, // ...that also implies > this cm/s is a tracking glitch, not a punch
  maxPlausibleSpeed: 650, // cm/s clamp
  fistRatio: 0.75, // avg fingertip->palm distance / palm length below this = closed fist

  // Preview fallback: how fast the simulated claw lunges at the target.
  lungeOutTime: 0.11,
  lungeBackTime: 0.22,

  // ---------------------------------------------------------------- scoring
  hitPoints: 10,
  killPoints: 100,
  comboWindow: 2.2,
  comboStep: 3, // every N chained hits raises the multiplier by 1
  comboMaxMultiplier: 5
}

/** Values that depend on where the city was placed this round (set by GameManager). */
export const KaijuRuntime = {
  eyeY: 32, // eye height above the platform, in GameRoot space
  playerZ: 52 // player's distance from the city centre along +Z, in GameRoot space
}

export type WaveConfig = (typeof KaijuConfig.waves)[number]

export function waveAt(t: number): WaveConfig {
  let w = KaijuConfig.waves[0]
  for (const cfg of KaijuConfig.waves) {
    if (t >= cfg.from) {
      w = cfg
    }
  }
  return w
}
