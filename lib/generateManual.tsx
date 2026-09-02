import OpenAI from 'openai';
import {
  Document, Page, Text, View, StyleSheet, Font, Link,
} from '@react-pdf/renderer';
import type { ComponentWithSpecs, SelectedParts } from './supabase';

export type DetailLevel = 'beginner' | 'expert';

export type ManualSection = {
  title: string;
  steps: string[];
};

export type GeneratedManual = {
  title: string;
  sections: ManualSection[];
  partsList: { category: string; name: string; price: number }[];
  warnings: string[];
};

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });
  }
  return _openai;
}

const CATEGORY_ORDER = [
  'frame', 'motor', 'esc', 'flight_controller', 'propeller',
  'battery', 'camera', 'vtx', 'receiver',
];

const CATEGORY_LABELS: Record<string, string> = {
  frame: 'Frame',
  motor: 'Motors',
  esc: 'ESC',
  flight_controller: 'Flight Controller',
  propeller: 'Propellers',
  battery: 'Battery',
  camera: 'Camera',
  vtx: 'VTX',
  receiver: 'Receiver',
};

/**
 * Build a parts summary string for the AI prompt.
 */
function buildPartsSummary(selected: SelectedParts, components: ComponentWithSpecs[]): string {
  const lines: string[] = [];
  for (const cat of CATEGORY_ORDER) {
    const id = selected[cat];
    if (!id) continue;
    const comp = components.find((c) => c.id === id);
    if (!comp) continue;
    const specs = comp.electrical_specs;
    const specStr = specs
      ? ` (max ${specs.max_voltage_s ?? '?'}S, ${specs.max_current_a ?? '?'}A, ${specs.protocol || 'N/A'})`
      : '';
    lines.push(`- ${CATEGORY_LABELS[cat]}: ${comp.name}${specStr} — ${comp.dimensions_mm}, mount: ${comp.mounting_pattern}`);
  }
  return lines.join('\n');
}

/**
 * Generate a customized assembly manual using OpenAI based on the selected
 * build parts and the user's chosen detail level.
 */
export async function generateAssemblyManual(
  selectedParts: SelectedParts,
  components: ComponentWithSpecs[],
  detailLevel: DetailLevel
): Promise<GeneratedManual> {
  const partsSummary = buildPartsSummary(selectedParts, components);
  const partsList = CATEGORY_ORDER
    .map((cat) => {
      const id = selectedParts[cat];
      if (!id) return null;
      const comp = components.find((c) => c.id === id);
      if (!comp) return null;
      return { category: CATEGORY_LABELS[cat], name: comp.name, price: Number(comp.price) };
    })
    .filter((x): x is { category: string; name: string; price: number } => x !== null);

  const prompt = `You are an expert FPV drone assembly instructor. Generate a step-by-step assembly manual for a custom drone build with the following parts:

${partsSummary}

Detail level: ${detailLevel === 'beginner'
  ? 'Beginner-friendly with detailed soldering instructions. Explain every step thoroughly, include safety warnings, and describe wire colors and connections explicitly.'
  : 'Expert fast-track guide. Skip basic explanations. Focus on critical steps, torque specs, firmware configuration, and advanced tuning. Be concise.'}

Respond as JSON with this exact structure:
{
  "title": "Drone Assembly Manual: [descriptive name]",
  "sections": [
    { "title": "Section Name", "steps": ["Step 1...", "Step 2..."] }
  ],
  "warnings": ["Safety warning 1", "Safety warning 2"]
}

Include these sections in order:
1. Tools & Preparation
2. Frame Assembly
3. Motor Installation
4. ESC & Flight Controller Wiring
5. Battery & Power System
6. Camera & VTX Installation
7. Receiver & Final Wiring
8. Pre-Flight Checks & Configuration

Each section should have 3-8 steps. Be specific to the exact parts listed above.`;

  try {
    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content) as GeneratedManual;
      return {
        ...parsed,
        partsList,
      };
    }
  } catch (err) {
    console.error('OpenAI manual generation failed, using fallback:', err);
  }

  return generateFallbackManual(selectedParts, components, detailLevel, partsList);
}

/**
 * Fallback manual if OpenAI is unavailable. Still produces a useful
 * part-specific guide.
 */
