<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\HttpClient\HttpClientInterface;

#[Route('/api/reddit-post/{id}', methods: ['GET'])]
class RedditProxyController extends AbstractController
{
    public function __construct(
        private readonly HttpClientInterface $httpClient,
    ) {}

    public function __invoke(string $id): JsonResponse
    {
        if (!preg_match('/^[a-z0-9]+$/i', $id)) {
            return $this->json(['error' => 'Invalid post ID.'], Response::HTTP_BAD_REQUEST);
        }

        $response = $this->httpClient->request(
            'GET',
            "https://www.reddit.com/comments/{$id}.json",
            ['headers' => ['User-Agent' => 'YourTuto/1.0']],
        );

        if ($response->getStatusCode() !== 200) {
            return $this->json(['error' => 'Post not found.'], Response::HTTP_NOT_FOUND);
        }

        $body = $response->toArray();
        $post = $body[0]['data']['children'][0]['data'] ?? null;

        if (!$post) {
            return $this->json(['error' => 'Post not found.'], Response::HTTP_NOT_FOUND);
        }

        $thumbnail = null;
        $previewUrl = $post['preview']['images'][0]['source']['url'] ?? null;
        if ($previewUrl) {
            $thumbnail = html_entity_decode($previewUrl);
        }

        return $this->json([
            'id'          => $post['id'],
            'title'       => $post['title'],
            'selftext'    => $post['selftext'] ?? '',
            'url'         => $post['url'],
            'permalink'   => 'https://reddit.com' . $post['permalink'],
            'thumbnail'   => $thumbnail,
            'subreddit'   => $post['subreddit'],
            'author'      => $post['author'] ?? null,
            'score'       => $post['score'] ?? 0,
            'numComments' => $post['num_comments'] ?? 0,
            'createdAt'   => isset($post['created_utc']) ? date('c', (int) $post['created_utc']) : null,
            'isExternal'  => ($post['is_self'] ?? true) === false,
        ]);
    }
}
