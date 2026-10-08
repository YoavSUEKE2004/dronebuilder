import type { ComponentWithSpecs, SelectedParts } from './supabase';
import { getFrameSize } from './frameCompatibility';

export type CompIssueLevel = 'ok' | 'warning' | 'error';

export type CompIssue = {
  level: CompIssueLevel;
  message: string;
};

export type CompatibilityRule = {
  id: string;
  label: string;
  issues: CompIssue[];
};

export type DetailedCompatibilityResult = {
  issues: CompIssue[];
  rules: CompatibilityRule[];
  compatible: boolean;
};

function getPart(selectedParts: SelectedParts, components: ComponentWithSpecs[], category: string): ComponentWithSpecs | undefined {
  const id = selectedParts[category];
  return id && id !== 'skip' ? components.find((c) => c.id === id) : undefined;
}

function normalizeMountPattern(s: string | undefined): string {
  return (s || '').replace(/\s+/g, '').toLowerCase().trim();
}

function isDigitalVideo(comp: ComponentWithSpecs | undefined): boolean {
  if (!comp) return false;
  const name = comp.name.toLowerCase();
  const proto = comp.electrical_specs?.protocol?.toLowerCase() || '';
  return name.includes('dji') || name.includes('walksnail') || name.includes('hd zero') ||
    name.includes('caddx') || proto === 'digital' || name.includes('o3');
}

const REQUIRED_CATEGORIES = [
  'frame', 'motor', 'esc', 'flight_controller', 'propeller',
  'battery', 'camera', 'vtx', 'receiver',
];

