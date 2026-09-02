import type { ComponentWithSpecs, SelectedParts } from './supabase';

export type CategoryKey =
  | 'frame'
  | 'motor'
  | 'esc'
  | 'flight_controller'
  | 'propeller'
  | 'battery'
  | 'camera'
  | 'vtx'
  | 'receiver';

export const CATEGORIES: { key: CategoryKey; label: string; icon: string }[] = [
  { key: 'frame', label: 'Frame', icon: 'Square' },
  { key: 'motor', label: 'Motors', icon: 'Fan' },
  { key: 'esc', label: 'ESC', icon: 'Zap' },
  { key: 'flight_controller', label: 'Flight Controller', icon: 'Cpu' },
  { key: 'propeller', label: 'Propellers', icon: 'Wind' },
  { key: 'battery', label: 'Battery', icon: 'BatteryCharging' },
  { key: 'camera', label: 'Camera', icon: 'Camera' },
  { key: 'vtx', label: 'VTX', icon: 'Radio' },
  { key: 'receiver', label: 'Receiver', icon: 'Antenna' },
];

export type CompIssue = {
  level: 'ok' | 'warning' | 'error';
  message: string;
};

export type CompatibilityResult = {
  issues: CompIssue[];
  compatible: boolean;
};

export function checkCompatibility(
  selected: SelectedParts,
  components: ComponentWithSpecs[]
): CompatibilityResult {
  const issues: CompIssue[] = [];
  const get = (cat: string) =>
    selected[cat]
      ? components.find((c) => c.id === selected[cat])
      : undefined;

  const frame = get('frame');
  const motor = get('motor');
  const esc = get('esc');
  const fc = get('flight_controller');
  const battery = get('battery');
  const vtx = get('vtx');
  const receiver = get('receiver');

  const required = ['frame', 'motor', 'esc', 'flight_controller', 'propeller', 'battery', 'camera', 'vtx', 'receiver'];
  for (const cat of required) {
    if (!selected[cat]) {
      issues.push({ level: 'warning', message: `No ${cat.replace('_', ' ')} selected` });
    }
  }

  if (battery && motor) {
    const bMax = battery.electrical_specs?.max_voltage_s;
    const mMax = motor.electrical_specs?.max_voltage_s;
    if (bMax && mMax && bMax > mMax) {
      issues.push({
        level: 'error',
        message: `Battery (${bMax}S) exceeds motor max voltage (${mMax}S)`,
      });
    }
  }

  if (battery && esc) {
    const bMax = battery.electrical_specs?.max_voltage_s;
    const eMax = esc.electrical_specs?.max_voltage_s;
    if (bMax && eMax && bMax > eMax) {
      issues.push({
        level: 'error',
        message: `Battery (${bMax}S) exceeds ESC max voltage (${eMax}S)`,
      });
    }
  }

  if (battery && fc) {
    const bMax = battery.electrical_specs?.max_voltage_s;
    const fcMax = fc.electrical_specs?.max_voltage_s;
    if (bMax && fcMax && bMax > fcMax) {
      issues.push({
        level: 'error',
        message: `Battery (${bMax}S) exceeds flight controller max voltage (${fcMax}S)`,
      });
    }
  }

  if (esc && fc) {
    const escProto = esc.electrical_specs?.protocol;
    if (escProto && escProto !== 'DSHOT600' && fc.electrical_specs?.protocol === 'CRSF') {
      // ESC protocol is motor-side, FC protocol is receiver-side; not a conflict
    }
  }

  if (receiver && fc) {
    const rProto = receiver.electrical_specs?.protocol;
    const fcProto = fc.electrical_specs?.protocol;
    if (rProto && fcProto && rProto !== fcProto) {
      issues.push({
        level: 'error',
        message: `Receiver protocol (${rProto}) doesn't match flight controller (${fcProto})`,
      });
    }
  }

  if (frame && esc) {
    const fMount = frame.mounting_pattern;
    const eMount = esc.mounting_pattern;
    if (fMount && eMount && fMount !== eMount) {
      issues.push({
        level: 'warning',
        message: `ESC mount (${eMount}) may not match frame (${fMount})`,
      });
    }
  }

  if (frame && fc) {
    const fMount = frame.mounting_pattern;
    const fcMount = fc.mounting_pattern;
    if (fMount && fcMount && fMount !== fcMount) {
      issues.push({
        level: 'warning',
        message: `FC mount (${fcMount}) may not match frame (${fMount})`,
      });
    }
  }

  if (frame && motor) {
    const fMount = frame.mounting_pattern;
    const mMount = motor.mounting_pattern;
    if (fMount && mMount && fMount !== mMount && !fMount.includes('30.5')) {
      issues.push({
        level: 'warning',
        message: `Motor mount (${mMount}) vs frame (${fMount}) — verify fit`,
      });
    }
  }

  if (vtx && fc) {
    const vProto = vtx.electrical_specs?.protocol;
    if (vProto === 'Digital' && fc.electrical_specs?.protocol === 'CRSF') {
      // Digital VTX often needs a separate FC; warn
      issues.push({
        level: 'warning',
        message: 'Digital VTX may require a compatible FC with DJI port',
      });
    }
  }

  const errors = issues.filter((i) => i.level === 'error');
  const compatible = errors.length === 0 && required.every((c) => selected[c]);

  return { issues, compatible };
}
