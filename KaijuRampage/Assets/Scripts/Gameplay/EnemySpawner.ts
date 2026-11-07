import {KaijuConfig, KaijuRuntime, waveAt} from "../Core/KaijuConfig"
import {rand} from "../Core/MathUtil"
import {CityHealthManager} from "./CityHealthManager"
import {UFOController, UFOState} from "./UFOController"

/**
 * Pools UFO prefab instances and spawns them according to the 60s wave table.
 * Spawn points sit on an arc on the far side and flanks of the city so the
 * saucers always fly *toward* the player's reach, never from behind.
 */
export class EnemySpawner {
  readonly ufos: UFOController[] = []
  private timer = 0
  private running = false
  totalSpawned = 0
  onZap: (ufo: UFOController) => void = () => {}
  onSpawn: (ufo: UFOController) => void = () => {}

  constructor(
    prefab: ObjectPrefab,
    parent: SceneObject,
    flashMat: Material,
    private city: CityHealthManager
  ) {
    for (let i = 0; i < KaijuConfig.ufoPoolSize; i++) {
      const o = prefab.instantiate(parent)
      o.name = "UFO_" + i
      this.ufos.push(new UFOController(o, flashMat))
    }
  }

  get aliveCount(): number {
    let n = 0
    for (const u of this.ufos) if (u.isAlive) n++
    return n
  }

  alive(): UFOController[] {
    return this.ufos.filter((u) => u.isAlive)
  }

  start(): void {
    this.running = true
    this.timer = 0.6 // first saucer shortly after "SMASH!"
    this.totalSpawned = 0
  }

  stop(): void {
    this.running = false
  }

  clear(): void {
    for (const u of this.ufos) u.deactivate()
  }

  update(dt: number, elapsed: number): void {
    if (this.running) {
      const wave = waveAt(elapsed)
      this.timer -= dt
      if (this.timer <= 0) {
        if (this.aliveCount < wave.maxAlive) {
          this.spawnOne(elapsed)
          this.timer = wave.spawnInterval * rand(0.8, 1.2)
        } else {
          this.timer = 0.25
        }
      }
    }
    for (const u of this.ufos) {
      if (u.state === UFOState.Dead) {
        u.deactivate()
        continue
      }
      if (u.update(dt) === "zap") {
        this.onZap(u)
        u.deactivate()
      }
    }
  }

  /**
   * Where a UFO parks to shoot: up at a comfortable punching height and stood off
   * from its target toward the side it came from, but always within arm's reach.
   */
  private hoverPoint(targetTop: vec3, spawn: vec3): vec3 {
    const away = new vec3(spawn.x - targetTop.x, 0, spawn.z - targetTop.z)
    const dir = away.length > 0.01 ? away.normalize() : new vec3(0, 0, -1)
    let p = targetTop.add(dir.uniformScale(rand(KaijuConfig.ufoStandOffMin, KaijuConfig.ufoStandOffMax)))
    const y = Math.max(
      targetTop.y + KaijuConfig.ufoAttackHover,
      KaijuRuntime.eyeY - rand(KaijuConfig.ufoAttackBelowEyeMin, KaijuConfig.ufoAttackBelowEyeMax)
    )
    p = new vec3(p.x, y, p.z)
    // keep it reachable: pull toward the player if it parked too far away
    const player = new vec3(0, y, KaijuRuntime.playerZ)
    const flatD = new vec3(p.x - player.x, 0, p.z - player.z)
    if (flatD.length > KaijuConfig.ufoMaxReach) {
      p = player.add(flatD.normalize().uniformScale(KaijuConfig.ufoMaxReach))
    }
    return p
  }

  spawnOne(elapsed: number): UFOController | null {
    const u = this.ufos.find((x) => x.state === UFOState.Inactive)
    if (!u) return null
    const occupied: number[] = []
    for (const other of this.ufos) {
      if (other.isAlive && other.target && other.target.kind === "building") {
        occupied[other.target.index] = (occupied[other.target.index] ?? 0) + 1
      }
    }
    const target = this.city.pickTarget(occupied)
    // GameRoot space: -Z is away from the player. Arc from far-left to far-right (-170..-10 deg).
    const ang = rand(-170, -10) * (Math.PI / 180)
    const r = rand(KaijuConfig.ufoSpawnRadiusMin, KaijuConfig.ufoSpawnRadiusMax)
    const y = KaijuRuntime.eyeY - rand(KaijuConfig.ufoSpawnBelowEyeMin, KaijuConfig.ufoSpawnBelowEyeMax)
    const spawn = new vec3(Math.cos(ang) * r, y, Math.sin(ang) * r)
    u.spawn(spawn, target, waveAt(elapsed), this.hoverPoint(target.localTop, spawn))
    this.totalSpawned++
    this.onSpawn(u)
    return u
  }
}
