import { useEffect } from 'react';
import { SITE_NAME, absoluteUrl, truncate } from './url';

interface SeoProps {
  title: string;
  description: string;
  /** Path ("/tutorials/1/foo") or absolute URL */
  canonical: string;
  image?: string | null;
  type?: 'website' | 'article';
  noindex?: boolean;
  jsonLd?: Record<string, unknown>[];
}

/**
 * Per-page head tags using React 19 native metadata hoisting.
 * The server pre-renders the same tags (marked data-seo) for crawlers; they are removed
 * on first client render so tags are never duplicated.
 */
export function Seo({ title, description, canonical, image, type = 'website', noindex = false, jsonLd = [] }: SeoProps) {
  useEffect(() => {
    document.head.querySelectorAll('[data-seo]').forEach((el) => el.remove());
  }, []);

  const fullTitle = title.includes(SITE_NAME) ? title : `${title} · ${SITE_NAME}`;
  const url = absoluteUrl(canonical);
  const img = absoluteUrl(image || '/Yourtuto.jpg');
  const desc = truncate(description, 160);

  return (
    <>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <meta name="robots" content={noindex ? 'noindex, follow' : 'index, follow'} />
      <link rel="canonical" href={url} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={img} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={img} />
      {jsonLd.map((data, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(data).replace(/</g, '\\u003c')}</script>
      ))}
    </>
  );
}
