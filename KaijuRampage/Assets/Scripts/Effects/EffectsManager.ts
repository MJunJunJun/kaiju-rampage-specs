import {clamp, colorMaterial, easeOutBack, easeOutCubic, lerp, rand} from "../Core/MathUtil"

/**
 * Lightweight pooled VFX: mesh "particles" (shards, stars, rings, puffs) and
 * floating score text. No particle systems, no physics – just a few dozen
 * pooled SceneObjects animated on the CPU with shared meshes/materials.
 */

type Kind = "shard" | "star" | "ring" | "puff"

interface Particle {
  obj: SceneObject
  tr: Transform
  visual: RenderMeshVisual
  kind: Kind
  active: boolean
  t: number
  life: number
  pos: vec3
  vel: vec3
  gravity: number
  drag: number
  rot: quat
  spin: vec3
  s0: number
  s1: number
  pop: boolean
  faceCamera: boolean
}

interface Popup {
  obj: SceneObject
  tr: Transform
  text: Text
  active: boolean
  t: number
  life: number
  pos: vec3
  color: vec4
  scale: number
}

export interface FxAssets {
  shard: RenderMesh
  star: RenderMesh
  ring: RenderMesh
  puff: RenderMesh
  glowMat: Material
  litMat: Material
  flashMat: Material
}

export class EffectsManager {
  private particles: Particle[] = []
  private popups: Popup[] = []
  private mats: {[k: string]: Material} = {}
  private cameraTr: Transform
  private fireworksLeft = 0
  private fireworksTimer = 0
  private fireworksCenter = vec3.zero()

  constructor(
    private root: SceneObject,
    private assets: FxAssets,
    camera: SceneObject
  ) {
    this.cameraTr = camera.getTransform()
    const f = assets.flashMat
    this.mats = {
      white: colorMaterial(f, 1, 1, 1),
      yellow: colorMaterial(f, 1, 0.9, 0.3),
      orange: colorMaterial(f, 1, 0.55, 0.15),
      red: colorMaterial(f, 1, 0.25, 0.3),
      green: colorMaterial(f, 0.5, 1, 0.3),
      purple: colorMaterial(f, 0.75, 0.5, 1),
      cyan: colorMaterial(f, 0.25, 0.95, 1),
      smoke: colorMaterial(f, 0.42, 0.45, 0.52)
    }
    const counts: [Kind, number][] = [
      ["shard", 48],
      ["star", 8],
      ["ring", 8],
      ["puff", 16]
    ]
    for (const [kind, n] of counts) {
      for (let i = 0; i < n; i++) {
        this.particles.push(this.makeParticle(kind))
      }
    }
    for (let i = 0; i < 8; i++) {
      this.popups.push(this.makePopup())
    }
  }

  // ------------------------------------------------------------------ public effects
  punchImpact(pos: vec3, power: boolean): void {
    this.spawn("star", pos, vec3.zero(), {life: 0.26, s0: 0, s1: power ? 8 : 5.5, mat: "yellow", pop: true, face: true})
    this.spawn("ring", pos, vec3.zero(), {life: 0.3, s0: 2, s1: power ? 14 : 10, mat: "white", face: true})
    for (let i = 0; i < 4; i++) {
      this.spawn("shard", pos, this.randomDir().uniformScale(rand(30, 55)), {
        life: 0.35,
        s0: 0.9,
        s1: 0,
        mat: "white",
        gravity: -60
      })
    }
  }

  ufoExplosion(pos: vec3): void {
    this.spawn("star", pos, vec3.zero(), {life: 0.32, s0: 0, s1: 11, mat: "white", pop: true, face: true})
    this.spawn("ring", pos, vec3.zero(), {life: 0.42, s0: 3, s1: 22, mat: "green", face: true})
    const cols = ["green", "purple", "purple", "white", "cyan"]
    for (let i = 0; i < 12; i++) {
      this.spawn("shard", pos, this.randomDir().uniformScale(rand(35, 80)), {
        life: rand(0.5, 0.8),
        s0: rand(1.2, 2.0),
        s1: 0,
        mat: cols[i % cols.length],
        gravity: -120,
        drag: 1.5
      })
    }
    for (let i = 0; i < 3; i++) {
      this.spawn("puff", pos.add(this.randomDir().uniformScale(2)), new vec3(0, rand(6, 12), 0), {
        life: 0.7,
        s0: 2.5,
        s1: 0,
        mat: "purple",
        pop: false
      })
    }
  }

