import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {KaijuConfig} from "../Core/KaijuConfig"
import {clamp, colorMaterial, easeOutBack, makeMeshObject} from "../Core/MathUtil"
import {KaijuHandController} from "../Input/KaijuHandController"
import {ScreenButton} from "../Input/InputManager"
import {PunchTarget} from "../Input/PunchDetector"

export interface UIAssets {
  panelMesh: RenderMesh
  frameMesh: RenderMesh
  barMesh: RenderMesh
  panelMat: Material
  glowMat: Material
  flashMat: Material
}

/** World-space text size multiplier (Text.size is in points; tuned for ~85cm viewing distance). */
const TEXT_SIZE = 1.0
/** Title/result panels are authored at 44x28cm and shown at this scale. */
const PANEL_SCALE = 0.72

/**
 * A holographic button that works with every input we have:
 * SIK pinch/poke (Spectacles), SIK mouse click (Preview), a claw punch
 * (PunchDetector extra target), a tap ray pick and the keyboard.
 */
export class HoloButton implements ScreenButton, PunchTarget {
  readonly obj: SceneObject
  readonly radius: number
  private tr: Transform
  private bg: RenderMeshVisual
  private bgMat: Material
  private hotMat: Material
  private dimMat: Material
  private label: Text
  private available = true
  private pressT = 0
  private pendingT = -1
  private pendingSource = ""
  private lastPress = -10
  private t = 0
  onPress: (source: string) => void = () => {}

  constructor(
    parent: SceneObject,
    name: string,
    label: string,
    pos: vec3,
    w: number,
    h: number,
    assets: UIAssets,
    makeText: TextFactory,
    labelSize: number = 64
  ) {
    this.obj = global.scene.createSceneObject(name)
    this.obj.setParent(parent)
    this.tr = this.obj.getTransform()
    this.tr.setLocalPosition(pos)
    this.radius = Math.max(w, h) * 0.5
    this.bgMat = colorMaterial(assets.flashMat, 0.04, 0.42, 0.46)
    this.hotMat = colorMaterial(assets.flashMat, 0.3, 1.0, 0.95)
    this.dimMat = colorMaterial(assets.flashMat, 0.1, 0.14, 0.18)
    const bg = makeMeshObject("BG", this.obj, assets.panelMesh, this.bgMat)
    bg.getTransform().setLocalScale(new vec3(w, h, 1))
    this.bg = bg.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    const fr = makeMeshObject("Frame", this.obj, assets.frameMesh, assets.glowMat)
    fr.getTransform().setLocalScale(new vec3(w + 0.6, h + 0.6, 1))
    fr.getTransform().setLocalPosition(new vec3(0, 0, 0.05))
    this.label = makeText(this.obj, "Label", label, new vec3(0, 0, 0.3), labelSize, new vec4(1, 1, 1, 1))

    // SIK: collider + Interactable so pinch / poke / mouse can press it.
    try {
      const col = this.obj.createComponent("Physics.ColliderComponent") as ColliderComponent
      const shape = Shape.createBoxShape()
      shape.size = new vec3(w, h, 3)
      col.shape = shape
      const inter = this.obj.createComponent(Interactable.getTypeName()) as Interactable
      // fire on release (pinch/poke up), the standard Specs button behaviour
      inter.onTriggerEnd.add(() => this.press("sik"))
    } catch (e) {
      print("[Kaiju] SIK button setup failed for " + name + ": " + e)
    }
  }

  setLabel(txt: string): void {
    this.label.text = txt
  }

  /** Dimmed when the player can't afford / use it (it still receives presses). */
  setAvailable(on: boolean): void {
    this.available = on
    this.label.textFill.color = on ? new vec4(1, 1, 1, 1) : new vec4(0.72, 0.78, 0.82, 1)
  }

  get visible(): boolean {
    return this.obj.enabled && this.obj.isEnabledInHierarchy
  }

  center(): vec3 {
    return this.tr.getWorldPosition()
  }

