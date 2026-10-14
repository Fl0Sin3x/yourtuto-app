<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\HttpClient\HttpClientInterface;

#[Route('/api/youtube/info/{videoId}', name: 'api_youtube_info', methods: ['GET'])]
class YouTubeInfoController extends AbstractController
{
    public function __construct(
        private readonly HttpClientInterface $httpClient,
        private readonly ?string $apiKey,
    ) {}

    public function __invoke(string $videoId): JsonResponse
    {
        if (!preg_match('/^[\w-]{11}$/', $videoId)) {
            return $this->json(['error' => 'Invalid video ID'], 400);
        }

        if ($this->apiKey === null || $this->apiKey === '') {
            return $this->json(['error' => 'YouTube API is not configured'], 503);
        }

        try {
            $response = $this->httpClient->request('GET', 'https://www.googleapis.com/youtube/v3/videos', [
                'query' => [
                    'id'   => $videoId,
                    'part' => 'snippet,statistics,contentDetails',
                    'key'  => $this->apiKey,
                ],
                'timeout' => 5,
            ]);

            $data   = $response->toArray();
            $item   = $data['items'][0] ?? null;

            if (!$item) {
                return $this->json(['error' => 'Video not found'], 404);
            }

            $snippet    = $item['snippet'];
            $stats      = $item['statistics'] ?? [];
            $duration   = $item['contentDetails']['duration'] ?? null;

            return $this->json([
                'title'        => $snippet['title'],
                'description'  => $snippet['description'],
                'channelTitle' => $snippet['channelTitle'],
                'publishedAt'  => $snippet['publishedAt'],
                'viewCount'    => isset($stats['viewCount']) ? (int) $stats['viewCount'] : null,
                'likeCount'    => isset($stats['likeCount']) ? (int) $stats['likeCount'] : null,
                'duration'     => $duration,
                'thumbnail'    => $snippet['thumbnails']['maxres']['url']
                               ?? $snippet['thumbnails']['high']['url']
                               ?? null,
            ]);
        } catch (\Throwable) {
            return $this->json(['error' => 'Failed to fetch video info'], 502);
        }
    }
}
