import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {createIKInteractor} from "Leaf.lspkg/Interactors/interactor/ik/visualizer/BitmojiAvatar"
import {waveAt} from "../../Scripts/Core/KaijuConfig"
import {
  TrackedPuncher,
  aliveUfos,
  camTr,
  coinsOnMenu,
  ensurePlaying,
  isShown,
  obj,
  press,
  scoreValue,
  textOf,
  upgradeInfo,
  waitUntil
} from "./KaijuLeafHelpers"

/** Done criterion 4: during play, progress (score + time) and city health sit on the RIGHT. */
@component
export class K3_RightSideHudScenario extends Scenario {
  async run(): Promise<void> {
    await ensurePlaying()
    expect(isShown("HUDBar")).toBe(true)
    expect(isShown("Score")).toBe(true)
    expect(isShown("Timer")).toBe(true)
    expect(isShown("HealthFill")).toBe(true)
    const c = camTr()
    const toHud = obj("HUDBar").getTransform().getWorldPosition().sub(c.getWorldPosition())
    const rightness = toHud.dot(c.right)
    print("[LEAF K3] HUD offset to the right of the head: " + rightness.toFixed(1) + " cm")
    expect(rightness).toBeGreaterThan(10)
  }
}