  cityDamage(pos: vec3): void {
    this.spawn("star", pos, vec3.zero(), {life: 0.3, s0: 0, s1: 7, mat: "orange", pop: true, face: true})
    this.spawn("ring", pos, vec3.zero(), {life: 0.4, s0: 2, s1: 12, mat: "red"})
    for (let i = 0; i < 4; i++) {
      this.spawn("puff", pos.add(new vec3(rand(-2, 2), rand(0, 2), rand(-2, 2))), new vec3(rand(-3, 3), rand(8, 16), rand(-3, 3)), {
        life: rand(0.8, 1.2),
        s0: rand(1.8, 2.8),
        s1: 0.2,
        mat: "smoke"
      })
    }
    for (let i = 0; i < 5; i++) {
      const d = this.randomDir()
      this.spawn("shard", pos, new vec3(d.x * 30, Math.abs(d.y) * 45 + 15, d.z * 30), {
        life: 0.6,
        s0: 0.9,
        s1: 0,
        mat: i % 2 === 0 ? "orange" : "red",
        gravity: -140
      })
    }
  }

  smokeColumn(pos: vec3): void {
    this.spawn("puff", pos, new vec3(rand(-1, 1), rand(5, 9), rand(-1, 1)), {
      life: rand(1.0, 1.5),
      s0: rand(1.2, 2.0),
      s1: 0.3,
      mat: "smoke"
    })
  }

  scorePopup(pos: vec3, label: string, color: vec4, scale: number = 1): void {
    const p = this.popups.find((x) => !x.active) ?? this.popups[0]
    p.active = true
    p.t = 0
    p.life = 0.9
    p.pos = pos
    p.color = color
    p.scale = scale
    p.text.text = label
    p.obj.enabled = true
    this.updatePopup(p, 0)
  }

  startFireworks(center: vec3, bursts: number): void {
    this.fireworksCenter = center
    this.fireworksLeft = bursts
    this.fireworksTimer = 0
  }

  stopAll(): void {
    this.fireworksLeft = 0
    for (const p of this.particles) {
      p.active = false
      p.obj.enabled = false
    }
    for (const p of this.popups) {
      p.active = false
      p.obj.enabled = false
    }
  }

  update(dt: number): void {
    for (const p of this.particles) {
      if (p.active) {
        this.updateParticle(p, dt)
      }
    }
    for (const p of this.popups) {
      if (p.active) {
        this.updatePopup(p, dt)
      }
    }
    if (this.fireworksLeft > 0) {
      this.fireworksTimer -= dt
      if (this.fireworksTimer <= 0) {
        this.fireworksTimer = rand(0.18, 0.35)
        this.fireworksLeft--
        this.fireworkBurst(
          this.fireworksCenter.add(new vec3(rand(-22, 22), rand(18, 36), rand(-22, 10)))
        )
      }
    }
  }

  activeCount(): number {
    let n = 0
    for (const p of this.particles) {
      if (p.active) n++
    }
    return n
  }

  // ------------------------------------------------------------------ internals
  private fireworkBurst(pos: vec3): void {
    const palette = ["cyan", "green", "purple", "yellow", "orange"]
    const col = palette[Math.floor(Math.random() * palette.length)]
    this.spawn("star", pos, vec3.zero(), {life: 0.3, s0: 0, s1: 6, mat: col, pop: true, face: true})
    for (let i = 0; i < 9; i++) {
      this.spawn("shard", pos, this.randomDir().uniformScale(rand(25, 45)), {
        life: rand(0.6, 0.9),
        s0: 1.1,
        s1: 0,
        mat: col,
        gravity: -40,
        drag: 1.2
      })
    }
  }

  private spawn(
    kind: Kind,
    pos: vec3,
    vel: vec3,
    o: {life: number; s0: number; s1: number; mat: string; gravity?: number; drag?: number; pop?: boolean; face?: boolean}
  ): void {
    let p: Particle | undefined
    let oldest: Particle | undefined
    for (const c of this.particles) {
      if (c.kind !== kind) continue
      if (!c.active) {
        p = c
        break
      }
      if (!oldest || c.t / c.life > oldest.t / oldest.life) {
        oldest = c
      }
    }
    p = p ?? oldest
    if (!p) return
    p.active = true
    p.t = 0
    p.life = o.life
    p.pos = pos
    p.vel = vel
    p.gravity = o.gravity ?? 0
    p.drag = o.drag ?? 0
    p.s0 = o.s0
    p.s1 = o.s1
    p.pop = o.pop ?? false
    p.faceCamera = o.face ?? false
    p.rot = quat.fromEulerAngles(rand(0, 6.28), rand(0, 6.28), rand(0, 6.28))
    p.spin = new vec3(rand(-9, 9), rand(-9, 9), rand(-9, 9))
    p.visual.mainMaterial = this.mats[o.mat] ?? this.mats["white"]
    p.obj.enabled = true
    this.updateParticle(p, 0)
  }

