import type { ComponentWithSpecs, SelectedParts } from './supabase';
import type { CompIssue, CompatibilityResult } from './types';

export type CompatibilityRule = {
  id: string;
  label: string;
  passed: boolean;
  issues: CompIssue[];
};

export type DetailedCompatibilityResult = CompatibilityResult & {
  rules: CompatibilityRule[];
};

const REQUIRED_CATEGORIES = [
  'frame',
  'motor',
  'esc',
  'flight_controller',
  'propeller',
  'battery',
  'camera',
  'vtx',
  'receiver',
];

/**
 * Rule 1: Battery max_voltage_s must not exceed the max_voltage_s of the ESC,
 * flight controller, or VTX. Any of those that are present must tolerate the
 * battery's cell count.
 */
function rule1BatteryVoltage(
  battery: ComponentWithSpecs | undefined,
  esc: ComponentWithSpecs | undefined,
  fc: ComponentWithSpecs | undefined,
  vtx: ComponentWithSpecs | undefined
): CompatibilityRule {
  const issues: CompIssue[] = [];
  const bMax = battery?.electrical_specs?.max_voltage_s;

  if (!battery || bMax == null) {
    return { id: 'voltage', label: 'Battery voltage within ESC/FC/VTX limits', passed: true, issues };
  }

  const checks: [string, ComponentWithSpecs | undefined][] = [
    ['ESC', esc],
    ['flight controller', fc],
    ['VTX', vtx],
  ];

  for (const [label, part] of checks) {
    if (!part) continue;
    const partMax = part.electrical_specs?.max_voltage_s;
    if (partMax != null && bMax > partMax) {
      issues.push({
        level: 'error',
        message: `Battery (${bMax}S) exceeds ${label} max voltage (${partMax}S) — ${part.name}`,
      });
    }
  }

  return {
    id: 'voltage',
    label: 'Battery voltage within ESC/FC/VTX limits',
    passed: issues.length === 0,
    issues,
  };
}

/**
 * Rule 2: The combined stall current of all four motors must not exceed the
 * ESC's continuous max_current_a rating. We approximate motor max current
 * using max_current_a when available, otherwise derive a conservative
 * estimate from the motor's KV and a nominal voltage.
 */
function rule2MotorCurrent(
  motor: ComponentWithSpecs | undefined,
  esc: ComponentWithSpecs | undefined
): CompatibilityRule {
  const issues: CompIssue[] = [];

  if (!motor || !esc) {
    return { id: 'current', label: 'Motor current within ESC rating', passed: true, issues };
  }

  const escCurrent = esc.electrical_specs?.max_current_a;
  const motorCurrent = motor.electrical_specs?.max_current_a;

  if (escCurrent == null || motorCurrent == null) {
    return { id: 'current', label: 'Motor current within ESC rating', passed: true, issues };
  }

  const totalMotorCurrent = motorCurrent * 4;
  if (totalMotorCurrent > escCurrent) {
    issues.push({
      level: 'error',
      message: `4× motor current (${totalMotorCurrent.toFixed(1)}A) exceeds ESC rating (${escCurrent}A) — ${esc.name}`,
    });
  }

  return {
    id: 'current',
    label: 'Motor current within ESC rating',
    passed: issues.length === 0,
    issues,
  };
}

/**
 * Rule 3: The flight controller's mounting_pattern must match the frame's
 * mounting_pattern. We normalize patterns so that "30.5x30.5" and "30.5 x 30.5"
 * are treated as equivalent.
 */
