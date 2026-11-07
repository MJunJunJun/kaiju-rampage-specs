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

/** Done criterion 6: game-over panel with score + coins earned; Restart starts a new round. */
@component
export class K6_GameOverRestartScenario extends Scenario {
  async run(): Promise<void> {
    await ensurePlaying()
    // no defence: the UFOs destroy the city, which ends the round
    expect(await waitUntil(() => isShown("ResultPanel"), 90000, 200)).toBe(true)
    await sleep(1200) // let the result panel finish its pop-in so the buttons have full-size colliders
    const body = textOf("ResultBody")
    print("[LEAF K6] result: " + textOf("ResultTitle") + " | " + body.replace(/\s+/g, " "))
    expect(body.includes("SCORE")).toBe(true)
    expect(body.includes("COINS  +")).toBe(true)
    await press("RestartButton")
    expect(await waitUntil(() => isShown("Countdown"), 2000)).toBe(true)
  }
}
