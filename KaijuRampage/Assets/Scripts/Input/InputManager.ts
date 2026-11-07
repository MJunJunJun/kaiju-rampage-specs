import {UFOController} from "../Gameplay/UFOController"
import {KaijuHandController} from "./KaijuHandController"

export interface ScreenButton {
  center(): vec3
  radius: number
  enabled(): boolean
  press(source: string): void
}

/**
 * Mode selection + Lens Studio Preview fallback input.
 *
 * Mode A (Spectacles): nothing to do here – KaijuHandController reads SIK hand
 *   tracking and PunchDetector judges real hand motion.
 * Mode B (Preview): a tap/click aims at a UFO (ray pick) and makes the nearest
 *   simulated claw lunge at it; the keyboard offers Space = punch the most
 *   dangerous UFO, S = start, R = restart. The lunge is a real claw motion, so
 *   the hit is still judged by PunchDetector (collision + speed + cooldown).
 */
export class InputManager {
  buttons: ScreenButton[] = []
  onStartKey: () => void = () => {}
  onRestartKey: () => void = () => {}
  onUpgradeKey: (index: number) => void = () => {}
  onMenuKey: () => void = () => {}
  lastAction = ""
  private nextHand = 0

  constructor(
    private script: BaseScriptComponent,
    private camera: Camera,
    private hands: KaijuHandController[],
    private getUfos: () => UFOController[]
  ) {
    // Mouse/keyboard fallback is a Preview-only affordance. On Specs the touchpad can
    // also emit TapEvent, which must not fire screen-space ray picks.
    if (global.deviceInfoSystem.isEditor()) {
      script.createEvent("TapEvent").bind((e: TapEvent) => this.onScreenPoint(e.getTapPosition(), "tap"))
      script.createEvent("KeyPressEvent").bind((e: KeyPressEvent) => this.onKey(e.key))
    }
  }

  get simulatedActive(): boolean {
    return this.hands.some((h) => h.source === "simulated")
  }

  get trackedActive(): boolean {
    return this.hands.some((h) => h.source === "tracked")
  }

  /** Public so tools/tests can drive the same path: normalized screen point (0..1, top-left origin). */
  onScreenPoint(p: vec2, via: string): void {
    const ray = this.screenRay(p)
    // 1) UFO under the cursor (generous radius – this is the mouse "aim assist")
    let best: UFOController | null = null
    let bestScore = 1e9
    for (const u of this.getUfos()) {
      if (!u.isAlive) continue
      const c = u.worldCenter
      const tAlong = c.sub(ray.origin).dot(ray.dir)
      if (tAlong <= 0) continue
      const closest = ray.origin.add(ray.dir.uniformScale(tAlong))
      const miss = closest.distance(c)
      if (miss < 13 && miss < bestScore) {
        bestScore = miss
        best = u
      }
    }
    if (best) {
      this.lungeAt(best.worldCenter, p.x < 0.5 ? "left" : "right")
      this.lastAction = via + ":ufo"
      print("[Kaiju] " + via + " (" + p.x.toFixed(2) + "," + p.y.toFixed(2) + ") -> aim UFO, miss=" + bestScore.toFixed(1) + "cm")
      return
    }
    // 2) a HUD button under the cursor
    for (const b of this.buttons) {
      if (!b.enabled()) continue
      const c = b.center()
      const tAlong = c.sub(ray.origin).dot(ray.dir)
      if (tAlong <= 0) continue
      const miss = ray.origin.add(ray.dir.uniformScale(tAlong)).distance(c)
      if (miss < b.radius) {
        b.press(via)
        this.lastAction = via + ":button"
        return
      }
    }
    // 3) swing at the air for feedback
    this.lungeAt(ray.origin.add(ray.dir.uniformScale(45)), p.x < 0.5 ? "left" : "right")
    this.lastAction = via + ":air"
    print("[Kaiju] " + via + " (" + p.x.toFixed(2) + "," + p.y.toFixed(2) + ") -> air swing")
  }

  /** Normalized screen positions of live UFOs (debug / automated preview testing). */
  ufoScreenPositions(): string {
    return this.getUfos()
      .filter((u) => u.isAlive)
      .map((u) => {
        const s = this.camera.worldSpaceToScreenSpace(u.worldCenter)
        return u.obj.name + "@(" + s.x.toFixed(2) + "," + s.y.toFixed(2) + ")"
      })
      .join(" ")
  }

  /** Space bar: punch the UFO that is closest to zapping the city. */
  punchMostDangerous(): boolean {
    const ufos = this.getUfos().filter((u) => u.isAlive)
    if (ufos.length === 0) return false
    const camPos = this.camera.getTransform().getWorldPosition()
    ufos.sort((a, b) => {
      const da = b.chargeProgress - a.chargeProgress
      if (Math.abs(da) > 0.001) return da
      return a.worldCenter.distance(camPos) - b.worldCenter.distance(camPos)
    })
    const side = this.nextHand++ % 2 === 0 ? "right" : "left"
    return this.lungeAt(ufos[0].worldCenter, side)
  }

  private lungeAt(target: vec3, preferred: "left" | "right"): boolean {
    const order = preferred === "left" ? [0, 1] : [1, 0]
    for (const i of order) {
      const h = this.hands[i]
      if (h && h.lungeAt(target)) return true
    }
    return false
  }

  private onKey(key: Keys): void {
    if (key === Keys.Space) {
      this.punchMostDangerous()
      this.lastAction = "key:space"
    } else if (key === Keys.S) {
      this.onStartKey()
      this.lastAction = "key:s"
    } else if (key === Keys.R) {
      this.onRestartKey()
      this.lastAction = "key:r"
    } else if (key === Keys.One || key === Keys.Two || key === Keys.Three) {
      this.onUpgradeKey(key === Keys.One ? 0 : key === Keys.Two ? 1 : 2)
      this.lastAction = "key:upgrade"
    } else if (key === Keys.M) {
      this.onMenuKey()
      this.lastAction = "key:m"
    }
  }

  private screenRay(p: vec2): {origin: vec3; dir: vec3} {
    const near = this.camera.screenSpaceToWorldSpace(p, 5)
    const far = this.camera.screenSpaceToWorldSpace(p, 200)
    return {origin: near, dir: far.sub(near).normalize()}
  }
}
