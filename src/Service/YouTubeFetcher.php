<?php

namespace App\Service;

use Symfony\Contracts\HttpClient\HttpClientInterface;
use Symfony\Contracts\HttpClient\ResponseInterface;

class YouTubeFetcher
{
    private const API_URL = 'https://www.googleapis.com/youtube/v3/search';

    private const TUTORIAL_KEYWORDS = [
        'tuto', 'tutorial', 'tutoriel', 'diy', 'guide', 'how to', 'how-to',
        'learn', 'cours', 'formation', 'apprendre', 'débutant', 'beginner',
        'étape', 'step by step', 'installer', 'install', 'remplacer', 'replace',
        'changer', 'réparer', 'repair', 'fix', 'monter', 'démonter', 'setup',
        'configurer', 'configure', 'créer', 'create', 'faire', 'réaliser',
        'astuce', 'tip', 'trick', 'explication', 'explainer', 'présentation',
    ];

    public function __construct(
        private readonly HttpClientInterface $httpClient,
        private readonly ?string $apiKey,
    ) {}

    public function isConfigured(): bool
    {
        return $this->apiKey !== null && $this->apiKey !== '';
    }

    public function fireSearch(string $query, int $maxResults = 20): ResponseInterface
    {
        return $this->httpClient->request('GET', self::API_URL, [
            'query' => [
                'part'       => 'snippet',
                'q'          => $query . ' tuto tutorial',
                'type'       => 'video',
                'maxResults' => $maxResults,
                'key'        => $this->apiKey,
            ],
            'timeout' => 3,
        ]);
    }

    public function parseResponse(ResponseInterface $response, int $maxResults = 20): array
    {
        try {
            $data = $response->toArray();
        } catch (\Throwable) {
            return [];
        }

        $results = [];
        $fakeId  = 0;

        foreach ($data['items'] ?? [] as $item) {
            $videoId = $item['id']['videoId'] ?? null;
            if (!$videoId) {
                continue;
            }

            $snippet = $item['snippet'];
            $title   = html_entity_decode($snippet['title'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $desc    = $snippet['description'] ?? '';

            if (!$this->isTutorialRelated($title, $desc)) {
                continue;
            }

            $results[] = [
                'id'           => --$fakeId,
                'title'        => $title,
                'description'  => $desc ?: null,
                'externalUrl'  => 'https://www.youtube.com/watch?v=' . $videoId,
                'thumbnailUrl' => $snippet['thumbnails']['high']['url'] ?? null,
                'source'       => 'youtube',
                'slug'         => $videoId,
                'categories'   => [],
                'tags'         => [],
                'author'       => null,
            ];
        }

        return $results;
    }

    public function search(string $query, int $maxResults = 20): array
    {
        if (!$this->isConfigured()) {
            return [];
        }

        try {
            $response = $this->fireSearch($query, $maxResults);
            $data     = $response->toArray();
        } catch (\Throwable) {
            return [];
        }
        $results = [];
        $fakeId  = 0;

        foreach ($data['items'] ?? [] as $item) {
            $videoId = $item['id']['videoId'] ?? null;
            if (!$videoId) {
                continue;
            }

            $snippet = $item['snippet'];
            $title   = html_entity_decode($snippet['title'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $desc    = $snippet['description'] ?? '';

            if (!$this->isTutorialRelated($title, $desc) || !$this->queryMatchesTitle($query, $title)) {
                continue;
            }

            $results[] = [
                'id'           => --$fakeId,
                'title'        => $title,
                'description'  => $desc ?: null,
                'externalUrl'  => 'https://www.youtube.com/watch?v=' . $videoId,
                'thumbnailUrl' => $snippet['thumbnails']['high']['url'] ?? null,
                'source'       => 'youtube',
                'slug'         => $videoId,
                'categories'   => [],
                'tags'         => [],
                'author'       => null,
            ];
        }

        return $results;
    }

    /**
     * At least one significant word from the query must appear in the title.
     */
    private function queryMatchesTitle(string $query, string $title): bool
    {
        $titleLower = mb_strtolower($title);
        $words = preg_split('/\s+/', mb_strtolower($query), -1, PREG_SPLIT_NO_EMPTY);

        foreach ($words as $word) {
            if (mb_strlen($word) >= 3 && str_contains($titleLower, $word)) {
                return true;
            }
        }

        return false;
    }

    private function isTutorialRelated(string $title, string $description): bool
    {
        $haystack = mb_strtolower($title . ' ' . $description);

        foreach (self::TUTORIAL_KEYWORDS as $keyword) {
            if (str_contains($haystack, $keyword)) {
                return true;
            }
        }

        return false;
    }
}
