<?php

namespace App\Controller;

use App\Service\DevToFetcher;
use App\Service\MealDBFetcher;
use App\Service\MediumFetcher;
use App\Service\QueryTranslator;
use App\Service\RedditFetcher;
use App\Service\SpoonacularFetcher;
use App\Service\YouTubeFetcher;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;

#[Route('/api/live-search', methods: ['GET'])]
class LiveSearchController extends AbstractController
{
    public function __construct(
        private readonly YouTubeFetcher     $youtubeFetcher,
        private readonly DevToFetcher       $devToFetcher,
        private readonly RedditFetcher      $redditFetcher,
        private readonly MediumFetcher      $mediumFetcher,
        private readonly SpoonacularFetcher $spoonacularFetcher,
        private readonly MealDBFetcher      $mealDBFetcher,
        private readonly QueryTranslator    $queryTranslator,
        private readonly CacheInterface     $cache,
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        $q      = trim($request->query->get('q', ''));
        $source = $request->query->get('source', '');

        if ($q === '') {
            return $this->json(['member' => [], 'totalItems' => 0]);
        }

        // Cache the translation too (24h) — avoids calling Google Translate 5x per search
        $qEn = $this->cache->get('translate_' . md5($q), function (ItemInterface $item) use ($q) {
            $item->expiresAfter(86400); // 24h
            return $this->queryTranslator->toEnglish($q);
        });

        $cacheKey = 'live_search_' . md5($qEn . '|' . $source);

        $results = $this->cache->get($cacheKey, function (ItemInterface $item) use ($qEn, $source) {
            $item->expiresAfter(600); // 10 minutes

            if ($source === 'all' || $source === '') {
                // 1. Fire all requests simultaneously (non-blocking)
                //    Sources without an API key configured are skipped.
                $ytResp = $this->youtubeFetcher->isConfigured() ? $this->youtubeFetcher->fireSearch($qEn, 10) : null;
                $dtResp = $this->devToFetcher->fireSearch($qEn, 10);
                $spResp = $this->spoonacularFetcher->isConfigured() ? $this->spoonacularFetcher->fireSearch($qEn, 5) : null;

                // 2. Parse all responses (waiting happens here, but concurrently via HttpClient streaming)
                return array_merge(
                    $ytResp ? $this->youtubeFetcher->parseResponse($ytResp, 10) : [],
                    $this->devToFetcher->parseResponse($dtResp, 10),
                    $spResp ? $this->spoonacularFetcher->parseResponse($spResp, 5, $qEn) : [],
                    $this->mealDBFetcher->search($qEn, 5),
                );
            }

            return match ($source) {
                'youtube' => $this->youtubeFetcher->search($qEn, 20),
                'devto'   => $this->devToFetcher->search($qEn, 20),
                'reddit'  => $this->redditFetcher->search($qEn, 25),
                'medium'  => $this->mediumFetcher->search($qEn, 20),
                'recipe'  => $this->mergeRecipes($qEn, 20),
                default   => [],
            };
        });

        return $this->json([
            'member'     => $results,
            'totalItems' => count($results),
        ]);
    }

    /**
     * Merge Spoonacular + MealDB results, deduplicated by normalized title.
     */
    private function mergeRecipes(string $query, int $limit): array
    {
        $spoon  = $this->spoonacularFetcher->search($query, $limit);
        $mealdb = $this->mealDBFetcher->search($query, $limit);

        $seen   = [];
        $merged = [];

        foreach (array_merge($spoon, $mealdb) as $recipe) {
            $key = strtolower(preg_replace('/\s+/', '', $recipe['title'] ?? ''));
            if (!isset($seen[$key])) {
                $seen[$key] = true;
                $merged[]   = $recipe;
            }
        }

        return array_slice($merged, 0, $limit);
    }
}
