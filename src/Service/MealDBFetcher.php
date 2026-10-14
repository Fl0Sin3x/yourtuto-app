<?php

namespace App\Service;

use Symfony\Contracts\HttpClient\HttpClientInterface;

class MealDBFetcher
{
    private const BASE_URL = 'https://www.themealdb.com/api/json/v1/1';

    public function __construct(
        private readonly HttpClientInterface $httpClient,
    ) {}

    /**
     * @return array<int, mixed>
     */
    public function search(string $query, int $limit = 20): array
    {
        $meals = [];

        // 1) Search by meal name
        try {
            $r     = $this->httpClient->request('GET', self::BASE_URL . '/search.php', ['query' => ['s' => $query], 'timeout' => 3]);
            $meals = $r->toArray()['meals'] ?? [];
        } catch (\Throwable) {}

        // 2) Fallback: search by ingredient
        if (empty($meals)) {
            try {
                $r = $this->httpClient->request('GET', self::BASE_URL . '/filter.php', ['query' => ['i' => $query], 'timeout' => 3]);
                $previews = $r->toArray()['meals'] ?? [];
                // filter.php returns limited data — fetch full details for first results
                foreach (array_slice($previews, 0, $limit) as $preview) {
                    try {
                        $detail = $this->httpClient->request('GET', self::BASE_URL . '/lookup.php', ['query' => ['i' => $preview['idMeal']], 'timeout' => 3]);
                        $full   = $detail->toArray()['meals'][0] ?? null;
                        if ($full) $meals[] = $full;
                    } catch (\Throwable) {}
                }
            } catch (\Throwable) {}
        }

        // 3) Fallback: search by category
        if (empty($meals)) {
            try {
                $r = $this->httpClient->request('GET', self::BASE_URL . '/filter.php', ['query' => ['c' => $query], 'timeout' => 3]);
                $previews = $r->toArray()['meals'] ?? [];
                foreach (array_slice($previews, 0, $limit) as $preview) {
                    try {
                        $detail = $this->httpClient->request('GET', self::BASE_URL . '/lookup.php', ['query' => ['i' => $preview['idMeal']], 'timeout' => 3]);
                        $full   = $detail->toArray()['meals'][0] ?? null;
                        if ($full) $meals[] = $full;
                    } catch (\Throwable) {}
                }
            } catch (\Throwable) {}
        }

        // 4) Multi-word: strict (all keywords) first, then capped per-keyword buckets
        if (empty($meals)) {
            $stopWords = ['with', 'and', 'the', 'for', 'from', 'some', 'spicy', 'easy', 'homemade'];
            $words     = array_values(array_filter(
                explode(' ', strtolower($query)),
                fn($w) => strlen($w) >= 3 && !in_array($w, $stopWords)
            ));

            $byKeyword = []; // word => ordered array of meals
            $allMeals  = []; // idMeal => meal (deduped)

            foreach ($words as $word) {
                $bucket = [];

                // Name search
                try {
                    $r = $this->httpClient->request('GET', self::BASE_URL . '/search.php', ['query' => ['s' => $word], 'timeout' => 3]);
                    foreach ($r->toArray()['meals'] ?? [] as $meal) {
                        $id = $meal['idMeal'];
                        $allMeals[$id] ??= $meal;
                        $bucket[$id]   ??= $meal;
                    }
                } catch (\Throwable) {}

                // Category search — fetch full details for first 8
                try {
                    $r        = $this->httpClient->request('GET', self::BASE_URL . '/filter.php', ['query' => ['c' => $word], 'timeout' => 3]);
                    $previews = $r->toArray()['meals'] ?? [];
                    foreach (array_slice($previews, 0, 8) as $preview) {
                        $id = $preview['idMeal'];
                        if (!isset($allMeals[$id])) {
                            try {
                                $detail = $this->httpClient->request('GET', self::BASE_URL . '/lookup.php', ['query' => ['i' => $id], 'timeout' => 3]);
                                $full   = $detail->toArray()['meals'][0] ?? null;
                                if ($full) {
                                    $allMeals[$id] = $full;
                                    $bucket[$id]   = $full;
                                }
                            } catch (\Throwable) {}
                        } else {
                            $bucket[$id] ??= $allMeals[$id];
                        }
                    }
                } catch (\Throwable) {}

                $byKeyword[$word] = array_values($bucket);
            }

            // Step A: strict — dishes matching ALL keywords appear first
            $usedIds     = [];
            $strictMeals = [];
            if (count($words) >= 2) {
                foreach ($allMeals as $id => $meal) {
                    $allMatch = true;
                    foreach ($words as $w) {
                        if (!$this->mealMatchesKeyword($meal, $w)) {
                            $allMatch = false;
                            break;
                        }
                    }
                    if ($allMatch) {
                        $usedIds[$id]  = true;
                        $strictMeals[] = $meal;
                    }
                }
            }

            // Strict results first, then fill with per-keyword buckets (capped)
            // Cap = ceil(limit / (keywords+1)) keeps only top results per bucket:
            // "pasta curry" → cap=7 → curry bucket top 7 excludes "Jamaican Curry Goat" (rank 8)
            $cap   = count($words) >= 2 ? max(3, (int) ceil($limit / (count($words) + 1))) : $limit;
            $meals = $strictMeals;

            foreach ($byKeyword as $bucket) {
                $added = 0;
                foreach ($bucket as $meal) {
                    $id = $meal['idMeal'];
                    if (!isset($usedIds[$id])) {
                        $usedIds[$id] = true;
                        $meals[]      = $meal;
                        if (++$added >= $cap) break;
                    }
                }
            }
        }

        $results = [];
        $fakeId  = 0;

        foreach (array_slice($meals, 0, $limit) as $meal) {
            $instructions = $meal['strInstructions'] ?? '';
            $description  = $instructions
                ? mb_substr(strip_tags($instructions), 0, 300)
                : null;

            // Collect ingredients
            $tags = [];
            if (!empty($meal['strCategory'])) {
                $tags[] = ['id' => 0, 'name' => $meal['strCategory'], 'slug' => strtolower($meal['strCategory'])];
            }
            if (!empty($meal['strArea'])) {
                $tags[] = ['id' => 0, 'name' => $meal['strArea'], 'slug' => strtolower($meal['strArea'])];
            }
            foreach (explode(',', $meal['strTags'] ?? '') as $t) {
                $t = trim($t);
                if ($t) $tags[] = ['id' => 0, 'name' => $t, 'slug' => strtolower($t)];
            }

            $results[] = [
                'id'           => --$fakeId,
                'title'        => $meal['strMeal'],
                'description'  => $description,
                'externalUrl'  => $meal['strSource'] ?? null,
                'thumbnailUrl' => $meal['strMealThumb'] ?? null,
                'source'       => 'recipe',
                'externalId'   => 'mealdb-' . $meal['idMeal'],
                'slug'         => 'mealdb-' . $meal['idMeal'],
                'categories'   => [],
                'tags'         => $tags,
                'author'       => null,
                'published'    => true,
                'content'      => $this->formatRecipe($meal),
            ];
        }

        return $results;
    }

