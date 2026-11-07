import {SIK} from "SpectaclesInteractionKit.lspkg/SIK"
import {KaijuConfig} from "../Core/KaijuConfig"
import {clamp, easeInCubic, easeOutBack, easeOutCubic, findChild} from "../Core/MathUtil"
import {HandPose, HandPoseSource, SikHandSource} from "./HandPoseSource"

export type HandSide = "left" | "right"
/** tracked = real Specs hand tracking; synthetic = scripted test skeleton; simulated = Preview mouse/keyboard lunge. */
export type HandSource = "tracked" | "synthetic" | "simulated" | "none"

/**
 * One Kaiju claw. Every pose source feeds the same outputs (fist position,
 * velocity, fist state) so PunchDetector never needs to know which is active.
 *
 *  - skeleton sources ("tracked" via SIK on Specs, "synthetic" for Preview tests)
 *    go through ONE code path: smoothing, re-acquire warm-up, teleport guard,
 *    speed clamp, size-normalised fist detection.
 *  - "simulated": Preview fallback – the claw floats at a camera anchor and
 *    physically lunges at a target when InputManager asks.
 */
export class KaijuHandController {
  source: HandSource = "none"
  fistPos = vec3.zero()
  prevFistPos = vec3.zero()
  velocity = vec3.zero()
  isFist = false
  cooldown = 0
  /** diagnostics */
  teleportsRejected = 0
  reacquires = 0

  private tr: Transform
  private glowVisual: RenderMeshVisual | null = null
  private glowMat: Material | null = null
  private sources: HandPoseSource[] = []
  private cam: Transform
  private t = 0
  private popT = 0
  private flashT = 0
  private pos = vec3.zero()
  private rot = quat.quatIdentity()
  private hasPose = false
  private warmup = 0
  private lastSource: HandSource = "none"
  private baseScale: number

  // lunge (simulated punch)
  private lungeT = -1
  private lungeFrom = vec3.zero()
  private lungeTo = vec3.zero()

  constructor(
    readonly side: HandSide,
    readonly claw: SceneObject,
    camera: SceneObject,
    private flashMat: Material,
    private allowSimulation: boolean
  ) {
    this.tr = claw.getTransform()
    this.baseScale = this.tr.getLocalScale().x
    this.cam = camera.getTransform()
    const glow = findChild(claw, "Glow")
    if (glow) {
      this.glowVisual = glow.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
      this.glowMat = this.glowVisual ? this.glowVisual.mainMaterial : null
    }
    try {
      this.sources.push(new SikHandSource(SIK.HandInputData.getHand(side)))
    } catch (e) {
      print("[Kaiju] SIK hand data unavailable for " + side + ": " + e)
    }
  }

  /** Adds a higher-priority pose source (used by the editor-only synthetic hand test). */
  addSource(src: HandPoseSource): void {
    this.sources.unshift(src)
  }

  get isLunging(): boolean {
    return this.lungeT >= 0
  }

  get speed(): number {
    return this.velocity.length
  }

  /** Simulated punch toward a world position (Preview fallback). */
  lungeAt(target: vec3): boolean {
    if (this.source !== "simulated" || this.isLunging) return false
    this.lungeT = 0
    this.lungeFrom = this.anchorPos()
    // overshoot slightly through the target so the fist really passes the hit sphere
    const dir = target.sub(this.lungeFrom).normalize()
    this.lungeTo = target.add(dir.uniformScale(3))
    return true
  }

  /** Visual feedback when this claw lands a hit. */
  onImpact(): void {
    this.popT = 0.18
    this.flashT = 0.08
  }

  update(dt: number): void {
    this.t += dt
    this.cooldown = Math.max(0, this.cooldown - dt)

    let pose: HandPose | null = null
    let label: HandSource = "none"
    for (const s of this.sources) {
      pose = s.read()
      if (pose) {
        label = s.label
        break
      }
    }
    // (re)acquired or switched source: start a fresh pose + velocity history
    const next: HandSource = pose ? label : this.allowSimulation ? "simulated" : "none"
    if (next !== this.lastSource) {
      if (next === "tracked" || next === "synthetic") this.reacquires++
      this.hasPose = false
      this.lastSource = next
    }

    let newFist: vec3
    if (pose) {
      this.source = label
      newFist = this.updateSkeleton(pose, dt)
    } else if (this.allowSimulation) {
      this.source = "simulated"
      this.updateSimulated(dt)
      const fwd = this.rot.multiplyVec3(new vec3(0, 0, -1))
      newFist = this.pos.add(fwd.uniformScale(7 * this.baseScale))
    } else {
      this.source = "none"
      newFist = this.fistPos
    }

    this.claw.enabled = this.source !== "none"
    if (this.source === "none") {
      this.hasPose = false
      this.velocity = vec3.zero()
      return
    }

    const skeleton = this.source === "tracked" || this.source === "synthetic"
    if (!this.hasPose || dt <= 0) {
      this.prevFistPos = newFist
      this.velocity = vec3.zero()
      this.hasPose = true
      this.warmup = skeleton ? KaijuConfig.warmupFrames : 0
    } else if (
      skeleton &&
      newFist.distance(this.fistPos) > KaijuConfig.teleportDistance &&
      newFist.distance(this.fistPos) / dt > KaijuConfig.teleportSpeed
    ) {
      // a tracking glitch / re-acquire jump must never count as a punch
      this.teleportsRejected++
      this.prevFistPos = newFist
      this.velocity = vec3.zero()
      this.warmup = KaijuConfig.warmupFrames
    } else {
      this.prevFistPos = this.fistPos
      let instVel = newFist.sub(this.fistPos).uniformScale(1 / dt)
      const sp = instVel.length
      if (sp > KaijuConfig.maxPlausibleSpeed) instVel = instVel.uniformScale(KaijuConfig.maxPlausibleSpeed / sp)
      const a = KaijuConfig.velocitySmoothing
      this.velocity = this.velocity.uniformScale(1 - a).add(instVel.uniformScale(a))
      if (this.warmup > 0) {
        this.warmup--
        this.velocity = vec3.zero()
      }
    }
    this.fistPos = newFist

    // visuals
    this.popT = Math.max(0, this.popT - dt)
    const pop = this.popT > 0 ? 1 + 0.25 * Math.sin((1 - this.popT / 0.18) * Math.PI) : 1
    const s = this.baseScale * pop * (this.source === "simulated" ? 0.8 : 1)
    this.tr.setWorldPosition(this.pos)
    this.tr.setWorldRotation(this.rot)
    this.tr.setWorldScale(new vec3(s, s, s))
    if (this.glowVisual && this.glowMat) {
      this.flashT = Math.max(0, this.flashT - dt)
      this.glowVisual.mainMaterial = this.flashT > 0 ? this.flashMat : this.glowMat
    }
  }

