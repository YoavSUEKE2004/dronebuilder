import { CanonicalPart } from '@/lib/catalog';

export type IssueSeverity = 'error' | 'warning';

export interface CompatibilityIssue {
  id: string;
  severity: IssueSeverity;
  category: 'mounting' | 'voltage' | 'current';
  title: string;
  message: string;
}

export interface SelectedBuildParts {
  frame?: CanonicalPart | null;
  flight_controller?: CanonicalPart | null;
  esc?: CanonicalPart | null;
  motor?: CanonicalPart | null;
  battery_cell_count?: number;
}

function parseVoltageLimits(rangeStr?: string): { min: number; max: number } | null {
  if (!rangeStr) return null;
  const match = rangeStr.toUpperCase().match(/(\d+)S(?:\s*-\s*(\d+)S)?/);
  if (!match) return null;
  const min = parseInt(match[1], 10);
  const max = match[2] ? parseInt(match[2], 10) : min;
  return { min, max };
}

export function validateBuildCompatibility(build: SelectedBuildParts): CompatibilityIssue[] {
  const issues: CompatibilityIssue[] = [];
  const { frame, flight_controller: fc, esc, motor, battery_cell_count: batteryS } = build;

  // 1. Stack Mounting Check
  if (fc && esc && fc.mounting_pattern && esc.mounting_pattern) {
    if (fc.mounting_pattern.trim().toLowerCase() !== esc.mounting_pattern.trim().toLowerCase()) {
      issues.push({
        id: 'fc-esc-mount-mismatch',
        severity: 'error',
        category: 'mounting',
        title: 'Stack Mounting Mismatch',
        message: `FC mount (${fc.mounting_pattern}) does not match ESC mount (${esc.mounting_pattern}).`,
      });
    }
  }

  // 2. Voltage Check
  if (batteryS && fc?.voltage_range) {
    const fcLimits = parseVoltageLimits(fc.voltage_range);
    if (fcLimits && batteryS > fcLimits.max) {
      issues.push({
        id: 'fc-overvoltage',
        severity: 'error',
        category: 'voltage',
        title: 'FC Overvoltage',
        message: `${batteryS}S battery exceeds FC maximum rating of ${fcLimits.max}S.`,
      });
    }
  }

  return issues;
}