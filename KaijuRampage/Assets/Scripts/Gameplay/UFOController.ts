import {KaijuConfig, WaveConfig} from "../Core/KaijuConfig"
import {clamp, easeInCubic, easeOutBack, findChild, rand} from "../Core/MathUtil"
import {CityTarget} from "./CityHealthManager"

export enum UFOState {
  Inactive,
  Entering,
  Approaching,
  Charging,
  Dead
}

/**
 * Drives one pooled UFO prefab instance: warp-in, flight toward a city target,
 * hover + spin animation, tractor-beam charge, hit reaction and death.
 * Plain class (not a component) so the spawner can pool and tick it directly.
 */
export class UFOController {
  readonly tr: Transform
  state = UFOState.Inactive
  hp = 1
  maxHp = 1
  lastHitTime = -10
  target: CityTarget | null = null

  private body: Transform
  private beam: SceneObject | null
  private visuals: RenderMeshVisual[] = []
  private baseMats: Material[] = []
  private t = 0
  private stateT = 0
  private speed = 10
  private chargeTime = 2
  private pos = vec3.zero() // local to UFO parent (GameRoot space)
  private attackPos = vec3.zero()
  private knock = vec3.zero()
  private knockVel = vec3.zero()
  private wobble = 0
  private flashT = 0
  private spin = 0
  private phase = Math.random() * 10

  constructor(
    readonly obj: SceneObject,
    private flashMat: Material
  ) {
    this.tr = obj.getTransform()
    const body = findChild(obj, "Body")
    this.body = (body ?? obj).getTransform()
    this.beam = findChild(obj, "Beam")
    for (const name of ["Hull", "Dome", "Neon"]) {
      const c = findChild(obj, name)
      const v = c ? (c.getComponent("Component.RenderMeshVisual") as RenderMeshVisual) : null
      if (v) {
        this.visuals.push(v)
        this.baseMats.push(v.mainMaterial)
      }
    }
    this.deactivate()
  }

  get isAlive(): boolean {
    return this.state === UFOState.Entering || this.state === UFOState.Approaching || this.state === UFOState.Charging
  }

  get worldCenter(): vec3 {
    return this.tr.getWorldPosition()
  }

  get chargeProgress(): number {
    return this.state === UFOState.Charging ? clamp(this.stateT / this.chargeTime, 0, 1) : 0
  }

  spawn(spawnLocal: vec3, target: CityTarget, wave: WaveConfig, hoverLocal: vec3): void {
    this.target = target
    this.hp = wave.hp
    this.maxHp = wave.hp
    this.speed = wave.speed * rand(0.9, 1.15)
    this.chargeTime = wave.chargeTime
    this.pos = spawnLocal
    this.attackPos = hoverLocal
    this.knock = vec3.zero()
    this.knockVel = vec3.zero()
    this.wobble = 0
    this.flashT = 0
    this.t = 0
    this.lastHitTime = -10
    this.setState(UFOState.Entering)
    this.obj.enabled = true
    if (this.beam) this.beam.enabled = false
    this.restoreMaterials()
    this.apply(0)
  }

  deactivate(): void {
    this.state = UFOState.Inactive
    this.obj.enabled = false
    if (this.beam) this.beam.enabled = false
    this.target = null
  }

  /**
   * Applies punch damage. Returns true when this hit destroyed the UFO.
   * `dirWorld` is the punch direction, used for knockback.
   */
  applyHit(damage: number, dirWorld: vec3, now: number): boolean {
    if (!this.isAlive) return false
    this.lastHitTime = now
    this.hp -= damage
    this.flashT = 0.1
    this.wobble = 1
    // knockback in parent space (GameRoot has no scale, so world dir ~= local dir after rotation)
    const parent = this.obj.getParent()
    let localDir = dirWorld
    if (parent) {
      const inv = parent.getTransform().getWorldRotation().invert()
      localDir = inv.multiplyVec3(dirWorld)
    }
    this.knockVel = this.knockVel.add(localDir.normalize().uniformScale(90))
    if (this.state === UFOState.Charging) {
      // a punch interrupts the zap and pushes the UFO back to approaching
      this.setState(UFOState.Approaching)
      if (this.beam) this.beam.enabled = false
    }
    if (this.hp <= 0) {
      this.setState(UFOState.Dead)
      return true
    }
    return false
  }

