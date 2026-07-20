/** Convert #RGB / #RRGGBB (or already-HSL "H S% L%") into CSS var channels for hsl(var(--x)). */
export function toHslChannels(color: string): string | null {
  const raw = color.trim();
  if (!raw) return null;

  // Already HSL channels: "178 72% 32%"
  if (/^\d+(\.\d+)?\s+\d+(\.\d+)?%\s+\d+(\.\d+)?%$/.test(raw)) {
    return raw;
  }

  let hex = raw.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return null;
  }

  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;

  let h = 0;
  let s = 0;

  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function applyBrandPrimary(color?: string | null) {
  if (typeof document === 'undefined' || !color) return;
  const channels = toHslChannels(color);
  if (!channels) return;
  document.documentElement.style.setProperty('--primary', channels);
  document.documentElement.style.setProperty('--ring', channels);
}