  private updateParticle(p: Particle, dt: number): void {
    p.t += dt
    const k = p.t / p.life
    if (k >= 1) {
      p.active = false
      p.obj.enabled = false
      return
    }
    if (dt > 0) {
      p.vel = p.vel.add(new vec3(0, p.gravity * dt, 0))
      if (p.drag > 0) {
        p.vel = p.vel.uniformScale(Math.max(0, 1 - p.drag * dt))
      }
      p.pos = p.pos.add(p.vel.uniformScale(dt))
    }
    let s: number
    if (p.pop) {
      // grow fast with overshoot, then shrink away
      s = k < 0.35 ? p.s1 * easeOutBack(k / 0.35) : p.s1 * (1 - easeOutCubic((k - 0.35) / 0.65))
    } else if (p.kind === "ring") {
      s = lerp(p.s0, p.s1, easeOutCubic(k))
      // rings thin out by shrinking their Y in the end
    } else {
      s = lerp(p.s0, p.s1, k)
    }
    s = Math.max(0.0001, s)
    p.tr.setWorldPosition(p.pos)
    if (p.faceCamera) {
      const toCam = this.cameraTr.getWorldPosition().sub(p.pos).normalize()
      let q = quat.lookAt(toCam, vec3.up())
      if (p.kind === "ring") {
        q = q.multiply(quat.angleAxis(Math.PI / 2, vec3.right()))
      }
      p.tr.setWorldRotation(q)
    } else {
      p.rot = p.rot.multiply(quat.fromEulerAngles(p.spin.x * dt, p.spin.y * dt, p.spin.z * dt))
      p.tr.setWorldRotation(p.kind === "ring" ? quat.quatIdentity() : p.rot)
    }
    const ringFade = p.kind === "ring" ? clamp(1.0 - k, 0.15, 1) : 1
    p.tr.setWorldScale(new vec3(s, s * ringFade, s))
  }

  private updatePopup(p: Popup, dt: number): void {
    p.t += dt
    const k = p.t / p.life
    if (k >= 1) {
      p.active = false
      p.obj.enabled = false
      return
    }
    const rise = easeOutCubic(k) * 7
    const pos = p.pos.add(new vec3(0, rise, 0))
    p.tr.setWorldPosition(pos)
    const toCam = this.cameraTr.getWorldPosition().sub(pos)
    p.tr.setWorldRotation(quat.lookAt(toCam.normalize(), vec3.up()))
    const s = (k < 0.2 ? easeOutBack(k / 0.2) : 1) * p.scale
    p.tr.setWorldScale(new vec3(s, s, s))
    const a = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4
    p.text.textFill.color = new vec4(p.color.x, p.color.y, p.color.z, a)
  }

  private makeParticle(kind: Kind): Particle {
    const o = global.scene.createSceneObject("FX_" + kind)
    o.setParent(this.root)
    const v = o.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    v.mesh =
      kind === "shard" ? this.assets.shard : kind === "star" ? this.assets.star : kind === "ring" ? this.assets.ring : this.assets.puff
    v.mainMaterial = this.assets.flashMat
    o.enabled = false
    return {
      obj: o,
      tr: o.getTransform(),
      visual: v,
      kind,
      active: false,
      t: 0,
      life: 1,
      pos: vec3.zero(),
      vel: vec3.zero(),
      gravity: 0,
      drag: 0,
      rot: quat.quatIdentity(),
      spin: vec3.zero(),
      s0: 1,
      s1: 1,
      pop: false,
      faceCamera: false
    }
  }

  private makePopup(): Popup {
    const o = global.scene.createSceneObject("FX_ScorePopup")
    o.setParent(this.root)
    const t = o.createComponent("Component.Text") as Text
    t.size = 32
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-10, 10, -2, 2)
    t.dropshadowSettings.enabled = true
    t.dropshadowSettings.fill.color = new vec4(0, 0, 0, 0.6)
    t.dropshadowSettings.offset = new vec2(0.06, -0.06)
    o.enabled = false
    return {obj: o, tr: o.getTransform(), text: t, active: false, t: 0, life: 1, pos: vec3.zero(), color: new vec4(1, 1, 1, 1), scale: 1}
  }

  private randomDir(): vec3 {
    const u = rand(-1, 1)
    const th = rand(0, Math.PI * 2)
    const r = Math.sqrt(1 - u * u)
    return new vec3(r * Math.cos(th), u, r * Math.sin(th))
  }
}