  // ------------------------------------------------------------------ skeleton (Specs tracking / synthetic test)
  /** Updates claw pose from a hand skeleton; returns the raw fist center. */
  private updateSkeleton(p: HandPose, dt: number): vec3 {
    const fingerDir = p.middleKnuckle.sub(p.wrist).normalize()
    const across = p.indexKnuckle.sub(p.pinkyKnuckle).normalize()
    let back = fingerDir.cross(across).normalize()
    if (this.side === "left") back = back.uniformScale(-1)
    // claw model: knuckles toward -Z, back of hand toward +Y, wrist at origin
    const targetRot = quat.lookAt(fingerDir.uniformScale(-1), back)
    // light exponential smoothing for the *visual* only – the fist point below is raw so punches stay snappy
    const k = this.hasPose ? 1 - Math.exp(-KaijuConfig.poseSmoothingRate * Math.max(dt, 0)) : 1
    this.pos = this.hasPose ? vec3.lerp(this.pos, p.wrist, k) : p.wrist
    this.rot = this.hasPose ? quat.slerp(this.rot, targetRot, k) : targetRot

    // fist detection normalised by hand size (wrist -> middle knuckle)
    const palmLen = Math.max(4, p.middleKnuckle.distance(p.wrist))
    let sum = 0
    for (const tip of p.tips) sum += tip.distance(p.palm)
    this.isFist = sum / p.tips.length / palmLen < KaijuConfig.fistRatio

    // punch contact point: just past the knuckles
    return p.middleKnuckle.add(fingerDir.uniformScale(1.5))
  }

  // ------------------------------------------------------------------ simulated (Preview)
  private anchorPos(): vec3 {
    const c = this.cam
    const right = c.right
    const up = c.up
    const fwd = c.back // the user looks along the camera's -Z (back)
    const sx = this.side === "right" ? 1 : -1
    const bob = Math.sin(this.t * 2.2 + (sx > 0 ? 0 : 1.3)) * 0.8
    return c
      .getWorldPosition()
      .add(right.uniformScale(8 * sx))
      .add(up.uniformScale(-10 + bob))
      .add(fwd.uniformScale(34))
  }

  private updateSimulated(dt: number): void {
    const c = this.cam
    const fwd = c.back
    const sx = this.side === "right" ? 1 : -1
    const anchor = this.anchorPos()
    let aim = fwd.add(c.up.uniformScale(0.12)).add(c.right.uniformScale(-0.12 * sx)).normalize()
    this.isFist = true
    if (this.lungeT >= 0) {
      this.lungeT += dt
      const out = KaijuConfig.lungeOutTime
      const backT = KaijuConfig.lungeBackTime
      aim = this.lungeTo.sub(this.lungeFrom).normalize()
      if (this.lungeT < out) {
        const u = this.lungeT / out
        this.pos = vec3.lerp(this.lungeFrom, this.lungeTo, easeInCubic(u) * 0.4 + easeOutCubic(u) * 0.6)
      } else if (this.lungeT < out + backT) {
        const u = (this.lungeT - out) / backT
        this.pos = vec3.lerp(this.lungeTo, anchor, easeOutBack(clamp(u, 0, 1)) * 0.7 + u * 0.3)
      } else {
        this.lungeT = -1
        this.pos = anchor
      }
      // shift claw origin back so the *fist* (not the wrist) travels the lunge path
      this.pos = this.pos.sub(aim.uniformScale(7 * this.baseScale))
    } else {
      this.pos = vec3.lerp(this.hasPose ? this.pos : anchor, anchor.sub(aim.uniformScale(7 * this.baseScale)), clamp(dt * 12, 0, 1))
    }
    const target = quat.lookAt(aim.uniformScale(-1), c.up)
    this.rot = this.hasPose ? quat.slerp(this.rot, target, clamp(dt * 18, 0, 1)) : target
  }
}
