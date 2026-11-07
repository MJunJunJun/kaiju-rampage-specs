import {KaijuConfig, KaijuRuntime, waveAt} from "./Core/KaijuConfig"
import {AudioManager} from "./Effects/AudioManager"
import {EffectsManager} from "./Effects/EffectsManager"
import {CityHealthManager} from "./Gameplay/CityHealthManager"
import {ComboManager} from "./Gameplay/ComboManager"
import {EnemySpawner} from "./Gameplay/EnemySpawner"
import {ProgressionConfig, ProgressionManager, UPGRADES, UPGRADE_ORDER, UpgradeId} from "./Gameplay/ProgressionManager"
import {ScoreManager} from "./Gameplay/ScoreManager"
import {SurfacePlacer} from "./Gameplay/SurfacePlacer"
import {UFOController} from "./Gameplay/UFOController"
import {InputManager} from "./Input/InputManager"
import {KaijuHandController} from "./Input/KaijuHandController"
import {PunchDetector, PunchEvent} from "./Input/PunchDetector"
import {SyntheticHandDriver} from "./Input/SyntheticHandDriver"
import {DamageIndicator} from "./UI/DamageIndicator"
import {UIManager} from "./UI/UIManager"

enum GameState {
  Title,
  Countdown,
  Playing,
  Result
}

/**
 * KAIJU RAMPAGE: Alien Invasion – game orchestrator.
 * Title -> Countdown -> Playing (60s waves) -> Result -> Restart.
 */
@component
export class GameManager extends BaseScriptComponent {
  @input camera: SceneObject
  @input gameRoot: SceneObject
  @input cityRoot: SceneObject
  @input ufoParent: SceneObject
  @input fxRoot: SceneObject
  @input hudRoot: SceneObject
  @input leftClaw: SceneObject
  @input rightClaw: SceneObject
  @input ufoPrefab: ObjectPrefab

  @input fxShard: RenderMesh
  @input fxStar: RenderMesh
  @input fxRing: RenderMesh
  @input fxPuff: RenderMesh
  @input uiPanel: RenderMesh
  @input uiFrame: RenderMesh
  @input uiBar: RenderMesh

  @input litMaterial: Material
  @input glowMaterial: Material
  @input flashMaterial: Material
  @input panelMaterial: Material

  // ---- optional sound effects (SCI-FI SFX Pack from the Lens Studio Asset Library)
  @input @allowUndefined sfxPunch: AudioTrackAsset
  @input @allowUndefined sfxExplode: AudioTrackAsset
  @input @allowUndefined sfxZap: AudioTrackAsset
  @input @allowUndefined sfxSpawn: AudioTrackAsset
  @input @allowUndefined sfxButton: AudioTrackAsset
  @input @allowUndefined sfxCountdown: AudioTrackAsset
  @input @allowUndefined sfxStart: AudioTrackAsset
  @input @allowUndefined sfxWin: AudioTrackAsset
  @input @allowUndefined sfxLose: AudioTrackAsset
  @input @allowUndefined sfxAmbient: AudioTrackAsset

  @input
  @hint("Lets the claws be driven by mouse/keyboard in Lens Studio Preview when no tracked hands exist.")
  allowPreviewSimulation: boolean = true

  @input
  @allowUndefined
  @hint("Specs WorldQueryModule – snaps the city onto a real table/desk when one is in a comfortable range.")
  worldQueryModule: WorldQueryModule

  @input
  @hint("EDITOR ONLY: drive the claws with scripted hand skeletons through the real hand-tracking code path.")
  syntheticHandTest: boolean = false

  @input debugLogs: boolean = true

  private state = GameState.Title
  private stateT = 0
  private elapsed = 0
  private placed = false
  private placeDelay = 0.3
  private statsT = 0

