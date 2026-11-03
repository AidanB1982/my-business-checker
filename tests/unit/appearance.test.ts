import { describe, expect, it } from 'vitest';
import { defaultAppearance, parseAppearance } from '@/lib/appearance';
describe('stored appearance preferences', () => {
 it('accepts supported independent app and graph choices', () => {
  expect(parseAppearance('{"scheme":"plum","graphs":"ocean"}')).toEqual({ scheme: 'plum', graphs: 'ocean' });
 });
 it('safely restores defaults for damaged or untrusted storage', () => {
  for (const raw of [null, '', 'broken', 'null', '1', '[]', '{"scheme":"<script>","graphs":"url(evil)"}']) expect(parseAppearance(raw)).toEqual(defaultAppearance);
 });
 it('keeps a valid choice when only the other setting is invalid', () => {
  expect(parseAppearance('{"scheme":"ocean","graphs":"unknown"}')).toEqual({ scheme: 'ocean', graphs: 'classic' });
 });
});
