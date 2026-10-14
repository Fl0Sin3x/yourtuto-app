<?php

namespace App\Controller;

use App\Repository\LearningPathRepository;
use App\Repository\TutorialRepository;
use App\Seo\HeadRenderer;
use App\Seo\SeoMetadata;
use App\Seo\SeoMetadataFactory;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;

/**
 * SEO endpoints: sitemap.xml, robots.txt, and "SSR-lite" for the public SPA pages
 * (the built index.html is served with page-specific <head> tags already filled in).
 */
final class SeoController extends AbstractController
{
    private const SITEMAP_LIMIT = 45000;

    public function __construct(
        private readonly SeoMetadataFactory $seo,
        private readonly HeadRenderer $head,
        private readonly TutorialRepository $tutorials,
        private readonly CacheInterface $cache,
        private readonly LearningPathRepository $paths,
        private readonly \App\Repository\TutorialCollectionRepository $collections,
    ) {}

    #[Route('/robots.txt', name: 'seo_robots', methods: ['GET', 'HEAD'])]
    public function robots(): Response
    {
        $body = implode("\n", [
            'User-agent: *',
            'Allow: /',
            'Disallow: /api/',
            'Disallow: /admin',
            'Disallow: /auth/',
            'Disallow: /profile',
            'Disallow: /my-tutorials',
            'Disallow: /my-progress',
            'Disallow: /favorites',
            'Disallow: /tutorials/create',
            'Disallow: /*/edit$',
            'Disallow: /login',
            'Disallow: /register',
            'Disallow: /forgot-password',
            'Disallow: /reset-password',
            '',
            'Sitemap: ' . $this->seo->url('/sitemap.xml'),
            '',
        ]);

        return $this->cached(new Response($body, 200, ['Content-Type' => 'text/plain; charset=UTF-8']));
    }

    #[Route('/sitemap.xml', name: 'seo_sitemap', methods: ['GET', 'HEAD'])]
    public function sitemap(): Response
    {
        $body = $this->cache->get('seo_sitemap_xml', function (ItemInterface $item): string {
            $item->expiresAfter(3600);

            return $this->buildSitemap();
        });

        return $this->cached(new Response($body, 200, ['Content-Type' => 'application/xml; charset=UTF-8']));
    }

    private function buildSitemap(): string
    {
        $xml = new \XMLWriter();
        $xml->openMemory();
        $xml->startDocument('1.0', 'UTF-8');
        $xml->startElement('urlset');
        $xml->writeAttribute('xmlns', 'http://www.sitemaps.org/schemas/sitemap/0.9');

        $add = static function (string $loc, ?\DateTimeInterface $lastmod, string $freq, string $priority) use ($xml): void {
            $xml->startElement('url');
            $xml->writeElement('loc', $loc);
            if ($lastmod) {
                $xml->writeElement('lastmod', $lastmod->format('Y-m-d'));
            }
            $xml->writeElement('changefreq', $freq);
            $xml->writeElement('priority', $priority);
            $xml->endElement();
        };

        $add($this->seo->url('/'), null, 'daily', '1.0');
        $add($this->seo->url('/tutorials'), null, 'daily', '0.8');
        $add($this->seo->url('/paths'), null, 'weekly', '0.8');
        $add($this->seo->url('/stats'), null, 'daily', '0.4');
        foreach ($this->paths->findPublished() as $p) {
            $add($this->seo->url('/paths/' . $p->getSlug()), null, 'weekly', '0.8');
        }
        foreach ($this->collections->publicSlugs() as $c) {
            $add($this->seo->url('/c/' . $c['slug']), $c['updatedAt'], 'weekly', '0.5');
        }
        foreach (array_keys(SeoMetadataFactory::CATEGORIES) as $source) {
            $add($this->seo->url('/category/' . $source), null, 'daily', '0.7');
        }

        // Scalar query (no entity hydration / eager joins): fast even with tens of thousands of rows
        $rows = $this->tutorials->createQueryBuilder('t')
            ->select('t.id', 't.slug', 't.createdAt', 't.updatedAt')
            ->where('t.published = true')
            ->andWhere('t.source IN (:sources)')
            ->setParameter('sources', array_map(static fn ($s) => $s->value, SeoMetadataFactory::INTERNAL_SOURCES))
            ->orderBy('t.id', 'DESC')
            ->setMaxResults(self::SITEMAP_LIMIT)
            ->getQuery()->getArrayResult();

        foreach ($rows as $r) {
            $add($this->seo->url(sprintf('/tutorials/%d/%s', $r['id'], $r['slug'])), $r['updatedAt'] ?? $r['createdAt'], 'weekly', '0.6');
        }

        $xml->endElement();
        $xml->endDocument();

        return $xml->outputMemory();
    }

