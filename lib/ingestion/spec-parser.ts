import type { RawProduct } from './fetchers';

export type DetectedSpecs = {
  mountingPattern: string | null;
  motorKV: number | null;
  voltageS: number | null;
  voltageRange: string | null;
  mcuChip: string | null;
  gyroChip: string | null;
  formFactor: string | null;
  cameraSize: string | null;
  propDiameter: string | null;
  category: string;
  weightG: number | null;
};

const MOUNTING_PATTERNS: RegExp[] = [
  /(\d{2}(?:\.\d)?x\d{2}(?:\.\d)?\s*mm)/gi,
  /(\d{2}\.\d\s*x\s*\d{2}\.\d\s*mm)/gi,
  /(30\.5x30\.5)/gi,
  /(30x30)/gi,
  /(20x20)/gi,
  /(25\.5x25\.5)/gi,
  /(16x16)/gi,
  /(12x12)/gi,
  /(9x9)/gi,
];

const MCU_CHIPS = ['STM32F405', 'STM32F411', 'STM32F722', 'STM32F745', 'STM32H743', 'STM32H750', 'F405', 'F411', 'F722', 'F745', 'H743', 'H750'];
const GYRO_CHIPS = ['ICM-42688-P', 'ICM42688P', 'ICM-42688', 'ICM20689', 'MPU-6000', 'MPU6050', 'BMI270', 'BMI-270'];

const CAMERA_SIZES: RegExp[] = [
  /(micro\s*19\s*mm|19mm)/gi,
  /(nano\s*14\s*mm|14mm)/gi,
  /(mini\s*21\s*mm|21mm)/gi,
  /(full\s*size\s*28\s*mm|28mm)/gi,
  /(micro)/gi,
  /(nano)/gi,
];

const PROP_DIAMETERS: RegExp[] = [
  /(\d+(?:\.\d+)?)\s*inch\s*prop/i,
  /(\d+(?:\.\d+)?)\s*"\s*prop/i,
  /(\d+(?:\.\d+)?)\s*inch\s*blade/i,
  /prop.*?(\d+(?:\.\d+)?)\s*inch/i,
  /(\d+)\s*inch\b/i,
];

const CATEGORIES: { key: string; patterns: RegExp[] }[] = [
  { key: 'frame', patterns: [/frame/i, /chassis/i] },
  { key: 'motor', patterns: [/motor/i, /brushless/i, /\d+kv/i] },
  { key: 'esc', patterns: [/\besc\b/i, /electronic\s*speed/i, /4in1/i, /4-in-1/i] },
  { key: 'flight_controller', patterns: [/flight\s*controller/i, /\bfc\b/i, /stm32/i, /\bf722\b/i, /\bf405\b/i, /\bh743\b/i] },
  { key: 'propeller', patterns: [/prop/i, /propeller/i, /blade/i, /\d+\s*inch\s*(?:prop|blade)/i] },
  { key: 'battery', patterns: [/\bbattery\b/i, /lipo/i, /li-po/i, /\d+s\b.*\d+mah/i] },
  { key: 'camera', patterns: [/\bcamera\b/i, /fpv\s*cam/i, /analog\s*cam/i] },
  { key: 'vtx', patterns: [/\bvtx\b/i, /video\s*transmitter/i, /5\.8ghz/i, /analog\s*vtx/i] },
  { key: 'receiver', patterns: [/receiver/i, /\belrs\b/i, /crossfire/i, /\bcrsf\b/i] },
  { key: 'goggles', patterns: [/goggle/i, /\bfdv\b/i, /hd\s*zero/i] },
  { key: 'remote', patterns: [/remote/i, /radio\s*controller/i, /transmitter/i, /\btx\b/i] },
];

export function detectCategory(text: string): string {
  const lower = text.toLowerCase();
  for (const cat of CATEGORIES) {
    if (cat.patterns.some((p) => p.test(lower))) {
      return cat.key;
    }
  }
  return '';
}

export function extractSpecs(product: RawProduct): DetectedSpecs {
  const text = `${product.title} ${product.description || ''}`;

  return {
    mountingPattern: extractMountingPattern(text),
    motorKV: extractMotorKV(text),
    voltageS: extractVoltageS(text),
    voltageRange: extractVoltageRange(text),
    mcuChip: extractMcu(text),
    gyroChip: extractGyro(text),
    formFactor: extractFormFactor(text),
    cameraSize: extractCameraSize(text),
    propDiameter: extractPropDiameter(text),
    category: detectCategory(text),
    weightG: extractWeight(text),
  };
}

