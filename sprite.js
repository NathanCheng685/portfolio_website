// Two drawings of the same character share frame indices 0 to 18:
// assets/nathan-illustrated.svg (default, scripts/build_illustration.py) and
// assets/nathan-sprite.svg (pixel fallback, scripts/build_sprite.py).
// The illustrated run cycle has 8 frames; its second half sits at 19 to 22.
export const art = { current: "illustrated" };
const WALK = { pixel: [4, 5, 6, 7], illustrated: [4, 5, 6, 7, 19, 20, 21, 22] };
const STRIDE = { pixel: 30, illustrated: 16 }; // pixels of travel per walk frame

export const F = {
  stand: 0, blink: 1, waveA: 2, waveB: 3,
  get walk() { return WALK[art.current]; },
  get stride() { return STRIDE[art.current]; },
  phoneA: 8, phoneB: 9,
  grip: 10, gripStepA: 11, gripStepB: 12,
  panA: 13, panB: 14,
  lookA: 15, lookB: 16,
  think: 17, thumbs: 18,
};

export const motion = {
  reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
};

// One Nathan. Animation is stop-motion: whole frames on a timer, no tweening.
export class Actor {
  constructor(element) {
    this.element = element;
    this.rest = F.stand;
    this.timer = 0;
    this.blinkTimer = 0;
    this.set(F.stand);
  }

  set(frame) {
    this.element.style.setProperty("--f", frame);
  }

  face(direction) {
    this.element.classList.toggle("is-left", direction < 0);
  }

  stop() {
    clearTimeout(this.timer);
    clearTimeout(this.blinkTimer);
  }

  // Settle on a resting frame. A plain standing pose blinks now and then.
  idle(frame = this.rest) {
    this.stop();
    this.rest = frame;
    this.face(1);
    this.set(frame);
    if (frame === F.stand && !motion.reduced) this.scheduleBlink();
  }

  scheduleBlink() {
    this.blinkTimer = setTimeout(() => {
      this.set(F.blink);
      this.blinkTimer = setTimeout(() => {
        this.set(F.stand);
        this.scheduleBlink();
      }, 140);
    }, 2600 + Math.random() * 3200);
  }

  // Play frames once (or `times` times) at `fps`, then rest.
  play(frames, { fps = 6, times = 1, rest = this.rest } = {}) {
    this.stop();
    this.rest = rest;
    this.face(1);
    if (motion.reduced) {
      this.idle(rest);
      return;
    }
    const sequence = Array.from({ length: times }, () => frames).flat();
    let index = 0;
    const step = () => {
      if (index >= sequence.length) {
        this.idle(rest);
        return;
      }
      this.set(sequence[index]);
      index += 1;
      this.timer = setTimeout(step, 1000 / fps);
    };
    step();
  }
}
