<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

#[Route('/api/recipe/{id}', methods: ['GET'])]
class RecipeProxyController extends AbstractController
{
    public function __construct(
        private readonly HttpClientInterface $httpClient,
        private readonly ?string $spoonacularApiKey,
        private readonly CacheInterface $cache,
    ) {}

    public function __invoke(string $id): JsonResponse
    {
        $cacheKey = 'recipe_' . preg_replace('/[^a-zA-Z0-9_]/', '_', $id);

        $data = $this->cache->get($cacheKey, function (ItemInterface $item) use ($id): array {
            $item->expiresAfter(3600); // 1h

            if (str_starts_with($id, 'spoonacular-')) {
                return $this->fetchSpoonacularData(substr($id, strlen('spoonacular-')));
            }

            if (!ctype_digit($id)) {
                return ['__error' => 'Invalid recipe ID.', '__status' => Response::HTTP_BAD_REQUEST];
            }

            return $this->fetchMealDBData($id);
        });

        if (isset($data['__error'])) {
            return $this->json(['error' => $data['__error']], $data['__status'] ?? 404);
        }

        return $this->json($data);
    }

    private function fetchMealDBData(string $id): array
    {
        $response = $this->httpClient->request(
            'GET',
            'https://www.themealdb.com/api/json/v1/1/lookup.php',
            ['query' => ['i' => $id]],
        );

        $meal = $response->toArray()['meals'][0] ?? null;

        if (!$meal) {
            return ['__error' => 'Recipe not found.', '__status' => Response::HTTP_NOT_FOUND];
        }

        $ingredients = [];
        for ($i = 1; $i <= 20; $i++) {
            $name    = trim($meal["strIngredient{$i}"] ?? '');
            $measure = trim($meal["strMeasure{$i}"]    ?? '');
            if ($name === '') break;
            $ingredients[] = ['name' => $name, 'measure' => $measure];
        }

        return [
            'id'           => $meal['idMeal'],
            'title'        => $meal['strMeal'],
            'category'     => $meal['strCategory']    ?? null,
            'area'         => $meal['strArea']         ?? null,
            'thumbnail'    => $meal['strMealThumb']    ?? null,
            'instructions' => $meal['strInstructions'] ?? '',
            'ingredients'  => $ingredients,
            'tags'         => array_values(array_filter(array_map('trim', explode(',', $meal['strTags'] ?? '')))),
            'youtube'      => $meal['strYoutube']      ?? null,
            'source'       => $meal['strSource']       ?? null,
        ];
    }

    private function fetchSpoonacularData(string $id): array
    {
        if (!ctype_digit($id)) {
            return ['__error' => 'Invalid Spoonacular ID.', '__status' => Response::HTTP_BAD_REQUEST];
        }

        if ($this->spoonacularApiKey === null || $this->spoonacularApiKey === '') {
            return ['__error' => 'Spoonacular API is not configured.', '__status' => Response::HTTP_SERVICE_UNAVAILABLE];
        }

        try {
            $response = $this->httpClient->request('GET',
                "https://api.spoonacular.com/recipes/{$id}/information",
                ['query' => ['apiKey' => $this->spoonacularApiKey, 'includeNutrition' => 'false'], 'timeout' => 8]
            );
            $r = $response->toArray();
        } catch (\Throwable) {
            return ['__error' => 'Recipe not found.', '__status' => Response::HTTP_NOT_FOUND];
        }

        $steps = $r['analyzedInstructions'][0]['steps'] ?? [];
        if ($steps) {
            $instructions = implode("\n\n", array_map(
                fn($s) => ($s['number'] ?? '') . '. ' . ($s['step'] ?? ''),
                $steps
            ));
        } else {
            $instructions = strip_tags($r['instructions'] ?? '');
        }

        $ingredients = [];
        foreach ($r['extendedIngredients'] ?? [] as $ing) {
            $amount  = $ing['measures']['metric']['amount']    ?? $ing['amount'] ?? '';
            $unit    = $ing['measures']['metric']['unitShort'] ?? $ing['unit']   ?? '';
            $ingredients[] = ['name' => $ing['name'] ?? '', 'measure' => trim("{$amount} {$unit}")];
        }

        return [
            'id'           => 'spoonacular-' . $id,
            'title'        => $r['title']     ?? '',
            'category'     => ($r['dishTypes'] ?? [])[0] ?? null,
            'area'         => ($r['cuisines']  ?? [])[0] ?? null,
            'thumbnail'    => $r['image']      ?? null,
            'instructions' => $instructions,
            'ingredients'  => $ingredients,
            'tags'         => array_merge($r['dishTypes'] ?? [], $r['cuisines'] ?? []),
            'youtube'      => null,
            'source'       => $r['sourceUrl']  ?? null,
        ];
    }
}