function generateFallbackManual(
  selectedParts: SelectedParts,
  components: ComponentWithSpecs[],
  detailLevel: DetailLevel,
  partsList: { category: string; name: string; price: number }[]
): GeneratedManual {
  const frame = selectedParts.frame ? components.find((c) => c.id === selectedParts.frame) : undefined;
  const motor = selectedParts.motor ? components.find((c) => c.id === selectedParts.motor) : undefined;
  const esc = selectedParts.esc ? components.find((c) => c.id === selectedParts.esc) : undefined;
  const fc = selectedParts.flight_controller ? components.find((c) => c.id === selectedParts.flight_controller) : undefined;
  const battery = selectedParts.battery ? components.find((c) => c.id === selectedParts.battery) : undefined;

  const beginner = detailLevel === 'beginner';

  const sections: ManualSection[] = [
    {
      title: 'Tools & Preparation',
      steps: beginner
        ? [
            'Gather: hex drivers (1.5/2/2.5mm), soldering iron (350°C), lead solder 63/37, flux, wire strippers, multimeter, heat shrink tubing.',
            'Clear your workspace and use an anti-static mat for the flight controller.',
            'Organize all parts and verify nothing is missing from your order.',
          ]
        : [
            'Hex drivers, soldering station, flux, multimeter, heat shrink, zip ties.',
            'Verify all parts against the BOM before starting.',
          ],
    },
    {
      title: 'Frame Assembly',
      steps: beginner
        ? [
            `Lay out the ${frame?.name ?? 'frame'} bottom plate. The wheelbase is ${frame?.dimensions_mm ?? '220mm'}.`,
            'Attach the four arms using the included hardware. Tighten in an X-pattern to ensure even seating.',
            'Install the standoffs and top plate. Do not fully tighten until all electronics are mounted.',
          ]
        : [
            `Assemble ${frame?.name ?? 'frame'} — ${frame?.dimensions_mm ?? '220mm'} wheelbase.`,
            'Mount arms and standoffs. Leave top plate loose for wiring access.',
          ],
    },
    {
      title: 'Motor Installation',
      steps: beginner
        ? [
            `Mount each ${motor?.name ?? 'motor'} to the arm tips using the ${motor?.mounting_pattern ?? '16x19'} pattern.`,
            'Route motor wires along the arm channels toward the center.',
            'Use threadlock on motor screws to prevent loosening from vibration.',
          ]
        : [
            `Install ${motor?.name ?? 'motors'} on ${motor?.mounting_pattern ?? '16x19'} mounts.`,
            'Route wires through arm channels. Apply threadlock.',
          ],
    },
    {
      title: 'ESC & Flight Controller Wiring',
      steps: beginner
        ? [
            `Solder the motor wires to the ${esc?.name ?? 'ESC'} pads. Match wire colors: blue=1, black=2, red=3, white=4 (check your motor datasheet).`,
            `Mount the ${esc?.name ?? 'ESC'} on the ${fc?.name ?? 'FC'} stack using ${esc?.mounting_pattern ?? '30.5x30.5'} standoffs.`,
            `Solder the ESC signal wires to the ${fc?.name ?? 'FC'} motor output pads (M1-M4).`,
            'Connect the ESC BEC 5V output to the FC 5V rail. Double-check polarity with a multimeter before powering.',
          ]
        : [
            `Solder motors to ${esc?.name ?? 'ESC'}. Mount ESC+FC stack on ${esc?.mounting_pattern ?? '30.5x30.5'}.`,
            `Wire ESC signal to ${fc?.name ?? 'FC'} M1-M4. Verify BEC 5V polarity.`,
          ],
    },
    {
      title: 'Battery & Power System',
      steps: beginner
        ? [
            `Install the XT60 connector from the ESC to the ${battery?.name ?? 'battery'} lead.`,
            `Verify battery voltage: ${battery?.electrical_specs?.max_voltage_s ?? 6}S = ${((battery?.electrical_specs?.max_voltage_s ?? 6) * 4.2).toFixed(1)}V fully charged.`,
            'Secure the battery with a velcro strap on the top plate. Center it for proper CG balance.',
          ]
        : [
            `Wire XT60. ${battery?.name ?? 'Battery'}: ${battery?.electrical_specs?.max_voltage_s ?? 6}S nominal.`,
            'Secure with velcro, check CG.',
          ],
    },
    {
      title: 'Camera & VTX Installation',
      steps: beginner
        ? [
            'Mount the camera in the front caddle mount. Adjust tilt to 20-30° for freestyle.',
            'Connect the camera signal wire to the VTX video input.',
            'Mount the VTX on the rear of the frame. Route the antenna cable away from the ESC.',
          ]
        : [
            'Mount camera at 20-30° tilt. Wire to VTX.',
            'Mount VTX rear, route antenna clear of ESC.',
          ],
    },
    {
      title: 'Receiver & Final Wiring',
      steps: beginner
        ? [
            'Solder the receiver to the FC UART pads: 5V, GND, TX, RX.',
            'Bind the receiver to your radio transmitter following the manufacturer instructions.',
            'Tidy all wires with zip ties. Ensure no wires touch the propellers.',
          ]
        : [
            'Solder receiver to FC UART. Bind to radio.',
            'Tidy wiring, check prop clearance.',
          ],
    },
    {
      title: 'Pre-Flight Checks & Configuration',
      steps: beginner
        ? [
            'Connect to Betaflight configurator. Flash the latest firmware for your FC.',
            'Configure motor direction and ESC protocol (DSHOT600).',
            'Set up your receiver protocol and verify stick inputs respond correctly.',
            'Set failsafe to cut motors on signal loss.',
            'Do a dry motor test with props OFF. Verify all motors spin in the correct direction.',
            'Install propellers only after all tests pass. Always remove props when making changes.',
          ]
        : [
            'Flash Betaflight. Configure DSHOT600, motor direction.',
            'Set receiver protocol, verify inputs. Configure failsafe.',
            'Dry-run motors (props off). Install props after all tests pass.',
          ],
    },
  ];

  return {
    title: `Drone Assembly Manual — ${frame?.name ?? 'Custom Build'}`,
    sections,
    partsList,
    warnings: [
      'Always remove propellers when testing motors or making wiring changes.',
      'Never short the battery terminals. Check polarity with a multimeter before connecting.',
      'Lithium batteries can catch fire if punctured or over-discharged. Use a fire-safe charging bag.',
    ],
  };
}

