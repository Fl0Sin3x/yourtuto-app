export const SITE_NAME = 'YourTuto';

/** Public base URL (VITE_SITE_URL), falling back to the current origin. */
export function siteUrl(): string {
  const env = import.meta.env.VITE_SITE_URL as string | undefined;
  const base = env && env.length > 0 ? env : (typeof window !== 'undefined' ? window.location.origin : '');
  return base.replace(/\/+$/, '');
}

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${siteUrl()}/${path.replace(/^\/+/, '')}`;
}

export function truncate(text: string, max: number): string {
  const plain = text.replace(/[#*_`>[\]()!]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:-]+$/, '')}…`;
}

export function tutorialPath(t: { id: number; slug?: string | null }): string {
  return t.slug ? `/tutorials/${t.id}/${t.slug}` : `/tutorials/${t.id}`;
}
