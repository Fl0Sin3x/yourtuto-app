<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Contracts\HttpClient\HttpClientInterface;

class ArchiveProxyController extends AbstractController
{
    public function __construct(private readonly HttpClientInterface $httpClient) {}

    #[Route('/api/archive/{identifier}', name: 'api_archive_item', methods: ['GET'])]
    public function item(string $identifier): JsonResponse
    {
        // Strip 'archive-' prefix if present (stored as 'archive-{id}' in DB)
        $id = preg_replace('/^archive-/', '', $identifier);

        $response = $this->httpClient->request('GET', "https://archive.org/metadata/{$id}", [
            'timeout' => 10,
        ]);

        $raw  = $response->toArray();
        $meta = $raw['metadata'] ?? [];

        $title       = is_array($meta['title'] ?? null)       ? ($meta['title'][0] ?? '')          : ($meta['title'] ?? '');
        $description = is_array($meta['description'] ?? null) ? implode(' ', $meta['description'])  : ($meta['description'] ?? '');
        $creator     = is_array($meta['creator'] ?? null)     ? implode(', ', $meta['creator'])     : ($meta['creator'] ?? null);
        $date        = is_array($meta['date'] ?? null)        ? ($meta['date'][0] ?? null)          : ($meta['date'] ?? null);
        $subject     = (array) ($meta['subject'] ?? []);
        $language    = is_array($meta['language'] ?? null)    ? ($meta['language'][0] ?? null)      : ($meta['language'] ?? null);

        $description = strip_tags($description);
        $description = trim((string) preg_replace('/\s+/', ' ', $description));

        return $this->json([
            'identifier'  => $id,
            'title'       => $title,
            'description' => $description ?: null,
            'creator'     => $creator,
            'year'        => $date ? substr((string) $date, 0, 4) : null,
            'subjects'    => array_slice($subject, 0, 12),
            'language'    => $language,
            'thumbnail'   => "https://archive.org/services/img/{$id}",
            'embedUrl'    => "https://archive.org/embed/{$id}",
            'externalUrl' => "https://archive.org/details/{$id}",
        ]);
    }
}
