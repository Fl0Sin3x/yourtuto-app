<?php

namespace App\Seo;

use App\Entity\Tutorial;
use App\Enum\TutorialSource;

/**
 * Builds per-page SEO metadata. The public base URL comes from the SITE_URL env var.
 */
final class SeoMetadataFactory
{
    public const SITE_NAME = 'YourTuto';

    private const DEFAULT_DESCRIPTION = 'YourTuto rassemble les meilleurs tutoriels dev, IA, bricolage et cuisine : '
        . 'YouTube, DEV.to, Reddit, recettes et tutoriels de la communauté, au même endroit.';

    /** Category landing pages (/category/{source}), mirrors frontend CategoryPage. */
    public const CATEGORIES = [
        'dev'       => ['Développement', 'Code, frameworks, outils et tutoriels techniques'],
        'recipe'    => ['Cuisine', 'Recettes, techniques culinaires et idées repas'],
        'generated' => ['Bricolage', 'DIY, réparations, projets et tutoriels manuels'],
        'community' => ['Communauté', 'Tutoriels partagés par la communauté YourTuto'],
        'youtube'   => ['YouTube', 'Les meilleures vidéos éducatives sélectionnées'],
        'devto'     => ['DEV.to & Reddit', 'Articles et discussions tech de la communauté dev'],
    ];

    /** Sources rendered on our own /tutorials/{id} page (others link out). */
    public const INTERNAL_SOURCES = [TutorialSource::Community, TutorialSource::Generated, TutorialSource::Dev];

    private readonly string $siteUrl;

    public function __construct(string $siteUrl)
    {
        $this->siteUrl = rtrim($siteUrl, '/');
    }

    public function siteUrl(): string
    {
        return $this->siteUrl;
    }

    public function url(string $path): string
    {
        return $this->siteUrl . '/' . ltrim($path, '/');
    }

    public static function tutorialPath(Tutorial $tutorial): string
    {
        return sprintf('/tutorials/%d/%s', $tutorial->getId(), $tutorial->getSlug());
    }

    public function home(): SeoMetadata
    {
        return new SeoMetadata(
            title: 'YourTuto · Tous les meilleurs tutoriels au même endroit',
            description: self::DEFAULT_DESCRIPTION,
            canonicalUrl: $this->url('/'),
            imageUrl: $this->defaultImage(),
            jsonLd: [[
                '@context'        => 'https://schema.org',
                '@type'           => 'WebSite',
                'name'            => self::SITE_NAME,
                'url'             => $this->url('/'),
                'inLanguage'      => 'fr',
                'potentialAction' => [
                    '@type'       => 'SearchAction',
                    'target'      => $this->url('/tutorials') . '?search={search_term_string}',
                    'query-input' => 'required name=search_term_string',
                ],
            ]],
        );
    }

    public function tutorialIndex(): SeoMetadata
    {
        return new SeoMetadata(
            title: 'Tous les tutoriels · YourTuto',
            description: 'Parcourez des milliers de tutoriels : développement, IA, bricolage, cuisine et plus encore.',
            canonicalUrl: $this->url('/tutorials'),
            imageUrl: $this->defaultImage(),
        );
    }

    public function category(string $source): ?SeoMetadata
    {
        if (!isset(self::CATEGORIES[$source])) {
            return null;
        }
        [$label, $desc] = self::CATEGORIES[$source];
        $url = $this->url('/category/' . $source);

        return new SeoMetadata(
            title: sprintf('Tutoriels %s · YourTuto', $label),
            description: $desc . ' : sélection YourTuto.',
            canonicalUrl: $url,
            imageUrl: $this->defaultImage(),
            jsonLd: [
                ['@context' => 'https://schema.org', '@type' => 'CollectionPage', 'name' => $label, 'description' => $desc, 'url' => $url],
                $this->breadcrumb([['YourTuto', $this->url('/')], [$label, $url]]),
            ],
        );
    }

    public function tutorial(Tutorial $tutorial): SeoMetadata
    {
        $url         = $this->url(self::tutorialPath($tutorial));
        $description = $this->summarize($tutorial->getDescription() ?: $tutorial->getContent() ?: self::DEFAULT_DESCRIPTION);
        $image       = $tutorial->getThumbnailUrl() ?: $this->defaultImage();

        $article = [
            '@context'      => 'https://schema.org',
            '@type'         => 'Article',
            'headline'      => mb_substr((string) $tutorial->getTitle(), 0, 110),
            'description'   => $description,
            'image'         => [$image],
            'url'           => $url,
            'mainEntityOfPage' => $url,
            'inLanguage'    => 'fr',
            'datePublished' => $tutorial->getCreatedAt()->format(\DATE_ATOM),
            'dateModified'  => ($tutorial->getUpdatedAt() ?? $tutorial->getCreatedAt())->format(\DATE_ATOM),
            'publisher'     => ['@type' => 'Organization', 'name' => self::SITE_NAME, 'url' => $this->url('/')],
        ];
        if ($tutorial->getAuthor()) {
            $article['author'] = ['@type' => 'Person', 'name' => (string) $tutorial->getAuthor()->getUsername()];
        }

        $crumbs = [['YourTuto', $this->url('/')], ['Tutoriels', $this->url('/tutorials')]];
        $source = $tutorial->getSource()->value;
        if (isset(self::CATEGORIES[$source])) {
            $crumbs[] = [self::CATEGORIES[$source][0], $this->url('/category/' . $source)];
        }
        $crumbs[] = [(string) $tutorial->getTitle(), $url];

        return new SeoMetadata(
            title: $this->truncate((string) $tutorial->getTitle(), 60) . ' · YourTuto',
            description: $description,
            canonicalUrl: $url,
            imageUrl: $image,
            type: 'article',
            indexable: $tutorial->isPublished(),
            jsonLd: [$article, $this->breadcrumb($crumbs)],
        );
    }