  private fx!: EffectsManager
  private city!: CityHealthManager
  private spawner!: EnemySpawner
  private score!: ScoreManager
  private combo!: ComboManager
  private ui!: UIManager
  private hands: KaijuHandController[] = []
  private punch!: PunchDetector
  private input!: InputManager
  private audio!: AudioManager
  private progression!: ProgressionManager
  private roundBonusCoins = 0
  private lastCountdown = -1
  private placer!: SurfacePlacer
  private damageFx!: DamageIndicator
  private synth: SyntheticHandDriver | null = null
  private camTr!: Transform

  onAwake(): void {
    this.camTr = this.camera.getTransform()
    this.hudRoot.getTransform().setLocalPosition(vec3.zero())
    const isEditor = global.deviceInfoSystem.isEditor()
    const allowSim = this.allowPreviewSimulation && isEditor

    this.fx = new EffectsManager(
      this.fxRoot,
      {
        shard: this.fxShard,
        star: this.fxStar,
        ring: this.fxRing,
        puff: this.fxPuff,
        glowMat: this.glowMaterial,
        litMat: this.litMaterial,
        flashMat: this.flashMaterial
      },
      this.camera
    )
    this.city = new CityHealthManager(this.cityRoot, this.fx)
    this.spawner = new EnemySpawner(this.ufoPrefab, this.ufoParent, this.flashMaterial, this.city)
    this.audio = new AudioManager(
      this.getSceneObject(),
      {
        punch: this.sfxPunch,
        explode: this.sfxExplode,
        zap: this.sfxZap,
        spawn: this.sfxSpawn,
        button: this.sfxButton,
        countdown: this.sfxCountdown,
        start: this.sfxStart,
        win: this.sfxWin,
        lose: this.sfxLose
      },
      this.sfxAmbient ?? null
    )
    this.score = new ScoreManager()
    this.combo = new ComboManager()
    this.ui = new UIManager(this.hudRoot, {
      panelMesh: this.uiPanel,
      frameMesh: this.uiFrame,
      barMesh: this.uiBar,
      panelMat: this.panelMaterial,
      glowMat: this.glowMaterial,
      flashMat: this.flashMaterial
    })

    this.hands = [
      new KaijuHandController("left", this.leftClaw, this.camera, this.flashMaterial, allowSim),
      new KaijuHandController("right", this.rightClaw, this.camera, this.flashMaterial, allowSim)
    ]
    if (this.syntheticHandTest && isEditor) {
      this.synth = new SyntheticHandDriver(this.camTr, () => this.spawner.ufos)
      this.hands[0].addSource(this.synth.left)
      this.hands[1].addSource(this.synth.right)
    }
    this.placer = new SurfacePlacer(this.worldQueryModule)
    this.damageFx = new DamageIndicator(this.camera, this.uiPanel, this.flashMaterial)
    this.punch = new PunchDetector(this.hands)
    this.punch.extraTargets = this.ui.buttons
    const camComp = this.camera.getComponent("Component.Camera") as Camera
    this.input = new InputManager(this, camComp, this.hands, () => this.spawner.ufos)
    this.input.buttons = this.ui.buttons

    // wiring
    this.score.onScoreChanged = (s, d) => this.ui.setScore(s, d)
    this.combo.onComboChanged = (c, m) => this.ui.setCombo(c, m)
    this.city.onHealthChanged = (h) => this.ui.setHealth(h / this.city.maxHealth)
    this.spawner.onZap = (u) => this.onUfoZap(u)
    this.spawner.onSpawn = () => this.audio.play("spawn", 0.35, 0.6)
    this.punch.onPunch = (e) => this.onPunch(e)
    this.progression = new ProgressionManager()
    this.ui.startButton.onPress = (src) => this.requestStart(src)
    this.ui.restartButton.onPress = (src) => this.requestStart(src)
    this.ui.menuButton.onPress = (src) => this.goToMenu(src)
    for (const id of UPGRADE_ORDER) this.ui.upgradeButtons[id].onPress = (src) => this.buyUpgrade(id, src)
    this.input.onStartKey = () => this.requestStart("key")
    this.input.onRestartKey = () => this.requestStart("key")
    this.input.onMenuKey = () => this.goToMenu("key")
    this.input.onUpgradeKey = (i) => this.buyUpgrade(UPGRADE_ORDER[i], "key")
    this.refreshShop()

    this.gameRoot.enabled = false
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
    this.log("Kaiju Rampage ready. editor=" + isEditor + " previewSimulation=" + allowSim)
  }

