import {UFOController} from "../Gameplay/UFOController"
import {SyntheticHandSource} from "./HandPoseSource"

type Phase = "rest" | "strike" | "recover" | "slow" | "gone"

interface HandScript {
  src: SyntheticHandSource
  side: "left" | "right"
  fist: boolean
  phase: Phase
  t: number
  interval: number
  timer: number
  from: vec3
  to: vec3
  wrist: vec3
  aim: vec3
}

/**
 * EDITOR-ONLY test harness. Drives two scripted hand skeletons through the
 * exact code path real Specs hand tracking uses (KaijuHandController skeleton
 * branch + PunchDetector), so the orientation maths, fist detection, velocity
 * and glitch guards are exercised in Preview without hardware.
 *
 * Scripted checks (watch the [SynthHand] / [Kaiju] PUNCH log lines):
 *  - right hand: closed-fist punches (expect dmg=2)
 *  - left hand:  open-hand slaps (expect dmg=1)
 *  - slow touch: a hand drifts into a UFO at ~15 cm/s -> must NOT register
 *  - glitch:     one-frame 80 cm teleport -> must be rejected (teleportsRejected++)
 *  - dropout:    hand lost for 0.5 s then re-acquired -> must not fire a punch
 */
export class SyntheticHandDriver {
  readonly left: SyntheticHandSource
  readonly right: SyntheticHandSource
  private hands: HandScript[]
  private t = 0
  private events = {glitchDone: false, dropoutDone: false, slowDone: false}

  constructor(
    private cam: Transform,
    private getUfos: () => UFOController[]
  ) {
    this.left = new SyntheticHandSource("left")
    this.right = new SyntheticHandSource("right")
    this.hands = [this.mk(this.right, "right", true, 1.25), this.mk(this.left, "left", false, 1.7)]
    for (const h of this.hands) this.apply(h, 0)
  }

  update(dt: number, playing: boolean): void {
    this.t += dt
    for (const h of this.hands) {
      h.t += dt
      const rest = this.restPos(h.side)
      switch (h.phase) {
        case "gone":
          if (h.t > 0.5) {
            h.src.tracked = true
            print("[SynthHand] dropout end: " + h.side + " re-acquired")
            this.go(h, "rest")
          }
          break
        case "rest":
          h.wrist = vec3.lerp(h.wrist, rest, Math.min(1, dt * 6))
          h.aim = this.cam.back.add(this.cam.up.uniformScale(-0.25)).normalize()
          h.timer -= dt
          if (!playing) break
          if (!this.events.glitchDone && this.t > 8 && h.side === "right") {
            this.events.glitchDone = true
            print("[SynthHand] glitch test: right hand teleports 80cm for one frame")
            h.wrist = h.wrist.add(this.cam.right.uniformScale(80))
            this.apply(h, 0)
            h.wrist = rest
            continue
          }
          if (!this.events.dropoutDone && this.t > 14 && h.side === "left") {
            this.events.dropoutDone = true
            print("[SynthHand] dropout test: left hand lost for 0.5s")
            h.src.tracked = false
            this.go(h, "gone")
            break
          }
          if (h.timer <= 0) {
            const target = this.pickTarget()
            if (target) {
              const slow = !this.events.slowDone && this.t > 18 && h.side === "right"
              h.from = h.wrist
              h.aim = target.sub(h.wrist).normalize()
              // knuckles should travel ~3cm through the saucer centre
              h.to = target.add(h.aim.uniformScale(3)).sub(h.aim.uniformScale(9))
              if (slow) {
                this.events.slowDone = true
                print("[SynthHand] slow-touch test BEGIN (right hand drifts into a UFO at ~15cm/s)")
                this.go(h, "slow")
              } else {
                this.go(h, "strike")
              }
            }
            h.timer = h.interval
          }
          break
        case "strike": {
          const d = 0.2 // ~45cm in 0.2s ≈ 225 cm/s – a casual real punch
          const k = Math.min(1, h.t / d)
          h.wrist = vec3.lerp(h.from, h.to, k * k * (3 - 2 * k))
          if (k >= 1) this.go(h, "recover")
          break
        }
        case "slow": {
          const dist = h.from.distance(h.to)
          const dur = Math.max(0.5, dist / 15)
          const k = Math.min(1, h.t / dur)
          h.wrist = vec3.lerp(h.from, h.to, k)
          if (h.t > dur + 0.4) {
            print("[SynthHand] slow-touch test END")
            this.go(h, "recover")
          }
          break
        }
        case "recover":
          h.wrist = vec3.lerp(h.wrist, rest, Math.min(1, dt * 7))
          if (h.t > 0.35) this.go(h, "rest")
          break
      }
      this.apply(h, 0.25)
    }
  }

  private apply(h: HandScript, jitter: number): void {
    // back of hand roughly up, perpendicular to the aim direction
    let back = vec3.up().sub(h.aim.uniformScale(h.aim.dot(vec3.up())))
    if (back.length < 0.01) back = this.cam.up
    h.src.setPose(h.wrist, h.aim, back.normalize(), h.fist, jitter)
  }

  private go(h: HandScript, p: Phase): void {
    h.phase = p
    h.t = 0
  }

  private restPos(side: "left" | "right"): vec3 {
    const c = this.cam
    const sx = side === "right" ? 1 : -1
    return c.getWorldPosition().add(c.right.uniformScale(16 * sx)).add(c.up.uniformScale(-28)).add(c.back.uniformScale(22))
  }

  private pickTarget(): vec3 | null {
    const camPos = this.cam.getWorldPosition()
    let best: UFOController | null = null
    let bestScore = -1e9
    for (const u of this.getUfos()) {
      if (!u.isAlive) continue
      const d = u.worldCenter.distance(camPos)
      if (d > 85) continue // out of arm's reach for a real player
      const score = u.chargeProgress * 100 - d
      if (score > bestScore) {
        bestScore = score
        best = u
      }
    }
    return best ? best.worldCenter : null
  }

  private mk(src: SyntheticHandSource, side: "left" | "right", fist: boolean, interval: number): HandScript {
    const rest = this.restPos(side)
    return {
      src,
      side,
      fist,
      phase: "rest",
      t: 0,
      interval,
      timer: interval * 0.5,
      from: rest,
      to: rest,
      wrist: rest,
      aim: this.cam.back
    }
  }
}
