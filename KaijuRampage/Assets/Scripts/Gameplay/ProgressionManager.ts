/**
 * Coins + permanent upgrades (brief: "coins and progress are saved permanently").
 * Persisted with persistentStorageSystem, so progress survives closing the Lens.
 * (Lens Studio Preview resets this storage on every Lens reload.)
 */
export type UpgradeId = "attack" | "health" | "bonus"

interface UpgradeDef {
  label: string
  baseCost: number
}

export const UPGRADES: {[k in UpgradeId]: UpgradeDef} = {
  attack: {label: "ATTACK", baseCost: 40},
  health: {label: "CITY HP", baseCost: 30},
  bonus: {label: "BONUS COIN", baseCost: 50}
}
export const UPGRADE_ORDER: UpgradeId[] = ["attack", "health", "bonus"]

export const ProgressionConfig = {
  maxLevel: 5,
  costGrowth: 1.6, // every level costs more than the last (brief)
  coinsPerKill: 5,
  bonusChancePerLevel: 0.1, // bonus coin chance per UFO kill
  bonusCoins: 3,
  cityHealthPerLevel: 20
}

export class ProgressionManager {
  coins = 0
  levels: {[k in UpgradeId]: number} = {attack: 0, health: 0, bonus: 0}
  persisted = false
  onChanged: () => void = () => {}

  constructor() {
    this.load()
  }

  cost(id: UpgradeId): number {
    const lv = this.levels[id]
    if (lv >= ProgressionConfig.maxLevel) return -1
    return Math.round(UPGRADES[id].baseCost * Math.pow(ProgressionConfig.costGrowth, lv))
  }

  canBuy(id: UpgradeId): boolean {
    const c = this.cost(id)
    return c > 0 && this.coins >= c
  }

  buy(id: UpgradeId): boolean {
    if (!this.canBuy(id)) return false
    this.coins -= this.cost(id)
    this.levels[id]++
    this.save()
    this.onChanged()
    return true
  }

  /** Extra punch damage from the ATTACK upgrade (+1 at Lv1, +2 at Lv3, +3 at Lv5). */
  get damageBonus(): number {
    return Math.ceil(this.levels.attack / 2)
  }

  get cityMaxHealth(): number {
    return 100 + this.levels.health * ProgressionConfig.cityHealthPerLevel
  }

  get bonusChance(): number {
    return this.levels.bonus * ProgressionConfig.bonusChancePerLevel
  }

  /** Called on every UFO kill; returns bonus coins earned (0 most of the time). */
  rollBonus(): number {
    return Math.random() < this.bonusChance ? ProgressionConfig.bonusCoins : 0
  }

  /** Round end – win or lose both pay out (brief). */
  awardRound(kills: number, bonusCoins: number): number {
    const earned = kills * ProgressionConfig.coinsPerKill + bonusCoins
    this.coins += earned
    this.save()
    this.onChanged()
    return earned
  }

  private load(): void {
    try {
      const st = global.persistentStorageSystem.store
      this.coins = st.getInt("kaiju_coins") ?? 0
      for (const id of UPGRADE_ORDER) this.levels[id] = st.getInt("kaiju_lv_" + id) ?? 0
      this.persisted = true
    } catch (e) {
      this.persisted = false
    }
  }

  private save(): void {
    try {
      const st = global.persistentStorageSystem.store
      st.putInt("kaiju_coins", this.coins)
      for (const id of UPGRADE_ORDER) st.putInt("kaiju_lv_" + id, this.levels[id])
    } catch (e) {
      // storage unavailable – progress lives for this session only
    }
  }
}
