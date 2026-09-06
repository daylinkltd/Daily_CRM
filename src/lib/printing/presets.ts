// Printing presets — the kinds and their labels, shared by the job
// form, the settings screen and the quick-create dialog. Data lives in
// `printing_presets` (migration 128); this file is just the vocabulary
// ABOUT the vocabulary.

export const PRESET_KINDS = [
  "SIZE",
  "PAPER_TYPE",
  "GSM",
  "PRINT_TYPE",
  "COLOR_MODE",
  "FINISHING",
  "UNIT",
] as const;
export type PresetKind = (typeof PRESET_KINDS)[number];

export const PRESET_KIND_LABELS: Record<PresetKind, string> = {
  SIZE: "Sizes",
  PAPER_TYPE: "Paper types",
  GSM: "GSM weights",
  PRINT_TYPE: "Print types",
  COLOR_MODE: "Colour modes",
  FINISHING: "Finishing options",
  UNIT: "Units",
};

/** Singular, for "+ Add {noun}" buttons and dialog titles. */
export const PRESET_KIND_NOUN: Record<PresetKind, string> = {
  SIZE: "size",
  PAPER_TYPE: "paper type",
  GSM: "GSM weight",
  PRINT_TYPE: "print type",
  COLOR_MODE: "colour mode",
  FINISHING: "finishing option",
  UNIT: "unit",
};

export interface PrintingPreset {
  id: string;
  kind: PresetKind;
  label: string;
  sort_order: number;
  active: boolean;
}

/** Group a flat preset list by kind, keeping sort order. */
export function groupPresets(
  rows: readonly PrintingPreset[],
): Record<PresetKind, PrintingPreset[]> {
  const out = Object.fromEntries(
    PRESET_KINDS.map((k) => [k, [] as PrintingPreset[]]),
  ) as unknown as Record<PresetKind, PrintingPreset[]>;
  for (const row of rows) {
    if (out[row.kind]) out[row.kind].push(row);
  }
  return out;
}
