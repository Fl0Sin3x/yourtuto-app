import { describe, expect, it } from 'vitest';
import { absoluteUrl, truncate, tutorialPath } from './url';

describe('seo url helpers', () => {
  it('builds clean tutorial paths with the slug', () => {
    expect(tutorialPath({ id: 7, slug: 'intro-react' })).toBe('/tutorials/7/intro-react');
    expect(tutorialPath({ id: 7, slug: null })).toBe('/tutorials/7');
  });

  it('makes absolute URLs from paths and keeps absolute ones', () => {
    expect(absoluteUrl('/tutorials')).toBe(`${window.location.origin}/tutorials`);
    expect(absoluteUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
  });

  it('truncates long text on a word boundary and strips markdown', () => {
    const out = truncate('## Title **bold** ' + 'word '.repeat(60), 50);
    expect(out.length).toBeLessThanOrEqual(50);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toMatch(/[#*]/);
  });
});
