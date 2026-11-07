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

/** Done criterion 1: main menu at start, with the high score and the coin balance. */
@component
export class K1_MainMenuScenario extends Scenario {
  async run(): Promise<void> {
    expect(await waitUntil(() => isShown("TitlePanel"), 3000)).toBe(true)
    const line = textOf("Best")
    print("[LEAF K1] menu line: " + line.replace(/\s+/g, " "))
    expect(line.includes("BEST")).toBe(true)
    expect(line.includes("COINS")).toBe(true)
    expect(findInteractableByName("StartButton", undefined, true) !== undefined).toBe(true)
    for (const id of ["attack", "health", "bonus"]) {
      expect(isShown("Upgrade_" + id)).toBe(true)
    }
  }
}
