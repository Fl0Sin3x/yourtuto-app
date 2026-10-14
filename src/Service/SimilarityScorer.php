<?php

namespace App\Service;

use App\Entity\Tutorial;

/**
 * Content-based similarity between tutorials (no ML, explainable):
 * shared tags x3, shared categories x2, same source +1, same difficulty +1, title word overlap (Jaccard) x4.
 */
final class SimilarityScorer
{
    private const STOP = ['le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'en', 'pour', 'avec', 'the', 'a', 'an', 'and', 'to', 'of', 'in', 'how', 'with', 'guide', 'tutoriel', 'tutorial', 'tuto', 'complet', 'débuter', 'débutant', 'débutants', 'introduction'];

    public function score(Tutorial $a, Tutorial $b): float
    {
        $tagsA = $this->ids($a->getTags());
        $tagsB = $this->ids($b->getTags());
        $catsA = $this->ids($a->getCategories());
        $catsB = $this->ids($b->getCategories());

        $score  = 3 * count(array_intersect($tagsA, $tagsB));
        $score += 2 * count(array_intersect($catsA, $catsB));
        $score += $a->getSource() === $b->getSource() ? 1 : 0;
        $score += ($a->getDifficulty() && $a->getDifficulty() === $b->getDifficulty()) ? 1 : 0;
        $score += 4 * $this->jaccard($this->words((string) $a->getTitle()), $this->words((string) $b->getTitle()));

        return round($score, 3);
    }

    /**
     * @param iterable<Tutorial> $candidates
     *
     * @return list<Tutorial> best matches first (score > 0), excluding $base itself
     */
    public function rank(Tutorial $base, iterable $candidates, int $limit = 6): array
    {
        $scored = [];
        foreach ($candidates as $c) {
            if ($c->getId() === $base->getId()) {
                continue;
            }
            $s = $this->score($base, $c);
            if ($s > 0) {
                $scored[$c->getId() ?? spl_object_id($c)] = [$s, $c->getViewCount(), $c];
            }
        }
        uasort($scored, fn ($x, $y) => [$y[0], $y[1]] <=> [$x[0], $x[1]]);

        return array_slice(array_values(array_map(fn ($x) => $x[2], $scored)), 0, $limit);
    }

    /** @return list<string> */
    public function words(string $title): array
    {
        $parts = preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($title)) ?: [];

        return array_values(array_unique(array_filter($parts, fn ($w) => mb_strlen($w) > 2 && !in_array($w, self::STOP, true))));
    }

    private function jaccard(array $a, array $b): float
    {
        if (!$a || !$b) {
            return 0.0;
        }

        return count(array_intersect($a, $b)) / count(array_unique(array_merge($a, $b)));
    }

    /** @return list<int> */
    private function ids(iterable $items): array
    {
        $ids = [];
        foreach ($items as $i) {
            $ids[] = (int) $i->getId();
        }

        return $ids;
    }
}