  enabled(): boolean {
    return this.visible
  }

  onPunched(_hand: KaijuHandController, _dir: vec3): void {
    this.press("punch")
  }

  press(source: string): void {
    if (!this.visible) return
    if (this.t - this.lastPress < 0.6) return
    this.lastPress = this.t
    this.pressT = 0.25
    // let the press pop play (and a pinch release finish) before the screen changes
    this.pendingT = 0.3
    this.pendingSource = source
  }

  update(dt: number): void {
    this.t += dt
    if (this.pendingT >= 0) {
      this.pendingT -= dt
      if (this.pendingT < 0) this.onPress(this.pendingSource)
    }
    this.pressT = Math.max(0, this.pressT - dt)
    const idle = 1 + Math.sin(this.t * 3.2) * 0.025
    const pop = this.pressT > 0 ? 1 + 0.15 * Math.sin((1 - this.pressT / 0.25) * Math.PI) : 1
    const s = idle * pop
    this.tr.setLocalScale(new vec3(s, s, s))
    this.bg.mainMaterial = this.pressT > 0 ? this.hotMat : this.available ? this.bgMat : this.dimMat
  }
}

function v3(a: number[]): vec3 {
  return new vec3(a[0], a[1], a[2])
}

type TextFactory = (parent: SceneObject, name: string, txt: string, pos: vec3, size: number, color: vec4) => Text

export interface ShopEntry {
  id: string
  label: string
  level: number
  maxLevel: number
  cost: number // -1 = maxed
  affordable: boolean
}

export class UIManager {
  readonly startButton: HoloButton
  readonly restartButton: HoloButton
  readonly menuButton: HoloButton
  readonly upgradeButtons: {[id: string]: HoloButton} = {}
  private hudBar: SceneObject
  private titlePanel: SceneObject
  private resultPanel: SceneObject
  private countdownObj: SceneObject
  private scoreText: Text
  private timerText: Text
  private comboText: Text
  private modeText: Text
  private countdownText: Text
  private resultTitle: Text
  private resultBody: Text
  private bestText: Text
  private healthFill: Transform
  private healthFillVisual: RenderMeshVisual
  private healthMats: Material[]
  private comboTr: Transform
  private scoreTr: Transform
  private t = 0
  private comboPop = 0
  private scorePop = 0
  private countdownPop = 0
  private healthShown = 1
  private healthTarget = 1
  private lowTime = false
  private panelPop = 1