    public function pathIndex(): SeoMetadata
    {
        return new SeoMetadata(
            title: "Parcours d'apprentissage · YourTuto",
            description: "Des parcours guidés, étape par étape, pour apprendre l'IA, le frontend, le backend et les outils du développeur.",
            canonicalUrl: $this->url('/paths'),
            imageUrl: $this->defaultImage(),
        );
    }

    public function learningPath(\App\Entity\LearningPath $path): SeoMetadata
    {
        $url = $this->url('/paths/' . $path->getSlug());

        return new SeoMetadata(
            title: 'Parcours : ' . $this->truncate($path->getTitle(), 50) . ' · YourTuto',
            description: $this->truncate($path->getDescription() ?: sprintf('Parcours en %d étapes.', count($path->getTutorialIds())), 160),
            canonicalUrl: $url,
            imageUrl: $this->defaultImage(),
            jsonLd: [
                ['@context' => 'https://schema.org', '@type' => 'Course', 'name' => $path->getTitle(), 'description' => (string) $path->getDescription(), 'url' => $url,
                 'provider' => ['@type' => 'Organization', 'name' => self::SITE_NAME, 'url' => $this->url('/')]],
                $this->breadcrumb([['YourTuto', $this->url('/')], ['Parcours', $this->url('/paths')], [$path->getTitle(), $url]]),
            ],
        );
    }

    public function collection(\App\Entity\TutorialCollection $c): SeoMetadata
    {
        $url   = $this->url('/c/' . $c->getSlug());
        $owner = (string) ($c->getOwner()->getUsername() ?? 'un membre');

        return new SeoMetadata(
            title: 'Collection : ' . $this->truncate($c->getTitle(), 50) . ' · YourTuto',
            description: $this->truncate($c->getDescription() ?: sprintf('%d tutoriels sélectionnés par %s sur YourTuto.', count($c->getTutorialIds()), $owner), 160),
            canonicalUrl: $url,
            imageUrl: $this->defaultImage(),
            jsonLd: [
                ['@context' => 'https://schema.org', '@type' => 'CollectionPage', 'name' => $c->getTitle(), 'url' => $url,
                 'description' => (string) $c->getDescription(), 'numberOfItems' => count($c->getTutorialIds())],
                $this->breadcrumb([['YourTuto', $this->url('/')], [$c->getTitle(), $url]]),
            ],
        );
    }

    public function statsPage(): SeoMetadata
    {
        return new SeoMetadata(
            title: 'YourTuto en chiffres · Statistiques du catalogue',
            description: 'Tutoriels par source et par niveau, tags les plus populaires, tutos les plus vus et activité de la communauté YourTuto.',
            canonicalUrl: $this->url('/stats'),
            imageUrl: $this->defaultImage(),
        );
    }

    public function notFound(string $path): SeoMetadata
    {
        return new SeoMetadata(
            title: 'Page introuvable · YourTuto',
            description: self::DEFAULT_DESCRIPTION,
            canonicalUrl: $this->url($path),
            imageUrl: $this->defaultImage(),
            indexable: false,
        );
    }

    private function defaultImage(): string
    {
        return $this->url('/Yourtuto.jpg');
    }

    /** @param list<array{0: string, 1: string}> $items */
    private function breadcrumb(array $items): array
    {
        $list = [];
        foreach ($items as $i => [$name, $url]) {
            $list[] = ['@type' => 'ListItem', 'position' => $i + 1, 'name' => $name, 'item' => $url];
        }

        return ['@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => $list];
    }

    private function summarize(string $text): string
    {
        // Strip markdown/HTML noise and collapse whitespace
        $plain = strip_tags($text);
        $plain = preg_replace('/[#*_`>\[\]()!]+/u', ' ', $plain) ?? $plain;
        $plain = trim(preg_replace('/\s+/u', ' ', $plain) ?? $plain);

        return $this->truncate($plain, 160);
    }

    private function truncate(string $text, int $max): string
    {
        if (mb_strlen($text) <= $max) {
            return $text;
        }
        $cut = mb_substr($text, 0, $max - 1);
        $space = mb_strrpos($cut, ' ');

        return rtrim($space > $max * 0.6 ? mb_substr($cut, 0, $space) : $cut, " ,.;:-") . '…';
    }
}
