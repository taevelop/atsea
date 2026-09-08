const RED_WATER = [
  [0.00, [150, 26, 22]], [0.18, [126, 21, 18]], [0.35, [104, 17, 15]],
  [0.55, [80, 13, 12]],  [0.72, [58, 9, 9]],    [0.88, [34, 5, 6]],
  [1.00, [12, 2, 3]],
];
const WATER = [
  [0.00, [8, 74, 108]], [0.18, [7, 60, 90]], [0.35, [6, 46, 70]],
  [0.55, [4, 32, 51]],  [0.72, [3, 20, 34]], [0.88, [2, 11, 19]],
  [1.00, [1, 4, 8]],
];
export function waterColor(f, redTide = false) {
  f = Math.max(0, Math.min(1, f));
  const ramp = redTide ? RED_WATER : WATER;
  for (let i = 1; i < ramp.length; i++) {
    if (f <= ramp[i][0]) {
      const [a, ca] = ramp[i - 1], [b, cb] = ramp[i];
      const t = (f - a) / (b - a);
      return `rgb(${ca.map((v, j) => Math.round(v + (cb[j] - v) * t)).join(",")})`;
    }
  }
  return redTide ? "rgb(12,2,3)" : "rgb(1,5,11)";
}
