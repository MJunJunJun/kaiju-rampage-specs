import {clamp, colorMaterial, makeMeshObject} from "../Core/MathUtil"

/**
 * Red edge warning (brief: "red at the side of the view the enemy attacks from").
 * Two soft red bars ride just inside the left/right edge of the Specs view
 * (~55 cm ahead); the one on the attacker's side flashes when the city is hit.
 * Kept short and subtle on purpose, since it is head-attached.
 */
export class DamageIndicator {
  private sides: {obj: SceneObject; tr: Transform; t: number}[] = []
  private camTr: Transform

  constructor(camera: SceneObject, panelMesh: RenderMesh, flashMat: Material) {
    this.camTr = camera.getTransform()
    const red = colorMaterial(flashMat, 1.0, 0.12, 0.18)
    for (const sx of [-1, 1]) {
      const root = global.scene.createSceneObject(sx < 0 ? "DamageWarning_Left" : "DamageWarning_Right")
      root.setParent(camera)
      const tr = root.getTransform()
      tr.setLocalPosition(new vec3(sx * 13.5, 0, -55))
      // three stacked strips fake a soft glow fading toward the centre
      const widths = [1.2, 2.2, 3.4]
      for (let i = 0; i < widths.length; i++) {
        const strip = makeMeshObject("Strip" + i, root, panelMesh, red)
        const st = strip.getTransform()
        st.setLocalPosition(new vec3(sx * (widths[i] * 0.5 - 0.6), 0, -i * 0.05))
        st.setLocalScale(new vec3(widths[i], 26 - i * 5, 1))
      }
      root.enabled = false
      this.sides.push({obj: root, tr, t: 0})
    }
  }

  /** Flash the side of the view that `worldPos` is on. */
  flash(worldPos: vec3): void {
    const toEnemy = worldPos.sub(this.camTr.getWorldPosition())
    const right = this.camTr.right
    const s = toEnemy.dot(right) < 0 ? this.sides[0] : this.sides[1]
    s.t = 0.7
    s.obj.enabled = true
  }

  update(dt: number): void {
    for (const s of this.sides) {
      if (s.t <= 0) continue
      s.t -= dt
      if (s.t <= 0) {
        s.obj.enabled = false
        continue
      }
      // quick swell then fade-out (scale-based, the display is additive)
      const k = s.t / 0.7
      const w = clamp(k * 1.6, 0, 1) * (0.85 + 0.15 * Math.sin(s.t * 40))
      s.tr.setLocalScale(new vec3(w, 0.9 + 0.1 * k, 1))
    }
  }

  clear(): void {
    for (const s of this.sides) {
      s.t = 0
      s.obj.enabled = false
    }
  }
}
