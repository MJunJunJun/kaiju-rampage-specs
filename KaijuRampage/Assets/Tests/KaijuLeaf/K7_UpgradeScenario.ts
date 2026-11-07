import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {createIKInteractor} from "Leaf.lspkg/Interactors/interactor/ik/visualizer/BitmojiAvatar"
import {IKBodyInteractor} from "Leaf.lspkg/Interactors/interactor/ik/IKBodyInteractor"
import {TrackedPuncher, coinsOnMenu, ensurePlaying, isShown, press, upgradeInfo, waitUntil} from "./KaijuLeafHelpers"

const IDS = ["attack", "health", "bonus"]

function cheapestAffordable(coins: number): {id: string; cost: number} | null {
  let pick: {id: string; cost: number} | null = null
  for (const id of IDS) {
    const info = upgradeInfo(id)
    if (info.cost > 0 && info.cost <= coins && (!pick || info.cost < pick.cost)) pick = {id, cost: info.cost}
  }
  return pick
}

/**
 * Done criterion 7: on the main menu, buying an upgrade raises its level, spends coins,
 * and every level costs more than the last. Coins are saved permanently, so when the
 * saved balance can't afford anything this scenario first earns coins with tracked
 * punches, then returns to the menu through the result screen's MENU button.
 * (The upgrade's effect in the next round is covered by GameManager logs, not here.)
 */
@component
export class K7_UpgradeScenario extends Scenario {
  private ik: IKBodyInteractor | null = null

  async run(): Promise<void> {
    expect(await waitUntil(() => isShown("TitlePanel"), 4000)).toBe(true)
    await sleep(500)
    let coins = coinsOnMenu()
    print("[LEAF K7] saved coins on the main menu: " + coins)

    if (!cheapestAffordable(coins)) {
      // earn coins: 5 per UFO destroyed, paid at the end of every round (win or lose)
      await ensurePlaying()
      const puncher = new TrackedPuncher()
      await puncher.ready()
      const kills = await puncher.punchUntilKills(7, 40)
      await puncher.hide()
      print("[LEAF K7] kills this round: " + kills)
      expect(await waitUntil(() => isShown("ResultPanel"), 90000, 200)).toBe(true)
      await sleep(1200) // result panel pop-in
      // the LEAF right hand is still wrapped by the puncher; reach MENU with the IK avatar
      this.ik = createIKInteractor()
      const menu = findInteractableByName("MenuButton", undefined, true)
      if (!menu) throw new Error("MenuButton not interactable")
      await this.ik.trigger(menu)
      expect(await waitUntil(() => isShown("TitlePanel"), 3000)).toBe(true)
      await sleep(500)
      coins = coinsOnMenu()
    }

    const pick = cheapestAffordable(coins)
    print("[LEAF K7] coins=" + coins + " cheapest affordable=" + (pick ? pick.id + " (" + pick.cost + ")" : "none"))
    if (!pick) throw new Error("Not enough coins to test a purchase (coins=" + coins + ")")
    const before = upgradeInfo(pick.id)
    if (this.ik) {
      const b = findInteractableByName("Upgrade_" + pick.id, undefined, true)
      if (!b) throw new Error("Upgrade button not interactable")
      await this.ik.trigger(b)
      await sleep(600)
    } else {
      await press("Upgrade_" + pick.id)
      await sleep(300)
    }
    const after = upgradeInfo(pick.id)
    print("[LEAF K7] " + pick.id + " Lv " + before.level + " -> " + after.level + ", coins " + coins + " -> " + coinsOnMenu() + ", next cost " + before.cost + " -> " + after.cost)
    expect(after.level).toBe(before.level + 1)
    expect(coinsOnMenu()).toBe(coins - before.cost)
    if (after.cost > 0) expect(after.cost).toBeGreaterThan(before.cost) // every level costs more (brief)
  }
}
