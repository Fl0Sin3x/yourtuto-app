<?php

namespace App\Service;

use Symfony\Contracts\HttpClient\HttpClientInterface;
use Symfony\Contracts\HttpClient\ResponseInterface;

class MediumFetcher
{
    // Medium RSS feed via rss2json public API (no key needed)
    private const RSS2JSON = 'https://api.rss2json.com/v1/api.json';

    public function __construct(
        private readonly HttpClientInterface $httpClient,
    ) {}

    public function fireSearch(string $query, int $limit = 20): ResponseInterface
    {
        $tag    = urlencode(strtolower(trim($query)));
        $rssUrl = "https://medium.com/feed/tag/{$tag}";

        return $this->httpClient->request('GET', self::RSS2JSON, [
            'query' => [
                'rss_url' => $rssUrl,
                'count'   => $limit,
            ],
            'timeout' => 3,
        ]);
    }

    public function parseResponse(ResponseInterface $response, int $limit = 20): array
    {
        try {
            if ($response->getStatusCode() !== 200) {
                return [];
            }

            $body  = $response->toArray();
            $items = $body['items'] ?? [];
        } catch (\Throwable) {
            return [];
        }

        $results = [];
        $fakeId  = 0;

        foreach ($items as $item) {
            $title = $item['title'] ?? null;
            $url   = $item['link']  ?? null;

            if (!$title || !$url) {
                continue;
            }

            $description = isset($item['description'])
                ? mb_substr(strip_tags($item['description']), 0, 300)
                : null;

            $thumbnail = $item['thumbnail'] ?? null;
            if (!$thumbnail || !filter_var($thumbnail, FILTER_VALIDATE_URL)) {
                $thumbnail = null;
            }

            $results[] = [
                'id'           => --$fakeId,
                'title'        => $title,
                'description'  => $description ?: null,
                'externalUrl'  => $url,
                'thumbnailUrl' => $thumbnail,
                'source'       => 'medium',
                'externalId'   => md5($url),
                'slug'         => md5($url),
                'categories'   => [],
                'tags'         => array_map(fn($c) => ['id' => 0, 'name' => $c, 'slug' => $c], $item['categories'] ?? []),
                'author'       => null,
                'published'    => true,
            ];
        }

        return $results;
    }

    /**
     * @return array<int, array{id: int, title: string, description: string|null, externalUrl: string, thumbnailUrl: string|null, source: string, externalId: string, slug: string, categories: array, tags: array, author: null}>
     */
    public function search(string $query, int $limit = 20): array
    {
        try {
            return $this->parseResponse($this->fireSearch($query, $limit), $limit);
        } catch (\Throwable) {
            return [];
        }
    }
}
