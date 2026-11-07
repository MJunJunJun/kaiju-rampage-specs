import {KaijuConfig} from "../Core/KaijuConfig"

/**
 * Chained hits inside a short window build a combo; every `comboStep` hits
 * raise the score multiplier. A UFO zapping the city breaks the chain.
 */
export class ComboManager {
  combo = 0
  bestCombo = 0
  private timer = 0
  onComboChanged: (combo: number, multiplier: number) => void = () => {}

  get multiplier(): number {
    return Math.min(KaijuConfig.comboMaxMultiplier, 1 + Math.floor(this.combo / KaijuConfig.comboStep))
  }

  /** 0..1 – how much of the combo window is left (for UI). */
  get windowLeft(): number {
    return this.combo > 0 ? this.timer / KaijuConfig.comboWindow : 0
  }

  registerHit(): void {
    this.combo++
    this.bestCombo = Math.max(this.bestCombo, this.combo)
    this.timer = KaijuConfig.comboWindow
    this.onComboChanged(this.combo, this.multiplier)
  }

  breakCombo(): void {
    if (this.combo !== 0) {
      this.combo = 0
      this.timer = 0
      this.onComboChanged(0, 1)
    }
  }

  reset(): void {
    this.combo = 0
    this.bestCombo = 0
    this.timer = 0
    this.onComboChanged(0, 1)
  }

  update(dt: number): void {
    if (this.combo > 0) {
      this.timer -= dt
      if (this.timer <= 0) this.breakCombo()
    }
  }
}