    /**
     * Check whether a meal is relevant to a keyword (title, category, tags, ingredients).
     */
    private function mealMatchesKeyword(array $meal, string $keyword): bool
    {
        static $synonyms = [
            'pasta'   => ['pasta', 'spaghetti', 'linguine', 'fettuccine', 'fettucine', 'penne',
                          'rigatoni', 'lasagne', 'lasagna', 'macaroni', 'farfalle', 'tagliatelle',
                          'vermicelli', 'gnocchi', 'carbonara', 'noodle'],
            'noodle'  => ['noodle', 'pasta', 'spaghetti', 'linguine', 'fettuccine', 'ramen',
                          'udon', 'soba', 'vermicelli'],
            'chicken' => ['chicken', 'poulet'],
            'beef'    => ['beef', 'steak', 'boeuf'],
            'fish'    => ['fish', 'salmon', 'tuna', 'cod', 'prawn', 'shrimp', 'seafood'],
            'potato'  => ['potato', 'potatoes', 'patate'],
            'pates'   => ['pasta', 'spaghetti', 'linguine', 'fettuccine', 'penne', 'lasagne',
                          'lasagna', 'macaroni', 'farfalle', 'noodle', 'gnocchi'],
        ];

        $terms = $synonyms[$keyword] ?? [$keyword];

        // Build haystack: title + category + tags + ingredients
        $haystack = mb_strtolower(
            ($meal['strMeal']     ?? '') . ' ' .
            ($meal['strCategory'] ?? '') . ' ' .
            ($meal['strTags']     ?? '')
        );
        for ($i = 1; $i <= 20; $i++) {
            $ingredient = trim($meal["strIngredient{$i}"] ?? '');
            if ($ingredient === '') break;
            $haystack .= ' ' . mb_strtolower($ingredient);
        }

        foreach ($terms as $term) {
            if (str_contains($haystack, $term)) {
                return true;
            }
        }

        return false;
    }

    private function formatRecipe(array $meal): string
    {
        $md  = "## Ingrédients\n\n";

        for ($i = 1; $i <= 20; $i++) {
            $ingredient = trim($meal["strIngredient{$i}"] ?? '');
            $measure    = trim($meal["strMeasure{$i}"]    ?? '');
            if ($ingredient === '') break;
            $md .= "- **{$measure}** {$ingredient}\n";
        }

        $md .= "\n## Préparation\n\n";
        $md .= $meal['strInstructions'] ?? '';

        if (!empty($meal['strYoutube'])) {
            $md .= "\n\n---\n[▶ Voir la vidéo YouTube]({$meal['strYoutube']})";
        }

        return $md;
    }
}
