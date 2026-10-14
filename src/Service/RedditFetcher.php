<?php

namespace App\Service;

use Symfony\Contracts\HttpClient\HttpClientInterface;
use Symfony\Contracts\HttpClient\ResponseInterface;

class RedditFetcher
{
    private const SUBREDDITS = 'howto+DIY+tutorials+learnprogramming+webdev+programming+learnpython+javascript+linux+Cooking+Fitness+photography+languagelearning+personalfinance+productivity';

    private const SEARCH_URL = 'https://www.reddit.com/r/' . self::SUBREDDITS . '/search.json';

    public function __construct(
        private readonly HttpClientInterface $httpClient,
    ) {}

    public function fireSearch(string $query, int $limit = 25): ResponseInterface
    {
        return $this->httpClient->request('GET', self::SEARCH_URL, [
            'headers' => ['User-Agent' => 'YourTuto/1.0'],
            'timeout' => 3,
            'query'   => [
                'q'           => $query,
                'sort'        => 'relevance',
                'limit'       => $limit,
                't'           => 'all',
                'restrict_sr' => 1,
            ],
        ]);
    }

    public function parseResponse(ResponseInterface $response, int $limit = 25): array
    {
        try {
            $body = $response->toArray();
        } catch (\Throwable) {
            return [];
        }

        $posts   = $body['data']['children'] ?? [];
        $results = [];
        $fakeId  = 0;

        $tutorialKeywords = [
            'how to', 'howto', 'tutorial', 'guide', 'tips', 'tricks', 'learn', 'learning',
            'beginner', 'introduction', 'getting started', 'step by step', 'diy', 'setup',
            'install', 'configure', 'walkthrough', 'course', 'lesson', 'explained',
            'comment', 'tuto', 'apprendre', 'débuter', 'installer', 'configurer',
        ];

        foreach ($posts as $child) {
            $post = $child['data'];
            if (empty($post['title'])) {
                continue;
            }

            // Ignore low-quality posts
            if (($post['score'] ?? 0) < 10) {
                continue;
            }

            // Only keep posts that look like tutorials
            $titleLower = mb_strtolower($post['title']);
            $isTutorial = false;
            foreach ($tutorialKeywords as $keyword) {
                if (str_contains($titleLower, $keyword)) {
                    $isTutorial = true;
                    break;
                }
            }
            if (!$isTutorial) {
                continue;
            }

            $description = isset($post['selftext']) && strlen($post['selftext']) > 10
                ? mb_substr(strip_tags($post['selftext']), 0, 300)
                : null;

            $results[] = [
                'id'           => --$fakeId,
                'title'        => $post['title'],
                'description'  => $description,
                'externalUrl'  => 'https://reddit.com' . ($post['permalink'] ?? ''),
                'thumbnailUrl' => $this->extractThumbnail($post),
                'source'       => 'reddit',
                'externalId'   => 'reddit-' . $post['id'],
                'slug'         => $post['id'],
                'categories'   => [],
                'tags'         => [],
                'author'       => null,
                'published'    => true,
            ];
        }

        return $results;
    }

    /**
     * @return array<int, array{id: int, title: string, description: string|null, externalUrl: string, thumbnailUrl: string|null, source: string, externalId: string, slug: string, categories: array, tags: array, author: null}>
     */
    public function search(string $query, int $limit = 25): array
    {
        try {
            return $this->parseResponse($this->fireSearch($query, $limit), $limit);
        } catch (\Throwable) {
            return [];
        }
    }

    private function extractThumbnail(array $post): ?string
    {
        $url = $post['preview']['images'][0]['source']['url'] ?? null;
        if ($url) {
            return html_entity_decode($url);
        }

        $thumb = $post['thumbnail'] ?? '';
        if (filter_var($thumb, FILTER_VALIDATE_URL)) {
            return $thumb;
        }

        return null;
    }
}
