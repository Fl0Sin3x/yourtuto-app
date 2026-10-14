<?php

namespace App\Seo;

/**
 * Injects page-specific <head> tags into the built SPA shell (public/index.html).
 *
 * Tags are marked with data-seo so the React app can replace them on client-side navigation.
 */
final class HeadRenderer
{
    private const START = '<!--seo:start-->';
    private const END   = '<!--seo:end-->';

    private const FALLBACK_SHELL = '<!doctype html><html lang="fr"><head><meta charset="UTF-8" />'
        . self::START . '<title>YourTuto</title>' . self::END
        . '</head><body><div id="root"></div></body></html>';

    public function __construct(private readonly string $shellPath) {}

    public function render(SeoMetadata $meta): string
    {
        $html = is_file($this->shellPath) ? (string) file_get_contents($this->shellPath) : self::FALLBACK_SHELL;
        $tags = self::START . "\n" . $this->tags($meta) . "\n    " . self::END;

        $start = strpos($html, self::START);
        $end   = strpos($html, self::END);
        if ($start !== false && $end !== false && $end > $start) {
            return substr($html, 0, $start) . $tags . substr($html, $end + strlen(self::END));
        }

        // Older shell without markers: replace the <title> element
        $replaced = preg_replace('#<title>.*?</title>#s', $tags, $html, 1, $count);

        return $count ? (string) $replaced : str_replace('</head>', $tags . '</head>', $html);
    }

    public function tags(SeoMetadata $meta): string
    {
        $e = static fn (string $v): string => htmlspecialchars($v, \ENT_QUOTES | \ENT_HTML5, 'UTF-8');

        $lines = [
            sprintf('<title data-seo>%s</title>', $e($meta->title)),
            sprintf('<meta data-seo name="description" content="%s" />', $e($meta->description)),
            sprintf('<meta data-seo name="robots" content="%s" />', $meta->indexable ? 'index, follow' : 'noindex, follow'),
            sprintf('<link data-seo rel="canonical" href="%s" />', $e($meta->canonicalUrl)),
            sprintf('<meta data-seo property="og:site_name" content="%s" />', SeoMetadataFactory::SITE_NAME),
            sprintf('<meta data-seo property="og:type" content="%s" />', $e($meta->type)),
            sprintf('<meta data-seo property="og:title" content="%s" />', $e($meta->title)),
            sprintf('<meta data-seo property="og:description" content="%s" />', $e($meta->description)),
            sprintf('<meta data-seo property="og:url" content="%s" />', $e($meta->canonicalUrl)),
            sprintf('<meta data-seo property="og:image" content="%s" />', $e($meta->imageUrl)),
            '<meta data-seo property="og:locale" content="fr_FR" />',
            '<meta data-seo name="twitter:card" content="summary_large_image" />',
            sprintf('<meta data-seo name="twitter:title" content="%s" />', $e($meta->title)),
            sprintf('<meta data-seo name="twitter:description" content="%s" />', $e($meta->description)),
            sprintf('<meta data-seo name="twitter:image" content="%s" />', $e($meta->imageUrl)),
        ];

        foreach ($meta->jsonLd as $data) {
            $json = json_encode($data, \JSON_UNESCAPED_SLASHES | \JSON_UNESCAPED_UNICODE | \JSON_HEX_TAG | \JSON_HEX_AMP);
            $lines[] = '<script data-seo type="application/ld+json">' . $json . '</script>';
        }

        return '    ' . implode("\n    ", $lines);
    }
}
