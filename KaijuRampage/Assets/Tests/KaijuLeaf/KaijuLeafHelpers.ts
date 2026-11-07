import {SIK} from "SpectaclesInteractionKit.lspkg/SIK"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {LeafHandInteractor} from "Leaf.lspkg/Interactors/interactor/LeafTwoHandInteractor"
import {findSceneObjectByName, findSceneObjects, sleep} from "Leaf.lspkg/Utils/common/Utils"

/**
 * Shared helpers for the KAIJU RAMPAGE LEAF suite. Every scene-object name used
 * here was verified against the running Lens (QueryRuntimeSceneTool) and the
 * Lens source (UIManager.ts / EnemySpawner.ts / DamageIndicator.ts).
 */

export function obj(name: string): SceneObject {
  const o = findSceneObjectByName(name)
  if (!o) throw new Error(`Scene object "${name}" not found`)
  return o
}

export function isShown(name: string): boolean {
  const o = findSceneObjectByName(name)
  return !!o && o.isEnabledInHierarchy
}

export function textOf(name: string): string {
  const t = obj(name).getComponent("Component.Text") as Text
  if (!t) throw new Error(`"${name}" has no Text component`)
  return t.text
}

export function scoreValue(): number {
  return parseInt(textOf("Score"), 10) || 0
}

/** "BEST  8880        COINS  7" -> 7 */
export function coinsOnMenu(): number {
  const m = textOf("Best").match(/COINS\s+(\d+)/)
  return m ? parseInt(m[1], 10) : -1
}

/** Upgrade button label "CITY HP\nLv 2/5\n77 coins" -> {level: 2, cost: 77} (cost -1 = MAX). */
export function upgradeInfo(id: string): {level: number; cost: number} {
  const label = obj("Upgrade_" + id)
  const textObj = findSceneObjectByName("Label", label)
  const t = (textObj ? textObj.getComponent("Component.Text") : null) as Text
  const txt = t ? t.text : ""
  const lv = txt.match(/Lv\s+(\d+)/)
  const cost = txt.match(/(\d+)\s+coins/)
  return {level: lv ? parseInt(lv[1], 10) : -1, cost: cost ? parseInt(cost[1], 10) : -1}
}

export async function waitUntil(cond: () => boolean, timeoutMs: number, stepMs: number = 100): Promise<boolean> {
  let waited = 0
  while (waited < timeoutMs) {
    if (cond()) return true
    await sleep(stepMs)
    waited += stepMs
  }
  return cond()
}

export function aliveUfos(): SceneObject[] {
  return findSceneObjects((o: SceneObject) => (/^UFO_\d+$/.test(o.name) && o.isEnabledInHierarchy ? o : undefined))
}

export function camTr(): Transform {
  return obj("Camera Object").getTransform()
}

/** Presses a HoloButton through SIK (works in Preview exactly like a pinch/poke). */
export async function press(buttonName: string): Promise<void> {
  const b = findInteractableByName(buttonName, undefined, true)
  if (!b) throw new Error(`Button "${buttonName}" not found or not enabled`)
  await new DefaultLeafInteractor().trigger(b)
  await sleep(300)
}

/** Makes sure a round is running (used when an earlier scenario left the Lens on a menu). */
export async function ensurePlaying(): Promise<void> {
  // right after a LEAF reset the city appears ~0.3 s late – wait for some UI first
  await waitUntil(() => isShown("TitlePanel") || isShown("ResultPanel") || isShown("HUDBar"), 4000)
  if (isShown("TitlePanel")) await press("StartButton")
  else if (isShown("ResultPanel")) await press("RestartButton")
  await waitUntil(() => isShown("HUDBar") && !isShown("Countdown"), 6000)
}

/**
 * A real hand-tracked punch: LEAF drives SIK's TrackedHand (isTracked + keypoints),
 * so the game's Specs code path (SikHandSource -> KaijuHandController ->
 * PunchDetector) judges it exactly like a punch from real Specs hand tracking.
 */
export class TrackedPuncher {
  private leaf = LeafHandInteractor.get("right")
  private sik = SIK.HandInputData.getHand("right")

  private restPos(): vec3 {
    const c = camTr()
    return c.getWorldPosition().add(c.right.uniformScale(15)).add(c.up.uniformScale(-25)).add(c.back.uniformScale(25))
  }

  async ready(): Promise<void> {
    await this.leaf.hand.makeGesture("fist")
    await this.leaf.hand.setPosition(this.restPos(), 300)
    await sleep(300)
  }

  /** Swing so the knuckles pass ~3 cm through the target, then pull back. */
  async punchAt(target: vec3): Promise<void> {
    const knuckleOffset = this.sik.middleKnuckle.position.sub(this.sik.wrist.position)
    const dir = target.sub(this.sik.middleKnuckle.position).normalize()
    const wristGoal = target.add(dir.uniformScale(3)).sub(knuckleOffset)
    await this.leaf.hand.setPosition(wristGoal, 140) // ~300+ cm/s, a brisk real punch
    await sleep(120)
    await this.leaf.hand.setPosition(this.restPos(), 300)
    await sleep(250)
  }

  async hide(): Promise<void> {
    await this.leaf.hand.hide(200)
  }

  /** Pinch-press a HUD button with this same (LEAF-driven) right hand. */
  async pressButton(buttonName: string): Promise<void> {
    const b = findInteractableByName(buttonName, undefined, true)
    if (!b) throw new Error(`Button "${buttonName}" not found or not enabled`)
    await this.leaf.trigger(b)
    await sleep(500)
  }

  /** Punches the closest UFO repeatedly until `kills` score jumps (>=100) happened. Returns kills. */
  async punchUntilKills(kills: number, maxPunches: number): Promise<number> {
    let done = 0
    let last = scoreValue()
    for (let i = 0; i < maxPunches && done < kills && isShown("HUDBar"); i++) {
      await waitUntil(() => aliveUfos().length > 0, 4000)
      const ufos = aliveUfos()
      if (ufos.length === 0) continue
      const camPos = camTr().getWorldPosition()
      ufos.sort((a, b) => a.getTransform().getWorldPosition().distance(camPos) - b.getTransform().getWorldPosition().distance(camPos))
      await this.punchAt(ufos[0].getTransform().getWorldPosition())
      const now = scoreValue()
      if (now - last >= 100) done++
      last = now
    }
    return done
  }
}
