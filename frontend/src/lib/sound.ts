/**
 * Sound design for DataLens AI — optional, muted by default.
 * Uses Web Audio API — no dependencies.
 *
 * Events: keyboard click, pop, chime, thud, paper rustle, ambient hum.
 */

let audioCtx: AudioContext | null = null
let _muted = true

function getCtx(): AudioContext | null {
  if (_muted) return null
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext()
    } catch {
      return null
    }
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume()
  }
  return audioCtx
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.1,
  delay = 0,
) {
  const ctx = getCtx()
  if (!ctx) return

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(frequency, ctx.currentTime + delay)
  gain.gain.setValueAtTime(volume, ctx.currentTime + delay)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration)

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(ctx.currentTime + delay)
  osc.stop(ctx.currentTime + delay + duration)
}

function playNoise(duration: number, volume = 0.05) {
  const ctx = getCtx()
  if (!ctx) return

  const bufferSize = ctx.sampleRate * duration
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3)
  }

  const source = ctx.createBufferSource()
  source.buffer = buffer

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

  source.connect(gain)
  gain.connect(ctx.destination)
  source.start()
}

export const Sound = {
  get muted() { return _muted },
  set muted(v: boolean) { _muted = v },

  /** Mechanical keyboard click per character */
  keyClick() {
    playTone(800 + Math.random() * 400, 0.03, "square", 0.02)
  },

  /** Soft pop on tool completion */
  pop() {
    playTone(600, 0.08, "sine", 0.08)
    playTone(900, 0.06, "sine", 0.05, 0.02)
  },

  /** Rising chime on big insight */
  chime() {
    playTone(523, 0.3, "sine", 0.1)
    playTone(659, 0.3, "sine", 0.08, 0.15)
    playTone(784, 0.4, "sine", 0.06, 0.3)
  },

  /** Low thud on error */
  thud() {
    playTone(80, 0.3, "sine", 0.15)
    playNoise(0.2, 0.04)
  },

  /** Subtle paper rustle on file upload */
  paperRustle() {
    playNoise(0.4, 0.03)
  },

  /** Very low ambient hum while agent thinks */
  startHum() {
    const ctx = getCtx()
    if (!ctx || _muted) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(55, ctx.currentTime)
    gain.gain.setValueAtTime(0.02, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.02, ctx.currentTime + 0.5)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    ;(osc as unknown as { _hum?: boolean })._hum = true
    return () => {
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3)
      osc.stop(ctx.currentTime + 0.5)
    }
  },

  toggle() {
    _muted = !_muted
    if (!_muted) {
      getCtx()
    }
    return _muted
  },
}
