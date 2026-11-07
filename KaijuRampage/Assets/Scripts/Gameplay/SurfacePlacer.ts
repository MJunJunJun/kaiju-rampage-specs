import {KaijuConfig} from "../Core/KaijuConfig"
import {flat} from "../Core/MathUtil"

export interface Placement {
  position: vec3
  forward: vec3 // flattened direction from the user toward the city
  drop: number // how far below the eyes the platform sits (cm)
  onSurface: boolean
}

/**
 * Finds a comfortable real surface (table / desk / low shelf) in front of the
 * user with the Specs WorldQueryModule and snaps the miniature city onto it.
 * Falls back to a head-relative float when there is no module, no hit (e.g. in
 * Lens Studio Preview – WorldQuery is wearable-only), or the surface is outside
 * the comfort band defined in KaijuConfig.
 */
export class SurfacePlacer {
  private session: HitTestSession | null = null
  private best: {pos: vec3; t: number} | null = null
  private t = 0
  private probeT = 0
  private pitchIdx = 0
  readonly available: boolean

  constructor(module: WorldQueryModule | undefined | null) {
    try {
      if (module) {
        const opts = HitTestSessionOptions.create()
        opts.filter = true
        this.session = module.createHitTestSessionWithOptions(opts)
        this.session.start()
      }
    } catch (e) {
      print("[Kaiju] WorldQuery unavailable (" + e + ") – using head-relative placement")
      this.session = null
    }
    this.available = this.session !== null
  }

  /** Call every frame while waiting to place: casts a few rays down-forward. */
  update(dt: number, cam: Transform): void {
    this.t += dt
    if (!this.session) return
    this.probeT -= dt
    if (this.probeT > 0) return
    this.probeT = 0.2 // WorldQuery updates at ~5 Hz anyway
    const pitches = [30, 40, 50]
    const pitch = pitches[this.pitchIdx++ % pitches.length] * (Math.PI / 180)
    const camPos = cam.getWorldPosition()
    const fwd = flat(cam.back)
    const dir = fwd.uniformScale(Math.cos(pitch)).add(new vec3(0, -Math.sin(pitch), 0))
    try {
      this.session.hitTest(camPos, camPos.add(dir.uniformScale(160)), (hit: WorldQueryHitTestResult) => {
        if (!hit) return
        if (hit.normal.normalize().y < 0.85) return // only roughly horizontal surfaces
        const drop = camPos.y - hit.position.y
        const d = new vec3(hit.position.x - camPos.x, 0, hit.position.z - camPos.z).length
        if (drop < KaijuConfig.surfaceMinDrop || drop > KaijuConfig.surfaceMaxDrop) return
        if (d < KaijuConfig.surfaceMinDistance || d > KaijuConfig.surfaceMaxDistance) return
        this.best = {pos: hit.position, t: this.t}
      })
    } catch (e) {
      // keep the fallback path alive no matter what the module does
    }
  }

  /** Best placement right now (surface hit from the last ~2 s, else floating default). */
  choose(cam: Transform): Placement {
    const camPos = cam.getWorldPosition()
    const fwd = flat(cam.back)
    if (this.best && this.t - this.best.t < 2.0) {
      const p = this.best.pos
      // keep the city inside arm's reach even if the hit landed a bit far away
      const horiz = new vec3(p.x - camPos.x, 0, p.z - camPos.z)
      const dist = Math.min(horiz.length, KaijuConfig.cityForward + 6)
      const dirFlat = horiz.length > 1 ? horiz.normalize() : fwd
      const pos = new vec3(camPos.x, p.y + 0.5, camPos.z).add(dirFlat.uniformScale(dist))
      return {position: pos, forward: dirFlat, drop: camPos.y - pos.y, onSurface: true}
    }
    const pos = camPos.add(fwd.uniformScale(KaijuConfig.cityForward)).add(new vec3(0, -KaijuConfig.cityDown, 0))
    return {position: pos, forward: fwd, drop: KaijuConfig.cityDown, onSurface: false}
  }
}
