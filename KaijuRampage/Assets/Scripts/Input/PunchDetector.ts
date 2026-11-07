import {KaijuConfig} from "../Core/KaijuConfig"
import {UFOController} from "../Gameplay/UFOController"
import {KaijuHandController} from "./KaijuHandController"

export interface PunchTarget {
  /** world-space center */
  center(): vec3
  radius: number
  onPunched(hand: KaijuHandController, dir: vec3): void
  enabled(): boolean
}

export interface PunchEvent {
  ufo: UFOController
  hand: KaijuHandController
  damage: number
  dir: vec3
  power: boolean
  point: vec3
}

/**
 * The single source of truth for "did a punch land". A valid punch needs:
 *   1. a claw pose (tracked hand OR simulated lunge),
 *   2. the fist sweeping through a hit sphere this frame (swept test),
 *   3. fist speed above `minPunchSpeed` and moving INTO the target,
 *   4. hand cooldown + per-UFO cooldown elapsed.
 * Both input modes go through this exact code path.
 */
export class PunchDetector {
  onPunch: (e: PunchEvent) => void = () => {}
  extraTargets: PunchTarget[] = []
  punches = 0
  /** extra damage from the ATTACK upgrade */
  damageBonus = 0
  private time = 0

  constructor(private hands: KaijuHandController[]) {}

  update(dt: number, ufos: UFOController[]): void {
    this.time += dt
    for (const hand of this.hands) {
      if (hand.source === "none" || hand.cooldown > 0) continue
      const speed = hand.speed
      if (speed < KaijuConfig.minPunchSpeed) continue
      const velDir = hand.velocity.uniformScale(1 / speed)
      const a = hand.prevFistPos
      const b = hand.fistPos

      let best: UFOController | null = null
      let bestD = 1e9
      for (const u of ufos) {
        if (!u.isAlive) continue
        if (this.time - u.lastHitTime < KaijuConfig.ufoHitCooldown) continue
        const c = u.worldCenter
        const d = segmentPointDistance(a, b, c)
        if (d > KaijuConfig.ufoRadius + KaijuConfig.fistRadius) continue
        // must be moving toward the saucer, not pulling away from it
        const toTarget = c.sub(a)
        if (toTarget.length > 0.001 && velDir.dot(toTarget.normalize()) < 0.15) continue
        if (d < bestD) {
          bestD = d
          best = u
        }
      }
      if (best) {
        const power = hand.isFist
        const damage =
          this.damageBonus +
          (hand.source === "simulated"
            ? KaijuConfig.previewPunchDamage
            : power
              ? KaijuConfig.fistDamage
              : KaijuConfig.openHandDamage)
        hand.cooldown = KaijuConfig.handCooldown
        best.lastHitTime = this.time
        this.onPunch({ufo: best, hand, damage, dir: velDir, power, point: best.worldCenter})
        this.punches++
        continue
      }

      // HUD buttons can be punched, but only by a deliberate closed-fist punch, so a
      // relaxed reach to pinch/poke a button never fires it early
      if (!hand.isFist || speed < KaijuConfig.buttonPunchSpeed) continue
      for (const t of this.extraTargets) {
        if (!t.enabled()) continue
        const d = segmentPointDistance(a, b, t.center())
        if (d <= t.radius + KaijuConfig.fistRadius) {
          hand.cooldown = KaijuConfig.handCooldown
          t.onPunched(hand, velDir)
          break
        }
      }
    }
  }

  get now(): number {
    return this.time
  }
}

/** Distance from point p to segment ab. */
export function segmentPointDistance(a: vec3, b: vec3, p: vec3): number {
  const ab = b.sub(a)
  const len2 = ab.dot(ab)
  if (len2 < 1e-6) return p.distance(a)
  let t = p.sub(a).dot(ab) / len2
  t = t < 0 ? 0 : t > 1 ? 1 : t
  return p.distance(a.add(ab.uniformScale(t)))
}
