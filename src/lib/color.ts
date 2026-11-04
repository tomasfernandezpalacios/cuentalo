// Cuentas de color (funciones puras) para el color de acento personalizado.

export type Hsv = { h: number; s: number; v: number };
type Rgb = [number, number, number];

/** '#RRGGBB' válido (también sin # o en minúsculas) → '#RRGGBB' en mayúsculas; si no, null. */
export function normalizeHex(text: string): string | null {
  const hex = text.trim().replace(/^#/, '');
  return /^[0-9a-fA-F]{6}$/.test(hex) ? `#${hex.toUpperCase()}` : null;
}

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: Rgb): string {
  const part = (c: number) =>
    Math.round(Math.min(255, Math.max(0, c)))
      .toString(16)
      .padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

/** Tono 0–360, saturación y brillo 0–1. */
export function hsvToHex({ h, s, v }: Hsv): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return rgbToHex([f(5) * 255, f(3) * 255, f(1) * 255]);
}

export function hexToHsv(hex: string): Hsv {
  const [r, g, b] = hexToRgb(hex).map((c) => c / 255) as Rgb;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return { h: (h * 60 + 360) % 360, s: max === 0 ? 0 : d / max, v: max };
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste WCAG entre dos colores (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Mezcla `hex` con `toward` (0 = nada, 1 = todo `toward`). */
function mix(hex: string, toward: string, amount: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(toward);
  return rgbToHex(a.map((c, i) => c + ((b[i] ?? 0) - c) * amount) as Rgb);
}

/**
 * Oscurece (`toward` negro) o aclara (blanco) el color poco a poco hasta que tenga un contraste
 * AA (≥ 4,5) con `against`, el color del texto de los botones.
 */
function withContrast(hex: string, against: string, toward: string): string {
  for (let step = 0; step <= 20; step++) {
    const candidate = mix(hex, toward, step / 20);
    if (contrastRatio(candidate, against) >= 4.5) return candidate;
  }
  return toward;
}

/**
 * Del color elegido salen los de los dos modos, como los de serie: `primary` (botones, con texto
 * encima legible) y `primarySoft` (fondos suaves).
 */
export function customAccent(
  hex: string,
  base: {
    lightBackground: string;
    darkBackground: string;
    lightOnPrimary: string;
    darkOnPrimary: string;
  },
) {
  return {
    light: {
      primary: withContrast(hex, base.lightOnPrimary, '#000000'),
      primarySoft: mix(hex, base.lightBackground, 0.86),
    },
    dark: {
      primary: withContrast(hex, base.darkOnPrimary, '#FFFFFF'),
      primarySoft: mix(hex, base.darkBackground, 0.8),
    },
  };
}