  /** Returns "zap" on the frame the UFO finishes charging its beam. */
  update(dt: number): "zap" | null {
    if (this.state === UFOState.Inactive || this.state === UFOState.Dead) return null
    this.t += dt
    this.stateT += dt
    let result: "zap" | null = null

    // knockback spring
    this.knockVel = this.knockVel.add(this.knock.uniformScale(-60 * dt)).uniformScale(Math.max(0, 1 - 9 * dt))
    this.knock = this.knock.add(this.knockVel.uniformScale(dt))
    this.wobble = Math.max(0, this.wobble - dt * 2.2)

    if (this.state === UFOState.Entering) {
      if (this.stateT >= 0.45) this.setState(UFOState.Approaching)
    }
    if (this.state === UFOState.Approaching || this.state === UFOState.Entering) {
      const to = this.attackPos.sub(this.pos)
      const d = to.length
      const step = this.speed * dt
      if (d <= step || d < 0.5) {
        this.pos = this.attackPos
        if (this.state === UFOState.Approaching) {
          this.setState(UFOState.Charging)
          if (this.beam) this.beam.enabled = true
        }
      } else {
        this.pos = this.pos.add(to.uniformScale(step / d))
      }
    } else if (this.state === UFOState.Charging) {
      if (this.stateT >= this.chargeTime) {
        result = "zap"
      }
    }

    if (this.flashT > 0) {
      this.flashT -= dt
      if (this.flashT <= 0) this.restoreMaterials()
      else this.setFlash()
    }
    this.apply(dt)
    return result
  }

  // ------------------------------------------------------------------ internals
  private setState(s: UFOState): void {
    this.state = s
    this.stateT = 0
  }

  private apply(dt: number): void {
    const bob = Math.sin((this.t + this.phase) * 3.1) * 0.9
    this.tr.setLocalPosition(this.pos.add(this.knock).add(new vec3(0, bob, 0)))

    // warp-in scale pop
    let s = 1
    if (this.state === UFOState.Entering) s = easeOutBack(clamp(this.stateT / 0.45, 0, 1))
    // charging: pulse
    if (this.state === UFOState.Charging) {
      const k = clamp(this.stateT / this.chargeTime, 0, 1)
      s = 1 + Math.sin(this.stateT * (10 + 25 * easeInCubic(k))) * 0.06 * k
      if (this.beam && this.target) {
        // long-range beam: aim at the target roof and grow toward it while charging
        const bt = this.beam.getTransform()
        const parent = this.obj.getParent()
        const targetW = parent ? parent.getTransform().getWorldTransform().multiplyPoint(this.target.localTop) : this.target.localTop
        const to = targetW.sub(bt.getWorldPosition())
        const len = Math.max(1, to.length)
        bt.setWorldRotation(quat.rotationFromTo(vec3.down(), to.uniformScale(1 / len)))
        const bs = 0.35 + 0.25 * Math.abs(Math.sin(this.stateT * 18)) + 0.4 * k
        const reach = Math.min(1, 0.25 + k * 1.2)
        bt.setLocalScale(new vec3(bs, (len / 10) * reach, bs))
      }
    }
    this.tr.setLocalScale(new vec3(s, s, s))

    // spin + wobble tilt on the body
    this.spin += dt * (this.state === UFOState.Charging ? 6.0 : 2.2)
    const tiltX = Math.sin(this.t * 2.3 + this.phase) * 0.08 + this.wobble * Math.sin(this.t * 30) * 0.45
    const tiltZ = Math.cos(this.t * 1.9 + this.phase) * 0.08 + this.wobble * Math.cos(this.t * 26) * 0.45
    this.body.setLocalRotation(quat.fromEulerAngles(tiltX, this.spin, tiltZ))
  }

  private setFlash(): void {
    for (const v of this.visuals) v.mainMaterial = this.flashMat
  }

  private restoreMaterials(): void {
    for (let i = 0; i < this.visuals.length; i++) this.visuals[i].mainMaterial = this.baseMats[i]
  }
}
