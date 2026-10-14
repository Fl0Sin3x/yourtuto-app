<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\HttpClient\HttpClientInterface;

#[Route('/api/devto-article/{id}', methods: ['GET'])]
class DevToProxyController extends AbstractController
{
    public function __construct(
        private readonly HttpClientInterface $httpClient,
        private readonly ?string $apiKey,
    ) {}

    public function __invoke(string $id): JsonResponse
    {
        if (!ctype_digit($id)) {
            return $this->json(['error' => 'Invalid article ID.'], Response::HTTP_BAD_REQUEST);
        }

        $response = $this->httpClient->request('GET', "https://dev.to/api/articles/{$id}", [
            'headers' => $this->apiKey ? ['api-key' => $this->apiKey] : [],
        ]);

        if ($response->getStatusCode() !== 200) {
            return $this->json(['error' => 'Article not found.'], Response::HTTP_NOT_FOUND);
        }

        $article = $response->toArray();

        return $this->json([
            'id'          => $article['id'],
            'title'       => $article['title'],
            'description' => $article['description'] ?? null,
            'bodyHtml'    => $article['body_html'] ?? '',
            'coverImage'  => $article['cover_image'] ?? null,
            'publishedAt' => $article['published_at'] ?? null,
            'url'         => $article['url'],
            'author'      => [
                'name'   => $article['user']['name'] ?? null,
                'avatar' => $article['user']['profile_image_90'] ?? null,
            ],
            'tags'        => $article['tags'] ?? [],
            'readingTime' => $article['reading_time_minutes'] ?? null,
        ]);
    }
}
