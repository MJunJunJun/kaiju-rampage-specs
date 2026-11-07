import {KaijuConfig} from "../Core/KaijuConfig"

/** Tracks score, UFOs destroyed and the session best score. */
export class ScoreManager {
  score = 0
  kills = 0
  hits = 0
  best = 0
  onScoreChanged: (score: number, delta: number) => void = () => {}

  constructor() {
    try {
      const store = global.persistentStorageSystem.store
      this.best = store.getInt("kaiju_best") ?? 0
    } catch (e) {
      this.best = 0
    }
  }

  reset(): void {
    this.score = 0
    this.kills = 0
    this.hits = 0
    this.onScoreChanged(0, 0)
  }

  addHit(multiplier: number): number {
    this.hits++
    return this.add(KaijuConfig.hitPoints * multiplier)
  }

  addKill(multiplier: number): number {
    this.kills++
    return this.add(KaijuConfig.killPoints * multiplier)
  }

  /** Bonus for every remaining point of city health at the end of a won round. */
  addSurvivalBonus(cityHealth: number): number {
    return this.add(Math.round(cityHealth) * 5)
  }

  commitBest(): boolean {
    if (this.score > this.best) {
      this.best = this.score
      try {
        global.persistentStorageSystem.store.putInt("kaiju_best", this.best)
      } catch (e) {
        // persistent storage is optional (not available in every preview mode)
      }
      return true
    }
    return false
  }

  private add(points: number): number {
    this.score += points
    this.onScoreChanged(this.score, points)
    return points
  }
}
