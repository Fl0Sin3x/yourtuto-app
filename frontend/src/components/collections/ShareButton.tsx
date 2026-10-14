import { useState } from 'react';
import { absoluteUrl } from '../../seo/url';

/** Native share sheet when available (mobile), clipboard copy otherwise. */
export function ShareButton({ path, title, className = '' }: { path: string; title: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = absoluteUrl(path);
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* user cancelled */
    }
  };

  return (
    <button type="button" onClick={share} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${className}`}>
      <span aria-hidden="true">🔗</span>
      <span aria-live="polite">{copied ? 'Lien copié !' : 'Partager'}</span>
    </button>
  );
}