  constructor(
    private root: SceneObject,
    private assets: UIAssets
  ) {
    const mk: TextFactory = (p, n, s, pos, size, color) => this.makeText(p, n, s, pos, size, color)

    // ------------------------------------------------ in-game HUD bar
    this.hudBar = this.child(root, "HUDBar", v3(KaijuConfig.hudBarPos))
    this.hudBar.getTransform().setLocalRotation(quat.fromEulerAngles(0, KaijuConfig.hudBarYaw * (Math.PI / 180), 0))
    const hs = KaijuConfig.hudBarScale
    this.hudBar.getTransform().setLocalScale(new vec3(hs, hs, hs))
    this.panel(this.hudBar, new vec3(0, 0, -0.3), 44, 11)
    this.scoreTr = this.child(this.hudBar, "ScoreGroup", new vec3(-14, 0, 0)).getTransform()
    mk(this.scoreTr.getSceneObject(), "ScoreLabel", "SCORE", new vec3(0, 2.9, 0), 32, new vec4(0.55, 0.95, 1, 1))
    this.scoreText = mk(this.scoreTr.getSceneObject(), "Score", "0", new vec3(0, -1.4, 0), 78, new vec4(1, 1, 1, 1))
    mk(this.hudBar, "TimeLabel", "TIME", new vec3(0, 2.9, 0), 32, new vec4(0.55, 0.95, 1, 1))
    this.timerText = mk(this.hudBar, "Timer", "60", new vec3(0, -1.4, 0), 88, new vec4(1, 1, 1, 1))
    mk(this.hudBar, "CityLabel", "CITY", new vec3(14, 2.9, 0), 32, new vec4(0.55, 0.95, 1, 1))
    const barBg = makeMeshObject("HealthBG", this.hudBar, assets.barMesh, colorMaterial(assets.flashMat, 0.06, 0.12, 0.16))
    barBg.getTransform().setLocalPosition(new vec3(8.5, -1.4, 0))
    barBg.getTransform().setLocalScale(new vec3(11, 3.2, 1))
    this.healthMats = [
      colorMaterial(assets.flashMat, 0.3, 1.0, 0.45),
      colorMaterial(assets.flashMat, 1.0, 0.85, 0.2),
      colorMaterial(assets.flashMat, 1.0, 0.25, 0.3)
    ]
    const fill = makeMeshObject("HealthFill", this.hudBar, assets.barMesh, this.healthMats[0])
    this.healthFill = fill.getTransform()
    this.healthFill.setLocalPosition(new vec3(8.8, -1.4, 0.1))
    this.healthFill.setLocalScale(new vec3(10.4, 2.6, 1))
    this.healthFillVisual = fill.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    const comboObj = this.child(this.hudBar, "ComboGroup", new vec3(0, -8.6, 0))
    this.comboTr = comboObj.getTransform()
    this.comboText = mk(comboObj, "Combo", "", new vec3(0, 0, 0), 66, new vec4(1, 0.85, 0.25, 1))
    this.modeText = mk(this.hudBar, "Mode", "", new vec3(0, 7.2, 0), 26, new vec4(0.6, 0.8, 0.85, 0.9))

    // ------------------------------------------------ title panel
    this.titlePanel = this.child(root, "TitlePanel", v3(KaijuConfig.panelPos))
    this.panel(this.titlePanel, new vec3(0, -1, -0.3), 40, 40)
    mk(this.titlePanel, "Title", "KAIJU RAMPAGE", new vec3(0, 14.6, 0), 112, new vec4(0.35, 1, 0.9, 1))
    mk(this.titlePanel, "Subtitle", "ALIEN INVASION", new vec3(0, 10.2, 0), 52, new vec4(0.85, 0.6, 1, 1))
    mk(this.titlePanel, "HowTo", "PUNCH the UFOs. Protect the city for 60 seconds!", new vec3(0, 6.4, 0), 34, new vec4(0.92, 0.97, 1, 1))
    this.bestText = mk(this.titlePanel, "Best", "", new vec3(0, 2.6, 0), 38, new vec4(1, 0.85, 0.3, 1))
    mk(this.titlePanel, "ShopLabel", "UPGRADES", new vec3(0, -1.2, 0), 28, new vec4(0.55, 0.95, 1, 1))
    const ids = ["attack", "health", "bonus"]
    for (let i = 0; i < ids.length; i++) {
      this.upgradeButtons[ids[i]] = new HoloButton(
        this.titlePanel,
        "Upgrade_" + ids[i],
        ids[i].toUpperCase(),
        new vec3((i - 1) * 12.6, -6.4, 1),
        11.6,
        7.2,
        assets,
        mk,
        38
      )
    }
    this.startButton = new HoloButton(this.titlePanel, "StartButton", "START", new vec3(0, -15, 1), 18, 5.5, assets, mk)

    // ------------------------------------------------ result panel
    this.resultPanel = this.child(root, "ResultPanel", v3(KaijuConfig.panelPos))
    this.panel(this.resultPanel, new vec3(0, 0, -0.3), 44, 30)
    this.resultTitle = mk(this.resultPanel, "ResultTitle", "CITY SAVED!", new vec3(0, 10, 0), 100, new vec4(0.4, 1, 0.5, 1))
    this.resultBody = mk(this.resultPanel, "ResultBody", "", new vec3(0, 1.4, 0), 40, new vec4(1, 1, 1, 1))
    this.restartButton = new HoloButton(this.resultPanel, "RestartButton", "RESTART", new vec3(-8, -10, 1), 17, 5.5, assets, mk)
    this.menuButton = new HoloButton(this.resultPanel, "MenuButton", "MENU", new vec3(10, -10, 1), 13, 5.5, assets, mk)

    // ------------------------------------------------ countdown
    this.countdownObj = this.child(root, "Countdown", v3(KaijuConfig.countdownPos))
    this.countdownText = mk(this.countdownObj, "CountdownText", "3", new vec3(0, 0, 0), 190, new vec4(1, 1, 1, 1))

    this.titlePanel.getTransform().setLocalScale(new vec3(PANEL_SCALE, PANEL_SCALE, PANEL_SCALE))
    this.resultPanel.getTransform().setLocalScale(new vec3(PANEL_SCALE, PANEL_SCALE, PANEL_SCALE))
    this.showTitle()
  }

