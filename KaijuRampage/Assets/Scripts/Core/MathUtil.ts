/** Small math, easing and scene helpers shared by every Kaiju system. */

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function rand(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo)
}

export function randInt(lo: number, hiInclusive: number): number {
  return Math.floor(rand(lo, hiInclusive + 1))
}

export function easeOutCubic(t: number): number {
  const u = 1 - clamp(t, 0, 1)
  return 1 - u * u * u
}

export function easeInCubic(t: number): number {
  const u = clamp(t, 0, 1)
  return u * u * u
}

export function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  const u = clamp(t, 0, 1) - 1
  return 1 + c3 * u * u * u + c1 * u * u
}

/** 0 -> 1 -> 0 bump. */
export function pulse(t: number): number {
  return Math.sin(clamp(t, 0, 1) * Math.PI)
}

export const DEG = Math.PI / 180

/** Yaw-only rotation (radians) that makes +Z point along the flattened direction. */
export function yawFromDirection(dir: vec3): number {
  return Math.atan2(dir.x, dir.z)
}

export function flat(v: vec3): vec3 {
  const f = new vec3(v.x, 0, v.z)
  const len = f.length
  return len > 1e-5 ? f.uniformScale(1 / len) : new vec3(0, 0, -1)
}

/** Finds a direct or nested child by name. */
export function findChild(root: SceneObject, name: string): SceneObject | null {
  const n = root.getChildrenCount()
  for (let i = 0; i < n; i++) {
    const c = root.getChild(i)
    if (c.name === name) {
      return c
    }
    const deep = findChild(c, name)
    if (deep) {
      return deep
    }
  }
  return null
}

export function setVisualMaterial(obj: SceneObject, mat: Material): void {
  const v = obj.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
  if (v) {
    v.mainMaterial = mat
  }
}

export function makeMeshObject(
  name: string,
  parent: SceneObject,
  mesh: RenderMesh,
  mat: Material
): SceneObject {
  const o = global.scene.createSceneObject(name)
  o.setParent(parent)
  const v = o.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
  v.mesh = mesh
  v.mainMaterial = mat
  return o
}

export function colorMaterial(base: Material, r: number, g: number, b: number, a: number = 1): Material {
  const m = base.clone()
  m.mainPass.baseColor = new vec4(r, g, b, a)
  return m
}
