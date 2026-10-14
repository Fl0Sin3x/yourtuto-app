<?php

namespace App\Service;

use Symfony\Contracts\HttpClient\HttpClientInterface;
use Symfony\Contracts\HttpClient\ResponseInterface;

class DevToFetcher
{
    private const API_URL = 'https://dev.to/api/articles';

    public function __construct(
        private readonly HttpClientInterface $httpClient,
        private readonly ?string $apiKey,
    ) {}

    public function fireSearch(string $query, int $perPage = 20): ResponseInterface
    {
        return $this->httpClient->request('GET', self::API_URL, [
            'headers' => $this->apiKey ? ['api-key' => $this->apiKey] : [],
            'query'   => ['tag' => $query, 'per_page' => $perPage],
            'timeout' => 3,
        ]);
    }

    public function parseResponse(ResponseInterface $response, int $perPage = 20): array
    {
        try {
            $articles = $response->toArray();
        } catch (\Throwable) {
            return [];
        }

        $results = [];
        $fakeId  = 0;

        foreach ($articles as $article) {
            $results[] = [
                'id'           => --$fakeId,
                'title'        => $article['title'],
                'description'  => $article['description'] ?? null,
                'externalUrl'  => $article['url'],
                'thumbnailUrl' => $article['cover_image'] ?? null,
                'source'       => 'devto',
                'externalId'   => (string) $article['id'],
                'slug'         => (string) $article['id'],
                'categories'   => [],
                'tags'         => [],
                'author'       => null,
            ];
        }

        return $results;
    }

    /**
     * Search DEV.to articles and return results without persisting anything.
     *
     * @return array<int, array{id: int, title: string, description: string|null, externalUrl: string, thumbnailUrl: string|null, source: string, slug: string, categories: array, tags: array, author: null}>
     */
    public function search(string $query, int $perPage = 20): array
    {
        try {
            return $this->parseResponse($this->fireSearch($query, $perPage), $perPage);
        } catch (\Throwable) {
            return [];
        }
    }
}
