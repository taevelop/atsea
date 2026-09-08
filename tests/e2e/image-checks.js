import { PNG } from 'pngjs';

// Inspect only the middle of the water: omit controls, right-side tools, and
// lower-left catch notices so intact HTML cannot hide a cleared WebGL canvas.
export function inspectWaterPixels(buffer, canvasBox) {
  const png = PNG.sync.read(buffer);
  const x0 = Math.max(0, Math.floor(canvasBox.x + canvasBox.width * 0.08));
  const x1 = Math.min(png.width, Math.floor(canvasBox.x + canvasBox.width * 0.80));
  const y0 = Math.max(0, Math.floor(canvasBox.y + canvasBox.height * 0.05));
  const y1 = Math.min(png.height, Math.floor(canvasBox.y + canvasBox.height * 0.75));
  const colors = new Set();
  let darkest = 765, lightest = 0, samples = 0, red = 0, blue = 0;
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const index = (y * png.width + x) * 4;
      const [r, g, b] = png.data.subarray(index, index + 3);
      colors.add((r << 16) | (g << 8) | b);
      const brightness = r + g + b;
      darkest = Math.min(darkest, brightness);
      lightest = Math.max(lightest, brightness);
      red += r; blue += b; samples++;
    }
  }
  return { distinctColors: colors.size, brightnessRange: lightest - darkest, samples, meanRed: red / samples, meanBlue: blue / samples };
}
