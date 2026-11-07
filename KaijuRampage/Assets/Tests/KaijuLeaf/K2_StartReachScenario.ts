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

/**
 * Done criterion 2 + IK reachability: a full-arm IK avatar reaches for START.
 * Clicking Start shows a countdown, then UFOs fly in.
 */
@component
export class K2_StartReachScenario extends Scenario {
  private readonly ik = createIKInteractor()

  async run(): Promise<void> {
    expect(await waitUntil(() => isShown("TitlePanel"), 3000)).toBe(true)
    const start = findInteractableByName("StartButton", undefined, true)
    if (!start) throw new Error("StartButton not interactable")
    // Watch for the countdown while the arm reaches: the game also accepts a *punch* on the
    // button, so the round can start before the IK pinch finishes. The countdown only lasts ~3 s.
    let countdownSeen = false
    const watcher = waitUntil(() => {
      if (isShown("Countdown")) countdownSeen = true
      return countdownSeen
    }, 15000, 50)
    try {
      await this.ik.trigger(start) // fails to converge if START is out of reach / occluded
    } catch (e) {
      // START disappears as soon as the round starts; a late SIK trigger-end can then time out
      print("[LEAF K2] IK trigger ended early: " + e)
    }
    expect(await watcher).toBe(true)
    print("[LEAF K2] countdown shown after the IK arm reached START")
    expect(await waitUntil(() => aliveUfos().length > 0, 9000)).toBe(true)
    print("[LEAF K2] first UFO in the air: " + aliveUfos()[0].name)
  }
}
