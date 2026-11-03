export const appearanceSchemes = ['forest', 'ocean', 'plum', 'cream', 'sky', 'rose'] as const;
export const appearanceLabels: Record<typeof appearanceSchemes[number], string> = { forest: 'Forest', ocean: 'Ocean', plum: 'Plum', cream: 'Warm cream', sky: 'Pale sky', rose: 'Soft rose' };
export const graphPalettes = ['classic', 'ocean', 'violet'] as const;
export type Appearance = { scheme: typeof appearanceSchemes[number]; graphs: typeof graphPalettes[number] };
export const appearanceKey = 'mbc-appearance-v1';
export const defaultAppearance: Appearance = { scheme: 'forest', graphs: 'classic' };
export function parseAppearance(raw: string | null): Appearance {
 try {
  const value: unknown = JSON.parse(raw ?? 'null');
  if (!value || typeof value !== 'object') return { ...defaultAppearance };
  const { scheme, graphs } = value as Record<string, unknown>;
  return {
   scheme: appearanceSchemes.includes(scheme as Appearance['scheme']) ? scheme as Appearance['scheme'] : 'forest',
   graphs: graphPalettes.includes(graphs as Appearance['graphs']) ? graphs as Appearance['graphs'] : 'classic',
  };
 } catch { return { ...defaultAppearance }; }
}
export function applyAppearance(value: Appearance) {
 document.documentElement.dataset.scheme = value.scheme;
 document.documentElement.dataset.graphs = value.graphs;
}
