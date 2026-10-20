export function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function softmax(values, inverseTemperature) {
  const highest = Math.max(...values);
  const weights = values.map(value => Math.exp((value - highest) * inverseTemperature));
  const total = weights.reduce((sum, value) => sum + value, 0);
  return weights.map(weight => weight / total);
}

// Reinforcement learning with forgetting (RLF), as simulated in the project
// (DL4CM PRL with deterministic feedback and no reversals): one block of six
// stimuli, three actions, each stimulus shown 13 times in a random order.
// Every trial, all values first decay toward 1/3 by phi; the chosen action moves
// toward the reward and the others toward its complement, at rate alpha. Choice
// is a softmax with inverse temperature beta (4 to 16) after adding kappa
// (stickiness) to the action taken on the previous trial.
// Returns accuracy by presentation, averaged over `agents` simulated blocks.
export function simulateLearning({ alpha = 0.5, beta = 10, phi = 0.1, kappa = 0, seed = 39, agents = 300 } = {}) {
  const random = randomGenerator(seed);
  const presentations = 13;
  const stimulusCount = 6;
  const actionCount = 3;
  const hits = Array(presentations).fill(0);
  const deck = Array.from({ length: stimulusCount * presentations }, (_, i) => i % stimulusCount);
  for (let agent = 0; agent < agents; agent += 1) {
    const values = Array.from({ length: stimulusCount }, () => Array(actionCount).fill(1 / actionCount));
    const seen = Array(stimulusCount).fill(0);
    const order = deck.slice();
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    let previous = -1;
    for (const stimulus of order) {
      const scores = values[stimulus].slice();
      if (previous >= 0) scores[previous] += kappa;
      const probabilities = softmax(scores, beta);
      const draw = random();
      let chosen = actionCount - 1;
      let cumulative = 0;
      for (let a = 0; a < actionCount; a += 1) {
        cumulative += probabilities[a];
        if (draw < cumulative) {
          chosen = a;
          break;
        }
      }
      const reward = Number(chosen === stimulus % actionCount);
      hits[seen[stimulus]] += reward;
      seen[stimulus] += 1;
      for (const row of values) {
        for (let a = 0; a < actionCount; a += 1) row[a] = (1 - phi) * row[a] + phi / actionCount;
      }
      for (let a = 0; a < actionCount; a += 1) {
        const target = a === chosen ? reward : 1 - reward;
        values[stimulus][a] += alpha * (target - values[stimulus][a]);
      }
      previous = chosen;
    }
  }
  return hits.map(sum => sum / (agents * stimulusCount));
}
