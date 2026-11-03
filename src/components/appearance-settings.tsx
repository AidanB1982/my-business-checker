'use client';
import { useEffect, useState } from 'react';
import { appearanceKey, appearanceSchemes, graphPalettes, defaultAppearance, parseAppearance, applyAppearance, type Appearance } from '@/lib/appearance';
export function AppearanceSettings() {
 const [value, setValue] = useState<Appearance>(defaultAppearance);
 const [message, setMessage] = useState('');
 useEffect(() => {
  const sync = () => { try { const next = parseAppearance(localStorage.getItem(appearanceKey)); setValue(next); applyAppearance(next); } catch { /* Storage may be disabled. */ } };
  sync(); window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync);
 }, []);
 function update(next: Appearance) {
  setValue(next); applyAppearance(next);
  try { localStorage.setItem(appearanceKey, JSON.stringify(next)); setMessage('Appearance saved on this browser.'); }
  catch { setMessage('Appearance applied. Your browser could not save it for next time.'); }
 }
 return <details className="appearance-settings"><summary>Colours & graphs</summary><div className="appearance-options"><p>Choose your app colours and a separate graph palette. These preferences are saved on this browser.</p><label>App colour scheme<select value={value.scheme} onChange={e => update({ ...value, scheme: e.target.value as Appearance['scheme'] })}>{appearanceSchemes.map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</select></label><label>Graph colours<select value={value.graphs} onChange={e => update({ ...value, graphs: e.target.value as Appearance['graphs'] })}>{graphPalettes.map(s => <option key={s} value={s}>{s === 'classic' ? 'Forest & gold' : s === 'ocean' ? 'Blue & orange' : 'Violet & teal'}</option>)}</select></label><div className="palette-preview" aria-label="Graph palette preview"><span>Income / series 1</span><span>Costs / series 2</span><span>Negative values</span></div><button type="button" className="text-link" onClick={() => update({ ...defaultAppearance })}>Reset colours</button><p role="status" className="fine">{message}</p></div></details>;
}
/** Apply stored colours on every page, including before visiting the workspace. */
export function AppearanceLoader() {
 useEffect(() => {
  const sync = () => { try { applyAppearance(parseAppearance(localStorage.getItem(appearanceKey))); } catch { /* Keep defaults if storage is unavailable. */ } };
  sync(); window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync);
 }, []);
 return null;
}
