// Remove neutral light paper pixels, retaining color, dark ink and original alpha.
// Each update starts from the original image, so changes are reversible.
export function removeWhiteBackground(data, strength = 50) {
  const cutoff = 250 - Math.max(0, Math.min(100, strength)) * .7;
  const feather = 32;
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const low = Math.min(data[i], data[i + 1], data[i + 2]);
    const high = Math.max(data[i], data[i + 1], data[i + 2]);
    // Saturated colored ink should not be mistaken for paper.
    if (high - low > 45) continue;
    const keep = Math.max(0, Math.min(1, (cutoff - low) / feather));
    const opacity = keep * keep * (3 - 2 * keep);
    if (opacity >= 1) continue;
    if (opacity > 0) {
      // Remove white matte from partially transparent stroke edges.
      for (let channel = 0; channel < 3; channel++) {
        data[i + channel] = Math.max(0, Math.min(255,
          (data[i + channel] - 255 * (1 - opacity)) / opacity));
      }
    }
    data[i + 3] = Math.round(data[i + 3] * opacity);
  }
  return data;
}