  get buttons(): HoloButton[] {
    const ups = Object.keys(this.upgradeButtons).map((k) => this.upgradeButtons[k])
    return [this.startButton, this.restartButton, this.menuButton].concat(ups)
  }

  /** Main-menu shop: coin balance + one button per upgrade (level and next cost). */
  setShop(coins: number, best: number, entries: ShopEntry[]): void {
    this.bestText.text = "BEST  " + best + "        COINS  " + coins
    for (const e of entries) {
      const b = this.upgradeButtons[e.id]
      if (!b) continue
      b.setLabel(e.label + "\nLv " + e.level + "/" + e.maxLevel + "\n" + (e.cost < 0 ? "MAX" : e.cost + " coins"))
      b.setAvailable(e.affordable)
    }
  }

  // ------------------------------------------------------------------ states
  showTitle(): void {
    if (!this.titlePanel.enabled) this.panelPop = 0
    this.titlePanel.enabled = true
    this.resultPanel.enabled = false
    this.hudBar.enabled = false
    this.countdownObj.enabled = false
  }

  showCountdown(label: string): void {
    this.titlePanel.enabled = false
    this.resultPanel.enabled = false
    this.hudBar.enabled = true
    this.countdownObj.enabled = true
    if (this.countdownText.text !== label) {
      this.countdownText.text = label
      this.countdownPop = 0
    }
  }

  showPlaying(): void {
    this.titlePanel.enabled = false
    this.resultPanel.enabled = false
    this.hudBar.enabled = true
    this.countdownObj.enabled = false
  }

  showResult(
    won: boolean,
    score: number,
    best: number,
    newBest: boolean,
    kills: number,
    bestCombo: number,
    health: number,
    coinsEarned: number,
    coins: number
  ): void {
    this.titlePanel.enabled = false
    this.hudBar.enabled = false
    this.countdownObj.enabled = false
    this.panelPop = 0
    this.resultPanel.enabled = true
    this.resultTitle.text = won ? "CITY SAVED!" : "CITY DESTROYED"
    this.resultTitle.textFill.color = won ? new vec4(0.4, 1, 0.55, 1) : new vec4(1, 0.35, 0.4, 1)
    this.resultBody.text =
      "SCORE  " +
      score +
      (newBest ? "   NEW BEST!" : "   (best " + best + ")") +
      "\nUFOs SMASHED  " +
      kills +
      "     BEST COMBO  x" +
      bestCombo +
      "\nCITY HEALTH  " +
      Math.round(health) +
      "%" +
      "\nCOINS  +" +
      coinsEarned +
      "   (total " +
      coins +
      ")"
  }

  // ------------------------------------------------------------------ values
  setScore(score: number, delta: number): void {
    this.scoreText.text = "" + score
    if (delta > 0) this.scorePop = 0.2
  }

  setTime(seconds: number): void {
    const s = Math.max(0, Math.ceil(seconds))
    this.timerText.text = "" + s
    this.lowTime = s <= 10
  }

  setHealth(frac: number): void {
    this.healthTarget = clamp(frac, 0, 1)
  }

