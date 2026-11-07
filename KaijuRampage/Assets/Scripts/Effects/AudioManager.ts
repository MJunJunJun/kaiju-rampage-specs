/**
 * Tiny pooled SFX player. A handful of AudioComponents are created once and
 * reused round-robin so overlapping punches/explosions do not cut each other off.
 * Every track is optional – missing inputs simply play nothing.
 */
export type Sfx = "punch" | "explode" | "zap" | "spawn" | "button" | "countdown" | "start" | "win" | "lose"

export class AudioManager {
  private voices: AudioComponent[] = []
  private next = 0
  private ambient: AudioComponent | null = null
  private lastPlay: {[k: string]: number} = {}
  private t = 0

  constructor(
    root: SceneObject,
    private tracks: {[k in Sfx]?: AudioTrackAsset},
    ambientTrack: AudioTrackAsset | null,
    voiceCount: number = 6
  ) {
    for (let i = 0; i < voiceCount; i++) {
      const o = global.scene.createSceneObject("SFX_Voice_" + i)
      o.setParent(root)
      this.voices.push(o.createComponent("Component.AudioComponent") as AudioComponent)
    }
    if (ambientTrack) {
      const o = global.scene.createSceneObject("SFX_Ambient")
      o.setParent(root)
      this.ambient = o.createComponent("Component.AudioComponent") as AudioComponent
      this.ambient.audioTrack = ambientTrack
      this.ambient.volume = 0.25
    }
  }

  update(dt: number): void {
    this.t += dt
  }

  play(name: Sfx, volume: number = 1, minGap: number = 0.05): void {
    const track = this.tracks[name]
    if (!track) return
    // throttle identical sounds stacking on the same frame
    if (this.t - (this.lastPlay[name] ?? -10) < minGap) return
    this.lastPlay[name] = this.t
    const v = this.voices[this.next]
    this.next = (this.next + 1) % this.voices.length
    try {
      if (v.isPlaying()) v.stop(false)
      v.audioTrack = track
      v.volume = volume
      v.play(1)
    } catch (e) {
      print("[Kaiju] audio play failed: " + e)
    }
  }

  setAmbient(on: boolean): void {
    if (!this.ambient) return
    try {
      if (on && !this.ambient.isPlaying()) this.ambient.play(-1)
      if (!on && this.ambient.isPlaying()) this.ambient.stop(true)
    } catch (e) {
      print("[Kaiju] ambient audio failed: " + e)
    }
  }
}