// ============================================================
// PDF RENDERING
// ============================================================

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#1a1a2e',
  },
  cover: {
    padding: 60,
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: '#1a1a2e',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 12,
    color: '#0d1b2a',
  },
  subtitle: {
    fontSize: 12,
    color: '#555',
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#0d1b2a',
    marginTop: 20,
    marginBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#0099cc',
    paddingBottom: 4,
  },
  step: {
    fontSize: 11,
    marginBottom: 6,
    lineHeight: 1.5,
    flexDirection: 'row',
  },
  stepNumber: {
    fontFamily: 'Helvetica-Bold',
    color: '#0099cc',
    marginRight: 8,
    minWidth: 18,
  },
  stepText: {
    flex: 1,
  },
  warningBox: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffc107',
    borderWidth: 1,
    borderRadius: 4,
    padding: 10,
    marginBottom: 6,
    flexDirection: 'row',
  },
  warningIcon: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
    color: '#cc8800',
    marginRight: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 10,
    color: '#856404',
  },
  partsHeader: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#0d1b2a',
    marginTop: 20,
    marginBottom: 8,
  },
  partsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  partsCategory: {
    fontSize: 10,
    color: '#666',
    width: 100,
  },
  partsName: {
    fontSize: 10,
    flex: 1,
    marginLeft: 8,
  },
  partsPrice: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    width: 60,
    textAlign: 'right',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#999',
  },
});

/**
 * Render a GeneratedManual as a @react-pdf/renderer Document.
 * This can be used with pdfToBlob in the browser or renderToFile on server.
 */
export function renderManualPDF(manual: GeneratedManual): React.ReactElement {
  return (
    <Document>
      {/* Cover page */}
      <Page size="A4" style={styles.cover}>
        <Text style={styles.title}>{manual.title}</Text>
        <Text style={styles.subtitle}>Custom Assembly Manual — Generated by DroneForge</Text>
        <Text style={styles.partsHeader}>Parts List</Text>
        {manual.partsList.map((part, i) => (
          <View key={i} style={styles.partsRow}>
            <Text style={styles.partsCategory}>{part.category}</Text>
            <Text style={styles.partsName}>{part.name}</Text>
            <Text style={styles.partsPrice}>${part.price.toFixed(2)}</Text>
          </View>
        ))}
        <Text style={styles.partsHeader}>Total Parts: {manual.partsList.length}</Text>
        <Text style={styles.subtitle}>
          Total: ${manual.partsList.reduce((s, p) => s + p.price, 0).toFixed(2)}
        </Text>
      </Page>

      {/* Safety warnings page */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Safety Warnings</Text>
        {manual.warnings.map((warning, i) => (
          <View key={i} style={styles.warningBox}>
            <Text style={styles.warningIcon}>!</Text>
            <Text style={styles.warningText}>{warning}</Text>
          </View>
        ))}
      </Page>

      {/* Assembly sections */}
      {manual.sections.map((section, idx) => (
        <Page key={idx} size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.steps.map((step, stepIdx) => (
            <View key={stepIdx} style={styles.step}>
              <Text style={styles.stepNumber}>{stepIdx + 1}.</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
          <Text style={styles.footer} render={({ pageNumber, totalPages }) => (
            `DroneForge Assembly Manual — Page ${pageNumber} of ${totalPages}`
          )} fixed />
        </Page>
      ))}
    </Document>
  );
}