  setCombo(combo: number, multiplier: number): void {
    if (combo >= 2) {
      this.comboText.text = combo + " HIT COMBO" + (multiplier > 1 ? "   x" + multiplier : "")
      this.comboPop = 0.22
    } else {
      this.comboText.text = ""
    }
  }

  setModeLabel(label: string): void {
    this.modeText.text = label
  }

  update(dt: number): void {
    this.t += dt
    // tick EVERY button (press animation + the delayed onPress fire)
    for (const b of this.buttons) b.update(dt)
    // health bar easing + color
    this.healthShown += (this.healthTarget - this.healthShown) * Math.min(1, dt * 6)
    this.healthFill.setLocalScale(new vec3(Math.max(0.001, 10.4 * this.healthShown), 2.6, 1))
    this.healthFillVisual.mainMaterial =
      this.healthShown > 0.55 ? this.healthMats[0] : this.healthShown > 0.28 ? this.healthMats[1] : this.healthMats[2]
    // pops
    this.comboPop = Math.max(0, this.comboPop - dt)
    const cs = this.comboPop > 0 ? 1 + 0.35 * Math.sin((1 - this.comboPop / 0.22) * Math.PI) : 1
    this.comboTr.setLocalScale(new vec3(cs, cs, cs))
    this.scorePop = Math.max(0, this.scorePop - dt)
    const ss = this.scorePop > 0 ? 1 + 0.2 * Math.sin((1 - this.scorePop / 0.2) * Math.PI) : 1
    this.scoreTr.setLocalScale(new vec3(ss, ss, ss))
    this.timerText.textFill.color = this.lowTime && Math.sin(this.t * 10) > 0 ? new vec4(1, 0.35, 0.35, 1) : new vec4(1, 1, 1, 1)
    if (this.panelPop < 1) {
      this.panelPop = Math.min(1, this.panelPop + dt * 2.8)
      const k = easeOutBack(this.panelPop) * PANEL_SCALE
      const target = this.titlePanel.enabled ? this.titlePanel : this.resultPanel
      target.getTransform().setLocalScale(new vec3(k, k, k))
    }
    if (this.countdownObj.enabled) {
      this.countdownPop = Math.min(1, this.countdownPop + dt * 3)
      const k = easeOutBack(this.countdownPop)
      this.countdownObj.getTransform().setLocalScale(new vec3(k, k, k))
    }
  }

  // ------------------------------------------------------------------ builders
  private child(parent: SceneObject, name: string, pos: vec3): SceneObject {
    const o = global.scene.createSceneObject(name)
    o.setParent(parent)
    o.getTransform().setLocalPosition(pos)
    return o
  }

  private panel(parent: SceneObject, pos: vec3, w: number, h: number): void {
    const bg = makeMeshObject("PanelBG", parent, this.assets.panelMesh, this.assets.panelMat)
    bg.getTransform().setLocalPosition(pos)
    bg.getTransform().setLocalScale(new vec3(w, h, 1))
    const fr = makeMeshObject("PanelFrame", parent, this.assets.frameMesh, this.assets.glowMat)
    fr.getTransform().setLocalPosition(pos.add(new vec3(0, 0, 0.05)))
    fr.getTransform().setLocalScale(new vec3(w, h, 1))
  }

  private makeText(parent: SceneObject, name: string, txt: string, pos: vec3, size: number, color: vec4): Text {
    const o = global.scene.createSceneObject(name)
    o.setParent(parent)
    o.getTransform().setLocalPosition(pos)
    const t = o.createComponent("Component.Text") as Text
    t.text = txt
    t.size = Math.round(size * TEXT_SIZE)
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-30, 30, -6, 6)
    t.textFill.color = color
    t.dropshadowSettings.enabled = true
    t.dropshadowSettings.fill.color = new vec4(0, 0, 0, 0.55)
    t.dropshadowSettings.offset = new vec2(0.05, -0.05)
    return t
  }
}