  // ------------------------------------------------------------------ flow
  private requestStart(source: string): void {
    if (this.state === GameState.Title || this.state === GameState.Result) {
      this.log("START requested via " + source)
      this.audio.play("button", 0.9)
      this.beginCountdown()
    }
  }

  private goToMenu(source: string): void {
    if (this.state !== GameState.Result) return
    this.log("MENU via " + source)
    this.audio.play("button", 0.7)
    this.fx.stopAll()
    this.city.reset()
    this.refreshShop()
    this.ui.showTitle()
    this.setState(GameState.Title)
  }

  /** Upgrades are bought on the main menu (brief, done criterion 7). */
  private buyUpgrade(id: UpgradeId, source: string): void {
    if (this.state !== GameState.Title) return
    const cost = this.progression.cost(id)
    if (this.progression.buy(id)) {
      this.audio.play("button", 1)
      this.log("UPGRADE " + id + " -> Lv" + this.progression.levels[id] + " (spent " + cost + ", coins left " + this.progression.coins + ") via " + source)
    } else {
      this.audio.play("countdown", 0.5)
      this.log("UPGRADE " + id + " refused: coins=" + this.progression.coins + " cost=" + cost + " via " + source)
    }
    this.refreshShop()
  }

  private refreshShop(): void {
    const p = this.progression
    this.ui.setShop(
      p.coins,
      this.score.best,
      UPGRADE_ORDER.map((id) => ({
        id,
        label: UPGRADES[id].label,
        level: p.levels[id],
        maxLevel: ProgressionConfig.maxLevel,
        cost: p.cost(id),
        affordable: p.canBuy(id)
      }))
    )
  }

  private beginCountdown(): void {
    this.placeInFrontOfUser()
    // apply purchased upgrades for this round
    this.city.maxHp = this.progression.cityMaxHealth
    this.punch.damageBonus = this.progression.damageBonus
    this.roundBonusCoins = 0
    this.damageFx.clear()
    this.fx.stopAll()
    this.spawner.clear()
    this.city.reset()
    this.score.reset()
    this.combo.reset()
    this.ui.setTime(KaijuConfig.roundDuration)
    this.ui.setHealth(1)
    this.lastCountdown = -1
    this.setState(GameState.Countdown)
  }

  private beginPlaying(): void {
    this.elapsed = 0
    this.audio.play("start", 0.8)
    this.audio.setAmbient(true)
    this.spawner.start()
    this.setState(GameState.Playing)
    this.ui.showPlaying()
  }

  private endRound(won: boolean): void {
    this.spawner.stop()
    this.audio.setAmbient(false)
    this.audio.play(won ? "win" : "lose", 1)
    for (const u of this.spawner.alive()) {
      this.fx.ufoExplosion(u.worldCenter)
      u.deactivate()
    }
    if (won) {
      this.score.addSurvivalBonus(this.city.health)
      this.fx.startFireworks(this.cityRoot.getTransform().getWorldPosition(), 14)
    } else {
      this.city.collapseAll()
      const c = this.cityRoot.getTransform().getWorldPosition()
      for (let i = 0; i < 4; i++) this.fx.cityDamage(c.add(new vec3(Math.random() * 20 - 10, 4 + Math.random() * 8, Math.random() * 20 - 10)))
    }
    const newBest = this.score.commitBest()
    // coins for every round, won or lost (brief)
    const earned = this.progression.awardRound(this.score.kills, this.roundBonusCoins)
    this.ui.showResult(
      won,
      this.score.score,
      this.score.best,
      newBest,
      this.score.kills,
      this.combo.bestCombo,
      (100 * this.city.health) / this.city.maxHealth,
      earned,
      this.progression.coins
    )
    this.refreshShop()
    this.setState(GameState.Result)
    this.log(
      "ROUND OVER won=" +
        won +
        " score=" +
        this.score.score +
        " kills=" +
        this.score.kills +
        " hits=" +
        this.score.hits +
        " city=" +
        this.city.health +
        " spawned=" +
        this.spawner.totalSpawned +
        " bestCombo=" +
        this.combo.bestCombo +
        " coinsEarned=" +
        earned +
        " coinsTotal=" +
        this.progression.coins +
        " upgrades=" +
        JSON.stringify(this.progression.levels) +
        " cityMax=" +
        this.city.maxHealth +
        " handDiag=" +
        this.hands.map((h) => h.side + "{reacquire:" + h.reacquires + ",teleportRejected:" + h.teleportsRejected + "}").join(",")
    )
  }

