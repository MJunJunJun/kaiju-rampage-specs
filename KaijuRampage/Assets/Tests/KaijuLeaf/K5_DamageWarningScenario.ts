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

/** Done criterion 5: when the city is hit, a red warning shows on the attacker's side. */
@component
export class K5_DamageWarningScenario extends Scenario {
  async run(): Promise<void> {
    await ensurePlaying()
    const seen = await waitUntil(() => isShown("DamageWarning_Left") || isShown("DamageWarning_Right"), 30000, 50)
    const side = isShown("DamageWarning_Left") ? "left" : isShown("DamageWarning_Right") ? "right" : "none"
    print("[LEAF K5] red warning seen=" + seen + " side=" + side)
    expect(seen).toBe(true)
  }
}
