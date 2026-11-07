import TrackedHand from "SpectaclesInteractionKit.lspkg/Providers/HandInputData/TrackedHand"

/** The minimal hand skeleton the Kaiju claw logic needs (world space, cm). */
export interface HandPose {
  wrist: vec3
  indexKnuckle: vec3
  middleKnuckle: vec3
  pinkyKnuckle: vec3
  palm: vec3
  tips: vec3[] // index, middle, ring, pinky
}

export interface HandPoseSource {
  readonly label: "tracked" | "synthetic"
  /** null while the hand is not tracked. */
  read(): HandPose | null
}

/** Real Specs hand tracking through SIK HandInputData. */
export class SikHandSource implements HandPoseSource {
  readonly label = "tracked" as const
  constructor(private hand: TrackedHand) {}

  read(): HandPose | null {
    const h = this.hand
    if (!h.isTracked()) return null
    const midK = h.middleKnuckle.position
    return {
      wrist: h.wrist.position,
      indexKnuckle: h.indexKnuckle.position,
      middleKnuckle: midK,
      pinkyKnuckle: h.pinkyKnuckle.position,
      palm: h.getPalmCenter() ?? midK,
      tips: [h.indexTip.position, h.middleTip.position, h.ringTip.position, h.pinkyTip.position]
    }
  }
}

/**
 * Scripted, anatomically-plausible hand skeleton for Preview testing of the
 * *tracked* code path (orientation math, fist detection, velocity, teleport
 * guard). It is NOT real hand tracking and is labelled as such in the HUD.
 */
export class SyntheticHandSource implements HandPoseSource {
  readonly label = "synthetic" as const
  tracked = true
  private pose: HandPose | null = null

  constructor(private side: "left" | "right") {}

  read(): HandPose | null {
    return this.tracked ? this.pose : null
  }

  /**
   * @param wrist   wrist world position
   * @param finger  unit direction wrist -> middle knuckle
   * @param back    unit back-of-hand normal (palm faces -back)
   * @param fist    curled fingers when true
   * @param jitter  random noise in cm, like a real tracker
   */
  setPose(wrist: vec3, finger: vec3, back: vec3, fist: boolean, jitter: number = 0): void {
    const F = finger.normalize()
    const B = back.normalize()
    // index side of the hand: right = back x finger, left = finger x back
    const A = (this.side === "right" ? B.cross(F) : F.cross(B)).normalize()
    const n = (): vec3 =>
      jitter > 0 ? new vec3((Math.random() - 0.5) * jitter, (Math.random() - 0.5) * jitter, (Math.random() - 0.5) * jitter) : vec3.zero()
    const at = (f: number, a: number, b: number): vec3 =>
      wrist.add(F.uniformScale(f)).add(A.uniformScale(a)).add(B.uniformScale(b)).add(n())
    const tip = (a: number): vec3 => (fist ? at(9.5, a, -3.5) : at(17, a, 0.3))
    this.pose = {
      wrist: wrist.add(n()),
      indexKnuckle: at(8.6, 2.4, 0),
      middleKnuckle: at(9.0, 0.4, 0),
      pinkyKnuckle: at(7.6, -3.0, 0),
      palm: at(4.5, 0, -1.0),
      tips: [tip(2.4), tip(0.4), tip(-1.4), tip(-3.0)]
    }
  }
}
