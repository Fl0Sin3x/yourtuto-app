<?php

namespace App\Service\Aggregator;

use App\Entity\Tutorial;
use App\Enum\TutorialSource;
use App\Repository\TutorialRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

class YouTubeAggregator implements AggregatorInterface
{
    private const API_URL = 'https://www.googleapis.com/youtube/v3/search';

    public function __construct(
        private readonly HttpClientInterface     $httpClient,
        private readonly EntityManagerInterface  $em,
        private readonly TutorialRepository      $tutorialRepository,
        private readonly ?string                  $apiKey,
    ) {}

    /**
     * @return array{count: int, externalIds: string[]}
     */
    public function aggregate(array $options = []): array
    {
        if ($this->apiKey === null || $this->apiKey === '') {
            return ['count' => 0, 'externalIds' => []];
        }

        $query      = $options['query']      ?? 'symfony tutorial';
        $maxResults = $options['maxResults'] ?? 20;

        $response = $this->httpClient->request('GET', self::API_URL, [
            'query' => [
                'part'       => 'snippet',
                'q'          => $query,
                'type'       => 'video',
                'maxResults' => $maxResults,
                'key'        => $this->apiKey,
            ],
        ]);

        $data        = $response->toArray();
        $created     = 0;
        $externalIds = [];

        foreach ($data['items'] ?? [] as $item) {
            $videoId = $item['id']['videoId'] ?? null;
            if (!$videoId) {
                continue;
            }

            $externalIds[] = $videoId;

            if ($this->tutorialRepository->findByExternalId($videoId)) {
                continue;
            }

            $snippet  = $item['snippet'];
            $tutorial = new Tutorial();
            $tutorial
                ->setTitle(html_entity_decode($snippet['title'], ENT_QUOTES | ENT_HTML5, 'UTF-8'))
                ->setDescription($snippet['description'])
                ->setExternalUrl('https://www.youtube.com/watch?v=' . $videoId)
                ->setThumbnailUrl($snippet['thumbnails']['high']['url'] ?? null)
                ->setSource(TutorialSource::YouTube)
                ->setExternalId($videoId)
                ->setSlug($this->slugify($snippet['title'] . '-' . $videoId))
                ->setPublished(true);

            $this->em->persist($tutorial);
            ++$created;
        }

        $this->em->flush();

        return ['count' => $created, 'externalIds' => $externalIds];
    }

    private function slugify(string $text): string
    {
        $text = mb_strtolower($text);
        $text = preg_replace('/[^a-z0-9]+/', '-', $text);
        return trim($text, '-');
    }
}