export function validateDetailedCompatibility(
  selectedParts: SelectedParts,
  components: ComponentWithSpecs[]
): DetailedCompatibilityResult {
  const frame = getPart(selectedParts, components, 'frame');
  const motor = getPart(selectedParts, components, 'motor');
  const esc = getPart(selectedParts, components, 'esc');
  const fc = getPart(selectedParts, components, 'flight_controller');
  const battery = getPart(selectedParts, components, 'battery');
  const camera = getPart(selectedParts, components, 'camera');
  const vtx = getPart(selectedParts, components, 'vtx');
  const receiver = getPart(selectedParts, components, 'receiver');
  const propeller = getPart(selectedParts, components, 'propeller');

  const rules: CompatibilityRule[] = [];
  const allIssues: CompIssue[] = [];

  // Rule 1: Stack Mounting — FC, ESC, and Frame must share mounting pattern
  {
    const issues: CompIssue[] = [];
    const fcMount = normalizeMountPattern(fc?.mounting_pattern);
    const escMount = normalizeMountPattern(esc?.mounting_pattern);
    const frameMount = normalizeMountPattern(frame?.mounting_pattern);

    if (fc && esc && fcMount && escMount && fcMount !== escMount) {
      issues.push({ level: 'error', message: `FC mount (${fc.mounting_pattern}) does not match ESC mount (${esc.mounting_pattern}).` });
    }
    if (fc && frame && fcMount && frameMount && fcMount !== frameMount) {
      issues.push({ level: 'error', message: `FC mount (${fc.mounting_pattern}) does not match frame (${frame.mounting_pattern}).` });
    }
    if (esc && frame && escMount && frameMount && escMount !== frameMount) {
      issues.push({ level: 'warning', message: `ESC mount (${esc.mounting_pattern}) may not match frame (${frame.mounting_pattern}).` });
    }
    if (issues.length === 0 && fc && esc) {
      issues.push({ level: 'ok', message: 'Stack mounting patterns are aligned.' });
    }
    rules.push({ id: 'mounting', label: 'Stack Mounting Pattern', issues });
    allIssues.push(...issues);
  }

  // Rule 2: Battery Voltage vs all electrical components
  {
    const issues: CompIssue[] = [];
    const batteryS = battery?.electrical_specs?.max_voltage_s;

    if (batteryS) {
      const checkVoltage = (comp: ComponentWithSpecs | undefined, label: string) => {
        const maxS = comp?.electrical_specs?.max_voltage_s;
        if (comp && maxS && batteryS > maxS) {
          issues.push({ level: 'error', message: `${batteryS}S battery exceeds ${label} max rating of ${maxS}S.` });
        }
      };
      checkVoltage(motor, 'motor');
      checkVoltage(esc, 'ESC');
      checkVoltage(fc, 'flight controller');
      checkVoltage(vtx, 'VTX');
      checkVoltage(camera, 'camera');
    }

    if (issues.length === 0 && battery && motor && esc) {
      issues.push({ level: 'ok', message: `Battery voltage (${batteryS}S) is within all component ratings.` });
    }
    rules.push({ id: 'voltage', label: 'Battery Voltage Compatibility', issues });
    allIssues.push(...issues);
  }

  // Rule 3: ESC Continuous Current vs Motor Draw
  {
    const issues: CompIssue[] = [];
    const escAmps = esc?.electrical_specs?.max_current_a;
    const motorAmps = motor?.electrical_specs?.max_current_a;

    if (esc && motor && escAmps && motorAmps) {
      const motorTotalDraw = motorAmps * 4;
      if (escAmps < motorTotalDraw * 0.8) {
        issues.push({
          level: 'error',
          message: `ESC (${escAmps}A) cannot handle motor burst current (${motorTotalDraw.toFixed(0)}A for 4x ${motorAmps}A motors).`,
        });
      } else if (escAmps < motorTotalDraw) {
        issues.push({
          level: 'warning',
          message: `ESC (${escAmps}A) has limited headroom over motor burst current (${motorTotalDraw.toFixed(0)}A).`,
        });
      } else {
        issues.push({ level: 'ok', message: `ESC (${escAmps}A) has sufficient headroom over motor burst current (${motorTotalDraw.toFixed(0)}A).` });
      }
    }
    rules.push({ id: 'current', label: 'ESC Current vs Motor Draw', issues });
    allIssues.push(...issues);
  }

  // Rule 4: VTX / Camera Video System Match (Digital vs Analog)
  {
    const issues: CompIssue[] = [];
    if (camera && vtx) {
      const camDigital = isDigitalVideo(camera);
      const vtxDigital = isDigitalVideo(vtx);
      if (camDigital !== vtxDigital) {
        issues.push({
          level: 'error',
          message: `Camera is ${camDigital ? 'digital' : 'analog'} but VTX is ${vtxDigital ? 'digital' : 'analog'}. Video systems must match.`,
        });
      } else {
        issues.push({ level: 'ok', message: `Camera and VTX are both ${camDigital ? 'digital' : 'analog'} — video systems match.` });
      }
    }
    rules.push({ id: 'video_system', label: 'VTX / Camera Video System', issues });
    allIssues.push(...issues);
  }

  // Rule 5: Receiver protocol vs FC protocol
  {
    const issues: CompIssue[] = [];
    if (receiver && fc) {
      const rProto = (receiver.electrical_specs?.protocol || '').toLowerCase();
      const fcProto = (fc.electrical_specs?.protocol || '').toLowerCase();
      const compatible = (a: string, b: string) => {
        if (!a || !b) return true;
        const aliases: string[][] = [
          ['elrs', 'crsf', 'crossfire'],
          ['frsky', 'accst', 'access'],
          ['ibus', 'flysky'],
          ['sbus', 'futaba'],
        ];
        for (const group of aliases) {
          if (group.some((g) => a.includes(g)) && group.some((g) => b.includes(g))) return true;
        }
        return a === b;
      };
      if (!compatible(rProto, fcProto)) {
        issues.push({ level: 'error', message: `Receiver protocol (${receiver.electrical_specs?.protocol}) doesn't match FC (${fc.electrical_specs?.protocol}).` });
      } else if (rProto && fcProto) {
        issues.push({ level: 'ok', message: 'Receiver and FC protocols are compatible.' });
      }
    }
    rules.push({ id: 'protocol', label: 'Receiver / FC Protocol', issues });
    allIssues.push(...issues);
  }

  // Rule 6: Propeller size vs Frame size
  {
    const issues: CompIssue[] = [];
    if (propeller && frame) {
      const frameSize = getFrameSize(frame);
      const propMatch = propeller.name.match(/(\d+(?:\.\d+)?)"\s*Props/);
      if (frameSize && propMatch) {
        const propSize = parseFloat(propMatch[1]);
        const diff = Math.abs(propSize - frameSize);
        if (diff > 1) {
          issues.push({ level: 'error', message: `${propSize}" props are too large/small for ${frameSize}" frame.` });
        } else if (diff > 0.6) {
          issues.push({ level: 'warning', message: `${propSize}" props are slightly mismatched for ${frameSize}" frame.` });
        } else {
          issues.push({ level: 'ok', message: `${propSize}" props fit ${frameSize}" frame perfectly.` });
        }
      }
    }
    rules.push({ id: 'prop_size', label: 'Propeller / Frame Size', issues });
    allIssues.push(...issues);
  }

  // Collect missing part warnings
  for (const cat of REQUIRED_CATEGORIES) {
    const id = selectedParts[cat];
    if (!id || (id === 'skip' && (cat === 'goggles' || cat === 'remote'))) continue;
    if (!id || id === 'skip') {
      allIssues.push({ level: 'warning', message: `No ${cat.replace('_', ' ')} selected.` });
    }
  }

  const errors = allIssues.filter((i) => i.level === 'error');
  const compatible = errors.length === 0 && REQUIRED_CATEGORIES.every((c) => {
    const id = selectedParts[c];
    return id && id !== 'skip';
  });

  return { issues: allIssues, rules, compatible };
}
