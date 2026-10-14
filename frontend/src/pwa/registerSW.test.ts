import { describe, expect, it, vi } from 'vitest';
import manifestRaw from '../../public/manifest.webmanifest?raw';
import { registerSW } from './registerSW';

describe('PWA', () => {
  it('does not register outside production', () => {
    expect(registerSW({ PROD: false })).toBe(false);
  });

  it('registers /sw.js on load in production', () => {
    const register = vi.fn().mockResolvedValue({});
    const nav = { serviceWorker: { register } } as unknown as Navigator;
    expect(registerSW({ PROD: true }, nav)).toBe(true);
    window.dispatchEvent(new Event('load'));
    expect(register).toHaveBeenCalledWith('/sw.js');
  });

  it('ships an installable manifest', () => {
    const m = JSON.parse(manifestRaw);
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBeTruthy();
    expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  });
});
