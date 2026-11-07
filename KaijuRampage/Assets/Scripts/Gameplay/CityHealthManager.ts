import {KaijuConfig} from "../Core/KaijuConfig"
import {DEG, clamp, easeOutCubic, findChild, rand} from "../Core/MathUtil"
import {EffectsManager} from "../Effects/EffectsManager"

export interface CityTarget {
  kind: "building" | "reactor"
  index: number
  localTop: vec3 // in GameRoot space
}

interface Building {
  obj: SceneObject
  tr: Transform
  glow: SceneObject | null
  basePos: vec3
  baseRot: quat
  baseScale: vec3
  top: number // local Y of the roof in GameRoot space
  stage: number // 0 intact, 1 damaged, 2 destroyed
  shake: number
  smokeT: number
  anim: number // 0..1 collapse animation progress
}

/**
 * Owns the miniature city: global city health, per-building damage stages,
 * the reactor core animation and target selection for UFOs.
 */
export class CityHealthManager {
  maxHp = KaijuConfig.cityMaxHealth
  health = KaijuConfig.cityMaxHealth
  private buildings: Building[] = []
  private reactorObj: SceneObject | null
  private reactorCore: Transform | null
  private reactorTop = 12
  private reactorShake = 0
  private coreBaseScale = 1
  private platformGlow: SceneObject | null
  private t = 0
  onHealthChanged: (health: number, delta: number) => void = () => {}

  constructor(
    private cityRoot: SceneObject,
    private fx: EffectsManager
  ) {
    const bRoot = findChild(cityRoot, "Buildings")
    if (bRoot) {
      for (let i = 0; i < bRoot.getChildrenCount(); i++) {
        const o = bRoot.getChild(i)
        const tr = o.getTransform()
        const v = o.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
        const h = v && v.mesh ? v.mesh.aabbMax.y * tr.getLocalScale().y : 12
        this.buildings.push({
          obj: o,
          tr,
          glow: findChild(o, "Glow"),
          basePos: tr.getLocalPosition(),
          baseRot: tr.getLocalRotation(),
          baseScale: tr.getLocalScale(),
          top: tr.getLocalPosition().y + h,
          stage: 0,
          shake: 0,
          smokeT: 0,
          anim: 0
        })
      }
    }
    this.reactorObj = findChild(cityRoot, "Reactor")
    const core = this.reactorObj ? findChild(this.reactorObj, "Core") : null
    this.reactorCore = core ? core.getTransform() : null
    if (this.reactorCore) this.coreBaseScale = this.reactorCore.getLocalScale().x
    if (this.reactorObj) {
      this.reactorTop = this.reactorObj.getTransform().getLocalPosition().y + 9
    }
    this.platformGlow = findChild(cityRoot, "PlatformGlow")
  }

  get maxHealth(): number {
    return this.maxHp
  }

  get isDestroyed(): boolean {
    return this.health <= 0
  }

  get buildingCount(): number {
    return this.buildings.length
  }

  get intactBuildings(): number {
    return this.buildings.filter((b) => b.stage < 2).length
  }

  reset(): void {
    this.health = this.maxHp
    for (const b of this.buildings) {
      b.stage = 0
      b.shake = 0
      b.anim = 0
      b.tr.setLocalPosition(b.basePos)
      b.tr.setLocalRotation(b.baseRot)
      b.tr.setLocalScale(b.baseScale)
      if (b.glow) b.glow.enabled = true
    }
    if (this.reactorObj) this.reactorObj.enabled = true
    if (this.reactorCore) this.reactorCore.getSceneObject().enabled = true
    if (this.platformGlow) this.platformGlow.enabled = true
    this.onHealthChanged(this.health, 0)
  }

  /** Picks something for a UFO to attack; prefers intact buildings, then the reactor. */
  pickTarget(occupied: number[]): CityTarget {
    const candidates: number[] = []
    for (let i = 0; i < this.buildings.length; i++) {
      if (this.buildings[i].stage < 2) {
        // fewer UFOs on the same building keeps the attacks spread out
        const weight = Math.max(1, 3 - (occupied[i] ?? 0) * 2)
        for (let w = 0; w < weight; w++) candidates.push(i)
      }
    }
    if (candidates.length === 0 || Math.random() < 0.12) {
      return {kind: "reactor", index: -1, localTop: new vec3(0, this.reactorTop, 0)}
    }
    const i = candidates[Math.floor(Math.random() * candidates.length)]
    const b = this.buildings[i]
    return {kind: "building", index: i, localTop: new vec3(b.basePos.x, b.top, b.basePos.z)}
  }

  /** A UFO finished charging and zapped its target. */
  applyZap(target: CityTarget, worldPos: vec3): void {
    if (this.health <= 0) return
    let dmg = KaijuConfig.zapDamageBuilding
    if (target.kind === "building" && this.buildings[target.index]) {
      const b = this.buildings[target.index]
      if (b.stage < 2) {
        b.stage++
        b.anim = 0
        if (b.stage === 2 && b.glow) b.glow.enabled = false
      }
      b.shake = 1
    } else {
      dmg = KaijuConfig.zapDamageReactor
      this.reactorShake = 1
    }
    this.health = clamp(this.health - dmg, 0, this.maxHp)
    this.fx.cityDamage(worldPos)
    this.onHealthChanged(this.health, -dmg)
  }

  /** Visual end state when the city falls. */
  collapseAll(): void {
    for (const b of this.buildings) {
      if (b.stage < 2) {
        b.stage = 2
        b.anim = 0
        if (b.glow) b.glow.enabled = false
      }
    }
    if (this.reactorCore) this.reactorCore.getSceneObject().enabled = false
    if (this.platformGlow) this.platformGlow.enabled = false
  }

  update(dt: number): void {
    this.t += dt
    for (const b of this.buildings) {
      b.shake = Math.max(0, b.shake - dt * 2.5)
      b.anim = Math.min(1, b.anim + dt * 2.5)
      const k = easeOutCubic(b.anim)
      const tilt = b.stage === 0 ? 0 : b.stage === 1 ? 5 * k : 5 + 9 * k
      const squash = b.stage === 2 ? 1 - 0.5 * k : 1
      const sx = Math.sin(this.t * 55) * b.shake * 0.6
      b.tr.setLocalPosition(b.basePos.add(new vec3(sx, 0, 0)))
      b.tr.setLocalRotation(b.baseRot.multiply(quat.fromEulerAngles(tilt * DEG, 0, tilt * 0.6 * DEG)))
      b.tr.setLocalScale(new vec3(b.baseScale.x, b.baseScale.y * squash, b.baseScale.z))
      if (b.stage > 0) {
        b.smokeT -= dt
        if (b.smokeT <= 0) {
          b.smokeT = b.stage === 2 ? rand(0.25, 0.45) : rand(0.6, 1.0)
          const top = b.obj.getTransform().getWorldPosition().add(new vec3(0, (b.top - b.basePos.y) * squash * 0.8, 0))
          this.fx.smokeColumn(top)
        }
      }
    }
    if (this.reactorCore) {
      this.reactorShake = Math.max(0, this.reactorShake - dt * 2)
      const hpK = this.health / this.maxHp
      const p = this.coreBaseScale * (1 + Math.sin(this.t * (3 + (1 - hpK) * 9)) * 0.08 + this.reactorShake * 0.3)
      this.reactorCore.setLocalRotation(quat.fromEulerAngles(0, this.t * 1.4, 0))
      this.reactorCore.setLocalScale(new vec3(p, p, p))
    }
  }
}
