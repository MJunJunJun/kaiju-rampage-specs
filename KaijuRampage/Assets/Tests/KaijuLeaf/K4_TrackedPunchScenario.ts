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

/** Done criterion 3: a (hand-tracked) punch destroys UFOs and the score goes up; waves get harder. */
@component
export class K4_TrackedPunchScenario extends Scenario {
  async run(): Promise<void> {
    await ensurePlaying()
    // difficulty ramps with time (wave table used by EnemySpawner)
    expect(waveAt(45).speed).toBeGreaterThan(waveAt(5).speed)
    expect(waveAt(5).spawnInterval).toBeGreaterThan(waveAt(45).spawnInterval)

    const puncher = new TrackedPuncher()
    await puncher.ready()
    const before = scoreValue()
    const kills = await puncher.punchUntilKills(6, 24)
    print("[LEAF K4] score " + before + " -> " + scoreValue() + ", kills by tracked punches: " + kills)
    expect(scoreValue()).toBeGreaterThan(before)
    expect(kills).toBeGreaterThan(0)
    await puncher.hide()
  }
}