  private setState(s: GameState): void {
    this.state = s
    this.stateT = 0
    this.log("state -> " + GameState[s])
  }

  // ------------------------------------------------------------------ events
  private onPunch(e: PunchEvent): void {
    if (this.state !== GameState.Playing) return
    const killed = e.ufo.applyHit(e.damage, e.dir, this.punch.now)
    this.combo.registerHit()
    const mult = this.combo.multiplier
    e.hand.onImpact()
    this.audio.play(killed ? "explode" : "punch", killed ? 1 : 0.8)
    if (killed) {
      const pts = this.score.addKill(mult)
      this.fx.ufoExplosion(e.point)
      const bonus = this.progression.rollBonus()
      if (bonus > 0) {
        this.roundBonusCoins += bonus
        this.fx.scorePopup(e.point.add(new vec3(0, 6, 0)), "+" + pts + "  +" + bonus + " COINS", new vec4(1, 0.85, 0.25, 1), 1.3)
      } else {
        this.fx.scorePopup(e.point.add(new vec3(0, 6, 0)), "+" + pts, new vec4(0.5, 1, 0.4, 1), mult > 1 ? 1.3 : 1)
      }
    } else {
      const pts = this.score.addHit(mult)
      this.fx.punchImpact(e.point, e.power)
      this.fx.scorePopup(e.point.add(new vec3(0, 6, 0)), "+" + pts, new vec4(1, 1, 1, 1), 0.8)
    }
    this.log(
      "PUNCH " +
        e.hand.side +
        "(" +
        e.hand.source +
        ") dmg=" +
        e.damage +
        " killed=" +
        killed +
        " speed=" +
        Math.round(e.hand.speed) +
        " combo=" +
        this.combo.combo +
        " score=" +
        this.score.score
    )
  }

  private onUfoZap(u: UFOController): void {
    if (this.state !== GameState.Playing || !u.target) return
    const hitPos = this.gameRoot.getTransform().getWorldTransform().multiplyPoint(u.target.localTop)
    this.city.applyZap(u.target, hitPos)
    this.combo.breakCombo()
    this.audio.play("zap", 0.9)
    this.damageFx.flash(u.worldCenter)
    this.fx.ufoExplosion(u.worldCenter)
    this.fx.scorePopup(hitPos.add(new vec3(0, 4, 0)), "ZAP!", new vec4(1, 0.35, 0.35, 1), 1)
    this.log("ZAP " + u.target.kind + " city=" + this.city.health)
  }