    #[Route('/', name: 'seo_page_home', methods: ['GET', 'HEAD'])]
    public function home(): Response
    {
        return $this->page($this->seo->home());
    }

    #[Route('/tutorials', name: 'seo_page_tutorials', methods: ['GET', 'HEAD'])]
    public function tutorialIndex(): Response
    {
        return $this->page($this->seo->tutorialIndex());
    }

    #[Route('/paths', name: 'seo_page_paths', methods: ['GET', 'HEAD'])]
    public function pathIndex(): Response
    {
        return $this->page($this->seo->pathIndex());
    }

    #[Route('/paths/{slug}', name: 'seo_page_path', requirements: ['slug' => '[a-z0-9-]+'], methods: ['GET', 'HEAD'])]
    public function learningPath(string $slug): Response
    {
        $path = $this->paths->findOneBy(['slug' => $slug, 'published' => true]);

        return $path ? $this->page($this->seo->learningPath($path)) : $this->page($this->seo->notFound('/paths/' . $slug), 404);
    }

    #[Route('/stats', name: 'seo_page_stats', methods: ['GET', 'HEAD'])]
    public function stats(): Response
    {
        return $this->page($this->seo->statsPage());
    }

    #[Route('/c/{slug}', name: 'seo_page_collection', requirements: ['slug' => '[a-z0-9-]+'], methods: ['GET', 'HEAD'])]
    public function collection(string $slug): Response
    {
        $c = $this->collections->findOneBy(['slug' => $slug, 'public' => true]);

        return $c ? $this->page($this->seo->collection($c)) : $this->page($this->seo->notFound('/c/' . $slug), 404);
    }

    #[Route('/category/{source}', name: 'seo_page_category', methods: ['GET', 'HEAD'])]
    public function category(string $source): Response
    {
        $meta = $this->seo->category($source);

        return $meta ? $this->page($meta) : $this->page($this->seo->notFound('/category/' . $source), 404);
    }

    #[Route('/tutorials/{id}/{slug}', name: 'seo_page_tutorial', requirements: ['id' => '\d+', 'slug' => '(?!edit(?![a-z0-9-]))[a-z0-9-]+'], defaults: ['slug' => null], methods: ['GET', 'HEAD'])]
    public function tutorial(int $id, ?string $slug): Response
    {
        $tutorial = $this->tutorials->find($id);
        if (!$tutorial) {
            return $this->page($this->seo->notFound('/tutorials/' . $id), 404);
        }

        // Clean URLs: /tutorials/{id} or a stale slug -> 301 to /tutorials/{id}/{slug}
        if ($tutorial->getSlug() && $slug !== $tutorial->getSlug()) {
            return new RedirectResponse(SeoMetadataFactory::tutorialPath($tutorial), 301);
        }

        return $this->page($this->seo->tutorial($tutorial));
    }

    private function page(SeoMetadata $meta, int $status = 200): Response
    {
        $response = new Response($this->head->render($meta), $status, ['Content-Type' => 'text/html; charset=UTF-8']);
        if (!$meta->indexable) {
            $response->headers->set('X-Robots-Tag', 'noindex');
        }

        return $this->cached($response, 300);
    }

    private function cached(Response $response, int $maxAge = 3600): Response
    {
        $response->setPublic();
        $response->setMaxAge($maxAge);
        $response->setSharedMaxAge($maxAge);

        return $response;
    }
}