export function extractMountingPattern(text: string): string | null {
  for (const pattern of MOUNTING_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[0].replace(/\s+/g, '').replace(/mm/i, 'mm').toLowerCase();
    }
  }
  return null;
}

export function extractMotorKV(text: string): number | null {
  const patterns: RegExp[] = [
    /(\d{3,5})\s*kv\b/i,
    /kv\s*(\d{3,5})/i,
  ];
  for (const p of patterns) {
    const match = text.match(p);
    if (match) {
      const kv = parseInt(match[1], 10);
      if (kv >= 100 && kv <= 50000) return kv;
    }
  }
  return null;
}

export function extractVoltageS(text: string): number | null {
  const match = text.match(/(\d)\s*s\b(?!\w)/i);
  if (match) {
    const s = parseInt(match[1], 10);
    if (s >= 1 && s <= 12) return s;
  }
  return null;
}

export function extractVoltageRange(text: string): string | null {
  const match = text.match(/(\d)\s*s\s*[-–]\s*(\d)\s*s/i);
  if (match) {
    return `${match[1]}S-${match[2]}S`;
  }
  const single = text.match(/(\d)\s*s(?:\s*lip(?:o|po))?/i);
  if (single) {
    return `${single[1]}S`;
  }
  return null;
}

export function extractMcu(text: string): string | null {
  for (const chip of MCU_CHIPS) {
    if (text.toUpperCase().includes(chip.toUpperCase())) {
      return chip;
    }
  }
  return null;
}

export function extractGyro(text: string): string | null {
  for (const chip of GYRO_CHIPS) {
    const chipClean = chip.replace(/[-\s]/g, '');
    const textClean = text.replace(/[-\s]/g, '');
    if (textClean.toUpperCase().includes(chipClean.toUpperCase())) {
      return chip;
    }
  }
  return null;
}

export function extractFormFactor(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes('micro') && !lower.includes('micro usb')) return 'Micro';
  if (lower.includes('nano')) return 'Nano';
  if (lower.includes('mini')) return 'Mini';
  if (lower.includes('full size')) return 'Full Size';
  return null;
}

export function extractCameraSize(text: string): string | null {
  for (const pattern of CAMERA_SIZES) {
    const match = text.match(pattern);
    if (match) {
      const m = match[0].toLowerCase();
      if (m.includes('19')) return 'Micro 19mm';
      if (m.includes('14')) return 'Nano 14mm';
      if (m.includes('21')) return 'Mini 21mm';
      if (m.includes('28')) return 'Full Size 28mm';
      if (m.includes('micro')) return 'Micro 19mm';
      if (m.includes('nano')) return 'Nano 14mm';
    }
  }
  return null;
}

export function extractPropDiameter(text: string): string | null {
  for (const pattern of PROP_DIAMETERS) {
    const match = text.match(pattern);
    if (match) {
      const size = match[1] || match[0];
      return `${size}"`;
    }
  }
  return null;
}

export function extractWeight(text: string): number | null {
  const patterns: RegExp[] = [
    /(\d+(?:\.\d+)?)\s*g\b(?!hz|o)/i,
    /(\d+(?:\.\d+)?)\s*gram/i,
    /weight[:\s]*(\d+(?:\.\d+)?)\s*g/i,
  ];
  for (const p of patterns) {
    const match = text.match(p);
    if (match) {
      const w = parseFloat(match[1]);
      if (w > 0 && w < 5000) return w;
    }
  }
  return null;
}

export function specsToJson(specs: DetectedSpecs): Record<string, unknown> {
  return {
    mounting_pattern: specs.mountingPattern,
    motor_kv: specs.motorKV,
    voltage_s: specs.voltageS,
    voltage_range: specs.voltageRange,
    mcu_chip: specs.mcuChip,
    gyro_chip: specs.gyroChip,
    form_factor: specs.formFactor,
    camera_size: specs.cameraSize,
    prop_diameter: specs.propDiameter,
    category: specs.category,
    weight_g: specs.weightG,
  };
}
