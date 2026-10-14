<?php

namespace App\Seo;

/**
 * Head metadata for one public page (title, description, canonical, Open Graph, JSON-LD).
 */
final class SeoMetadata
{
    /**
     * @param list<array<string, mixed>> $jsonLd
     */
    public function __construct(
        public readonly string $title,
        public readonly string $description,
        public readonly string $canonicalUrl,
        public readonly string $imageUrl,
        public readonly string $type = 'website',
        public readonly bool $indexable = true,
        public readonly array $jsonLd = [],
    ) {}
}