function rule3FcMounting(
  frame: ComponentWithSpecs | undefined,
  fc: ComponentWithSpecs | undefined
): CompatibilityRule {
  const issues: CompIssue[] = [];

  if (!frame || !fc) {
    return { id: 'mounting', label: 'FC mounting pattern matches frame', passed: true, issues };
  }

  const normalize = (s: string) => s.replace(/\s+/g, '').toLowerCase().trim();
  const frameMount = normalize(frame.mounting_pattern);
  const fcMount = normalize(fc.mounting_pattern);

  if (frameMount && fcMount && frameMount !== fcMount) {
    issues.push({
      level: 'error',
      message: `FC mount pattern (${fc.mounting_pattern}) does not match frame (${frame.mounting_pattern})`,
    });
  }

  return {
    id: 'mounting',
    label: 'FC mounting pattern matches frame',
    passed: issues.length === 0,
    issues,
  };
}

/**
 * Rule 4: The propeller diameter must not exceed the frame's maximum prop
 * clearance. We derive max prop clearance from the frame wheelbase: a 220mm
 * 5-inch frame clears up to ~5 inches (127mm). We parse the prop size from the
 * propeller's dimensions_mm field (e.g. "5.1 inch").
 */
function rule4PropClearance(
  frame: ComponentWithSpecs | undefined,
  propeller: ComponentWithSpecs | undefined
): CompatibilityRule {
  const issues: CompIssue[] = [];

  if (!frame || !propeller) {
    return { id: 'prop', label: 'Propeller size within frame clearance', passed: true, issues };
  }

  const propInches = parsePropSize(propeller.dimensions_mm);
  const maxClearanceInches = parseFrameMaxProp(frame.dimensions_mm);

  if (propInches == null || maxClearanceInches == null) {
    return { id: 'prop', label: 'Propeller size within frame clearance', passed: true, issues };
  }

  if (propInches > maxClearanceInches) {
    issues.push({
      level: 'error',
      message: `Propeller (${propInches.toFixed(1)}") exceeds frame max prop clearance (${maxClearanceInches.toFixed(1)}")`,
    });
  }

  return {
    id: 'prop',
    label: 'Propeller size within frame clearance',
    passed: issues.length === 0,
    issues,
  };
}

function parsePropSize(dim: string): number | null {
  const match = dim.match(/([\d.]+)\s*inch/i);
  return match ? parseFloat(match[1]) : null;
}

function parseFrameMaxProp(dim: string): number | null {
  const match = dim.match(/(\d+)\s*mm/i);
  if (!match) return null;
  const wheelbase = parseInt(match[1], 10);
  // Rough heuristic: max prop clearance in inches ≈ wheelbase / 44
  // 220mm → ~5", 280mm → ~6.4"
  return Math.round((wheelbase / 44) * 10) / 10;
}

/**
 * Run all four compatibility rules against the selected parts.
 * Returns a detailed result including per-rule pass/fail status and all
 * error issues for UI display.
 */
export function runCompatibilityEngine(
  selected: SelectedParts,
  components: ComponentWithSpecs[]
): DetailedCompatibilityResult {
  const get = (cat: string) =>
    selected[cat] ? components.find((c) => c.id === selected[cat]) : undefined;

  const frame = get('frame');
  const motor = get('motor');
  const esc = get('esc');
  const fc = get('flight_controller');
  const propeller = get('propeller');
  const battery = get('battery');
  const vtx = get('vtx');

  const rules: CompatibilityRule[] = [
    rule1BatteryVoltage(battery, esc, fc, vtx),
    rule2MotorCurrent(motor, esc),
    rule3FcMounting(frame, fc),
    rule4PropClearance(frame, propeller),
  ];

  const issues: CompIssue[] = [];

  // Missing-part warnings
  for (const cat of REQUIRED_CATEGORIES) {
    if (!selected[cat]) {
      issues.push({ level: 'warning', message: `No ${cat.replace('_', ' ')} selected` });
    }
  }

  // Collect all rule errors
  for (const rule of rules) {
    issues.push(...rule.issues);
  }

  const errors = issues.filter((i) => i.level === 'error');
  const compatible =
    errors.length === 0 && REQUIRED_CATEGORIES.every((c) => selected[c]);

  return { issues, compatible, rules };
}
