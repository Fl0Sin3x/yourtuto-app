<?php

namespace App\Service\Stats;

use Doctrine\DBAL\Connection;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;

/**
 * Site-wide catalogue & community numbers for the public /stats dashboard (aggregate SQL, cached 1h).
 */
final class CatalogStats
{
    public function __construct(
        private readonly Connection $db,
        private readonly CacheInterface $cache,
    ) {}

    public function overview(): array
    {
        return $this->cache->get('catalog_stats_overview', function (ItemInterface $item): array {
            $item->expiresAfter(3600);

            return $this->compute();
        });
    }

    public function compute(?\DateTimeImmutable $now = null): array
    {
        $now     = $now ?? new \DateTimeImmutable();
        $weekAgo = $now->modify('-7 days')->format('Y-m-d H:i:s');
        $int     = static fn ($v): int => (int) $v;

        $pairs = fn (string $sql, array $p = []): array => array_map(
            fn (array $r) => ['label' => (string) $r['label'], 'count' => (int) $r['n']],
            $this->db->fetchAllAssociative($sql, $p),
        );

        return [
            'totals' => [
                'tutorials'         => $int($this->db->fetchOne('SELECT COUNT(*) FROM tutorial WHERE published = true')),
                'newThisWeek'       => $int($this->db->fetchOne('SELECT COUNT(*) FROM tutorial WHERE published = true AND created_at >= :d', ['d' => $weekAgo])),
                'views'             => $int($this->db->fetchOne('SELECT COALESCE(SUM(view_count), 0) FROM tutorial WHERE published = true')),
                'paths'             => $int($this->db->fetchOne('SELECT COUNT(*) FROM learning_path WHERE published = true')),
                'publicCollections' => $int($this->db->fetchOne('SELECT COUNT(*) FROM tutorial_collection WHERE public = true')),
                'learners'          => $int($this->db->fetchOne('SELECT COUNT(DISTINCT user_id) FROM user_progress WHERE is_done = true')),
                'completionsWeek'   => $int($this->db->fetchOne('SELECT COUNT(*) FROM user_progress WHERE is_done = true AND completed_at >= :d', ['d' => $weekAgo])),
            ],
            'bySource'     => $pairs('SELECT source AS label, COUNT(*) AS n FROM tutorial WHERE published = true GROUP BY source ORDER BY n DESC'),
            'byDifficulty' => $pairs("SELECT COALESCE(NULLIF(difficulty, ''), 'non précisé') AS label, COUNT(*) AS n FROM tutorial WHERE published = true GROUP BY 1 ORDER BY n DESC"),
            'topTags'      => $pairs('SELECT tg.name AS label, COUNT(*) AS n FROM tutorial_tag tt JOIN tag tg ON tg.id = tt.tag_id JOIN tutorial t ON t.id = tt.tutorial_id AND t.published = true GROUP BY tg.name ORDER BY n DESC, tg.name LIMIT 12'),
            'mostViewed'   => array_map(
                fn (array $r) => ['id' => (int) $r['id'], 'slug' => (string) $r['slug'], 'title' => (string) $r['title'], 'viewCount' => (int) $r['view_count']],
                $this->db->fetchAllAssociative('SELECT id, slug, title, view_count FROM tutorial WHERE published = true ORDER BY view_count DESC, id DESC LIMIT 5'),
            ),
            'generatedAt' => $now->format(\DATE_ATOM),
        ];
    }
}
