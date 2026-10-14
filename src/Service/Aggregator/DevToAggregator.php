<?php

namespace App\Service\Aggregator;

use App\Entity\Tag;
use App\Entity\Tutorial;
use App\Enum\TutorialSource;
use App\Repository\TagRepository;
use App\Repository\TutorialRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

class DevToAggregator implements AggregatorInterface
{
    private const API_URL = 'https://dev.to/api/articles';

    public function __construct(
        private readonly HttpClientInterface    $httpClient,
        private readonly EntityManagerInterface $em,
        private readonly TutorialRepository     $tutorialRepository,
        private readonly TagRepository          $tagRepository,
        private readonly ?string                 $apiKey,
    ) {}

    /**
     * @return array{count: int, externalIds: string[]}
     */
    public function aggregate(array $options = []): array
    {
        $tag        = $options['tag']     ?? 'symfony';
        $perPage    = $options['perPage'] ?? 20;

        $response = $this->httpClient->request('GET', self::API_URL, [
            'headers' => $this->apiKey ? ['api-key' => $this->apiKey] : [],
            'query'   => ['tag' => $tag, 'per_page' => $perPage],
        ]);

        $articles    = $response->toArray();
        $created     = 0;
        $externalIds = [];

        foreach ($articles as $article) {
            $externalId  = (string) $article['id'];
            $externalIds[] = $externalId;

            if ($this->tutorialRepository->findByExternalId($externalId)) {
                continue;
            }

            $tutorial = new Tutorial();
            $tutorial
                ->setTitle($article['title'])
                ->setDescription($article['description'] ?? null)
                ->setExternalUrl($article['url'])
                ->setThumbnailUrl($article['cover_image'] ?? null)
                ->setSource(TutorialSource::DevTo)
                ->setExternalId($externalId)
                ->setSlug($this->slugify($article['title'] . '-devto-' . $externalId))
                ->setPublished(true);

            foreach ($article['tag_list'] ?? [] as $tagName) {
                $tagSlug   = $this->slugify($tagName);
                $tagEntity = $this->tagRepository->findOrCreate($tagName, $tagSlug);
                $tutorial->addTag($tagEntity);
            }

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
