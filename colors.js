// Alışkanlık renkleri. Kayıtlı renk tek bir hex değeridir; ekranda gösterirken
// seçili temanın zemininde görünür kalacak şekilde gerekirse açılır veya koyulaştırılır.

export const PALETTE = [
  { name: 'Kobalt', hex: '#2B4FD8' },
  { name: 'Hardal', hex: '#B98500' },
  { name: 'Mor', hex: '#7E4FD6' },
  { name: 'Zümrüt', hex: '#1E9A4F' },
  { name: 'Mercan', hex: '#E04F2F' },
  { name: 'Turkuaz', hex: '#00909E' },
  { name: 'Gül', hex: '#D23C80' },
  { name: 'Toprak', hex: '#A0602A' },
];

export const SURFACE = { light: '#FFFFFF', dark: '#141416' };
const INK = { light: '#FFFFFF', dark: '#141416' };

function toRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(rgb) {
  return `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

function luminance(hex) {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function mix(hex, target, amount) {
  const a = toRgb(hex);
  const b = toRgb(target);
  return toHex(a.map((v, i) => v + (b[i] - v) * amount));
}

// Rengi temanın zemininde en az 3:1 karşıtlığa getirir.
export function displayColor(hex, theme) {
  const surface = SURFACE[theme] || SURFACE.light;
  const target = theme === 'dark' ? '#FFFFFF' : '#000000';
  let color = hex.toLowerCase();
  for (let step = 0; step <= 20 && contrast(color, surface) < 3; step += 1) {
    color = mix(hex, target, step * 0.05);
  }
  return color;
}

// Renkli zemin üzerindeki yazı rengi.
export function inkOn(hex) {
  return contrast(hex, INK.light) >= contrast(hex, INK.dark) ? INK.light : INK.dark;
}