  // ------------------------------------------------------------------ frame
  private onUpdate(): void {
    const rawDt = getDeltaTime()
    const dt = Math.min(rawDt, 0.05) // gameplay step (clamped so a hitch can't teleport UFOs)
    this.stateT += dt

    if (!this.placed) {
      this.placeDelay -= dt
      if (this.placeDelay <= 0) {
        this.placeInFrontOfUser()
        if (this.state === GameState.Title) {
          this.refreshShop()
          this.ui.showTitle()
        }
      }
    }

    if (this.state === GameState.Title || this.state === GameState.Result) this.placer.update(dt, this.camTr)
    // hands use the real frame time: velocity must reflect physical motion even on a slow frame
    if (this.synth) this.synth.update(rawDt, this.state === GameState.Playing)
    for (const h of this.hands) h.update(rawDt)
    this.ui.setModeLabel(this.modeLabel())

    switch (this.state) {
      case GameState.Countdown: {
        const labels = ["3", "2", "1", "SMASH!"]
        const i = Math.min(3, Math.floor(this.stateT / 0.75))
        if (i !== this.lastCountdown) {
          this.lastCountdown = i
          this.audio.play("countdown", i === 3 ? 1 : 0.7)
        }
        this.ui.showCountdown(labels[i])
        if (this.stateT >= 3.1) this.beginPlaying()
        break
      }
      case GameState.Playing: {
        this.elapsed += dt
        const remaining = KaijuConfig.roundDuration - this.elapsed
        this.ui.setTime(remaining)
        this.spawner.update(dt, this.elapsed)
        this.punch.update(dt, this.spawner.ufos)
        this.combo.update(dt)
        if (this.city.isDestroyed) this.endRound(false)
        else if (remaining <= 0) this.endRound(true)
        this.statsT -= dt
        if (this.statsT <= 0) {
          this.statsT = 5
          const w = waveAt(this.elapsed)
          this.log(
            "t=" +
              this.elapsed.toFixed(1) +
              " wave@" +
              w.from +
              " alive=" +
              this.spawner.aliveCount +
              " spawned=" +
              this.spawner.totalSpawned +
              " score=" +
              this.score.score +
              " city=" +
              this.city.health +
              " fx=" +
              this.fx.activeCount() +
              " input=" +
              this.hands.map((h) => h.side + ":" + h.source).join(",") +
              " ufos=" +
              this.input.ufoScreenPositions()
          )
        }
        break
      }
      default:
        // buttons can be punched on the title/result screens
        this.punch.update(dt, [])
        break
    }
    this.city.update(dt)
    this.fx.update(dt)
    this.damageFx.update(dt)
    this.audio.update(dt)
    this.ui.update(dt)
  }

  private modeLabel(): string {
    if (this.hands.some((h) => h.source === "tracked")) return "INPUT: SPECTACLES HAND TRACKING"
    if (this.hands.some((h) => h.source === "synthetic")) return "INPUT: SYNTHETIC HAND TEST (scripted skeleton, not real tracking)"
    if (this.hands.some((h) => h.source === "simulated")) return "INPUT: PREVIEW SIMULATION  (click a UFO / SPACE = punch)"
    return "INPUT: show your hands to the glasses"
  }

  private placeInFrontOfUser(): void {
    const p = this.placer.choose(this.camTr)
    const rt = this.gameRoot.getTransform()
    rt.setWorldPosition(p.position)
    // GameRoot +Z points back toward the player; -Z is "away"
    rt.setWorldRotation(quat.lookAt(p.forward.uniformScale(-1), vec3.up()))
    // keep the HUD at the same height relative to the eyes, whatever the surface height
    this.hudRoot.getTransform().setLocalPosition(new vec3(0, p.drop - KaijuConfig.cityDown, 0))
    const camPos = this.camTr.getWorldPosition()
    KaijuRuntime.eyeY = p.drop
    KaijuRuntime.playerZ = new vec3(camPos.x - p.position.x, 0, camPos.z - p.position.z).length
    // placement can be triggered by START before the initial delay elapsed – always reveal the world
    this.gameRoot.enabled = true
    this.placed = true
    this.log(
      "GameRoot placed " +
        (p.onSurface ? "ON SURFACE" : "floating (head-relative)") +
        " at " +
        p.position.toString() +
        " drop=" +
        p.drop.toFixed(1) +
        "cm worldQuery=" +
        this.placer.available
    )
  }

  private log(msg: string): void {
    if (this.debugLogs) print("[Kaiju] " + msg)
  }
}
