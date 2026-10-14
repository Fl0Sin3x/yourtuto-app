<?php

namespace App\Service;

use Symfony\Contracts\HttpClient\HttpClientInterface;
use Symfony\Contracts\HttpClient\ResponseInterface;

class SpoonacularFetcher
{
    private const SEARCH_URL = 'https://api.spoonacular.com/recipes/complexSearch';
    private const INFO_URL   = 'https://api.spoonacular.com/recipes/informationBulk';

    public function __construct(
        private readonly HttpClientInterface $httpClient,
        private readonly ?string $apiKey,
    ) {}

    public function isConfigured(): bool
    {
        return $this->apiKey !== null && $this->apiKey !== '';
    }

    public function fireSearch(string $query, int $limit = 20): ResponseInterface
    {
        return $this->httpClient->request('GET', self::SEARCH_URL, [
            'query'   => [
                'apiKey'               => $this->apiKey,
                'query'                => $query,
                'number'               => $limit,
                'addRecipeInformation' => 'true',
                'fillIngredients'      => 'true',
            ],
            'timeout' => 3,
        ]);
    }

    public function parseResponse(ResponseInterface $response, int $limit = 20, string $originalQuery = ''): array
    {
        try {
            $results = $response->toArray()['results'] ?? [];
        } catch (\Throwable) {
            return [];
        }

        // If no results and we have the original query, try word-by-word fallback synchronously
        if (empty($results) && $originalQuery !== '') {
            $words = array_values(array_filter(
                explode(' ', strtolower(trim($originalQuery))),
                fn($w) => strlen($w) >= 3
            ));
            foreach (array_reverse($words) as $word) {
                $results = $this->fetchResults($word, $limit);
                if (!empty($results)) {
                    break;
                }
            }
        }

        return $this->formatResults($results);
    }

    public function search(string $query, int $limit = 20): array
    {
        // Try full query first
        $results = $this->fetchResults($query, $limit);

        // If no results, try each word individually (last/most specific word first)
        if (empty($results)) {
            $words = array_values(array_filter(
                explode(' ', strtolower(trim($query))),
                fn($w) => strlen($w) >= 3
            ));
            foreach (array_reverse($words) as $word) {
                $results = $this->fetchResults($word, $limit);
                if (!empty($results)) {
                    break;
                }
            }
        }

        return $this->formatResults($results);
    }

    private function formatResults(array $results): array
    {
        $formatted = [];
        $fakeId    = 0;

        foreach ($results as $recipe) {
            $tags = [];
            foreach ($recipe['dishTypes'] ?? [] as $type) {
                $tags[] = ['id' => 0, 'name' => $type, 'slug' => strtolower(str_replace(' ', '-', $type))];
            }
            foreach ($recipe['cuisines'] ?? [] as $cuisine) {
                $tags[] = ['id' => 0, 'name' => $cuisine, 'slug' => strtolower(str_replace(' ', '-', $cuisine))];
            }

            $summary     = strip_tags($recipe['summary'] ?? '');
            $description = $summary ? mb_substr($summary, 0, 300) : null;

            $formatted[] = [
                'id'           => --$fakeId,
                'title'        => $recipe['title'],
                'description'  => $description,
                'externalUrl'  => $recipe['sourceUrl'] ?? null,
                'thumbnailUrl' => $recipe['image'] ?? null,
                'source'       => 'recipe',
                'externalId'   => 'spoonacular-' . $recipe['id'],
                'slug'         => 'spoonacular-' . $recipe['id'],
                'categories'   => [],
                'tags'         => $tags,
                'author'       => null,
                'published'    => true,
                'content'      => $this->formatRecipe($recipe),
            ];
        }

        return $formatted;
    }

    private function fetchResults(string $query, int $limit, string $includeIngredients = ''): array
    {
        if (!$this->isConfigured()) {
            return [];
        }

        try {
            $params = [
                'apiKey'               => $this->apiKey,
                'query'                => $query,
                'number'               => $limit,
                'addRecipeInformation' => 'true',
                'fillIngredients'      => 'true',
            ];
            if ($includeIngredients !== '') {
                $params['includeIngredients'] = $includeIngredients;
            }

            $response = $this->httpClient->request('GET', self::SEARCH_URL, [
                'query'   => $params,
                'timeout' => 3,
            ]);

            return $response->toArray()['results'] ?? [];
        } catch (\Throwable) {
            return [];
        }
    }

    private function formatRecipe(array $recipe): string
    {
        $md = "## Ingrédients\n\n";

        foreach ($recipe['extendedIngredients'] ?? [] as $ing) {
            $amount = $ing['measures']['metric']['amount'] ?? $ing['amount'] ?? '';
            $unit   = $ing['measures']['metric']['unitShort'] ?? $ing['unit'] ?? '';
            $name   = $ing['name'] ?? '';
            $md .= "- **{$amount} {$unit}** {$name}\n";
        }

        $md .= "\n## Préparation\n\n";

        $steps = $recipe['analyzedInstructions'][0]['steps'] ?? [];
        if ($steps) {
            foreach ($steps as $step) {
                $md .= ($step['number'] ?? '') . '. ' . ($step['step'] ?? '') . "\n\n";
            }
        } else {
            $md .= strip_tags($recipe['instructions'] ?? '');
        }

        if (!empty($recipe['sourceUrl'])) {
            $md .= "\n\n---\n[Voir la recette originale]({$recipe['sourceUrl']})";
        }

        return $md;
    }
}
