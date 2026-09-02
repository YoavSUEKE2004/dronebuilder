import type { ComponentWithSpecs } from './supabase';

export function getFrameSize(frame: ComponentWithSpecs | undefined): number | null {
  if (!frame) return null;
  const match = frame.name.match(/(\d+(?:\.\d+)?)"/);
  if (match) return parseFloat(match[1]);
  const mmMatch = frame.dimensions_mm.match(/(\d+)mm/);
  if (mmMatch) return parseInt(mmMatch[1]) / 44;
  return null;
}

export function getFrameMountPattern(frame: ComponentWithSpecs | undefined): string | null {
  if (!frame) return null;
  return frame.mounting_pattern || null;
}

export function isCompatibleWithFrame(
  component: ComponentWithSpecs,
  frame: ComponentWithSpecs | undefined,
  category: string
): boolean {
  if (!frame) return true;
  if (category === 'frame') return true;

  const frameSize = getFrameSize(frame);
  const frameMount = getFrameMountPattern(frame);

  switch (category) {
    case 'motor': {
      const kvMatch = component.name.match(/(\d+)KV/);
      if (kvMatch && frameSize != null) {
        const kv = parseInt(kvMatch[1]);
        if (frameSize <= 3.5 && kv < 3000) return false;
        if (frameSize >= 5 && frameSize < 7 && (kv < 2000 || kv > 2800)) return false;
        if (frameSize >= 7 && frameSize < 10 && (kv < 1000 || kv > 1800)) return false;
        if (frameSize >= 10 && kv > 800) return false;
      }
      return true;
    }
    case 'propeller': {
      const propMatch = component.name.match(/(\d+(?:\.\d+)?)"\s*Props/);
      if (propMatch && frameSize != null) {
        const propSize = parseFloat(propMatch[1]);
        if (Math.abs(propSize - frameSize) > 0.6) return false;
      }
      return true;
    }
    case 'esc':
    case 'flight_controller': {
      if (frameMount && component.mounting_pattern) {
        const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase().trim();
        if (normalize(component.mounting_pattern) !== normalize(frameMount)) return false;
      }
      return true;
    }
    case 'battery': {
      if (frameSize != null) {
        const s = component.electrical_specs?.max_voltage_s;
        if (s) {
          if (frameSize <= 3.5 && s > 4) return false;
          if (frameSize >= 7 && s < 4) return false;
        }
      }
      return true;
    }
    default:
      return true;
  }
}
