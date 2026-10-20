import { F } from "../sprite.js";

export default function hello() {
  return {
    pose: F.stand,
    enter(actor) {
      actor?.play([F.waveA, F.waveB], { fps: 5, times: 4, rest: F.stand });
    },
  };
}
