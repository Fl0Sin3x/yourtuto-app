<?php

namespace App\Service\Aggregator;

use App\Entity\Tutorial;
use App\Enum\TutorialSource;
use App\Repository\TagRepository;
use App\Repository\TutorialRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

class RedditAggregator implements AggregatorInterface
{
    private const BASE_URL = 'https://www.reddit.com/r/%s/search.json';

    public function __construct(
        private readonly HttpClientInterface    $httpClient,
        private readonly EntityManagerInterface $em,
        private readonly TutorialRepository     $tutorialRepository,
        private readonly TagRepository          $tagRepository,
    ) {}

    public function aggregate(array $options = []): array
    {
        $subreddit = $options['subreddit'] ?? 'learnprogramming';
        $query     = $options['query']     ?? 'tutorial';
        $limit     = $options['limit']     ?? 25;

        $url = sprintf(self::BASE_URL, $subreddit);

        $response = $this->httpClient->request('GET', $url, [
            'headers' => ['User-Agent' => 'YourTuto/1.0'],
            'query'   => [
                'q'           => $query,
                'sort'        => 'relevance',
                'limit'       => $limit,
                'restrict_sr' => 1,
                't'           => 'all',
            ],
        ]);

        $body    = $response->toArray();
        $posts   = $body['data']['children'] ?? [];
        $created = 0;
        $externalIds = [];

        foreach ($posts as $child) {
            $post       = $child['data'];
            $externalId = 'reddit-' . $post['id'];
            $externalIds[] = $externalId;

            if ($this->tutorialRepository->findByExternalId($externalId)) {
                continue;
            }

            $title       = $post['title'] ?? null;
            $externalUrl = 'https://reddit.com' . ($post['permalink'] ?? '');
            $thumbnail   = $this->extractThumbnail($post);
            $description = isset($post['selftext']) && strlen($post['selftext']) > 10
                ? mb_substr($post['selftext'], 0, 300)
                : null;

            if (!$title) {
                continue;
            }

            $tutorial = new Tutorial();
            $tutorial
                ->setTitle($title)
                ->setDescription($description)
                ->setExternalUrl($externalUrl)
                ->setThumbnailUrl($thumbnail)
                ->setSource(TutorialSource::Reddit)
                ->setExternalId($externalId)
                ->setSlug($this->slugify($title . '-reddit-' . $post['id']))
                ->setPublished(true);

            // Tag with subreddit name
            $tagEntity = $this->tagRepository->findOrCreate($subreddit, $this->slugify($subreddit));
            $tutorial->addTag($tagEntity);

            // Tag with flair if available
            if (!empty($post['link_flair_text'])) {
                $flair     = mb_substr($post['link_flair_text'], 0, 80);
                $flairSlug = $this->slugify($flair);
                if ($flairSlug) {
                    $tutorial->addTag($this->tagRepository->findOrCreate($flair, $flairSlug));
                }
            }

            $this->em->persist($tutorial);
            ++$created;
        }

        $this->em->flush();

        return ['count' => $created, 'externalIds' => $externalIds];
    }

    private function extractThumbnail(array $post): ?string
    {
        // Best quality: preview image
        $url = $post['preview']['images'][0]['source']['url'] ?? null;
        if ($url) {
            // Reddit encodes & as &amp; in JSON previews
            return html_entity_decode($url);
        }

        // Fallback: thumbnail field (only if it's an actual URL)
        $thumb = $post['thumbnail'] ?? '';
        if (filter_var($thumb, FILTER_VALIDATE_URL)) {
            return $thumb;
        }

        return null;
    }

    private function slugify(string $text): string
    {
        $text = mb_strtolower($text);
        $text = preg_replace('/[^a-z0-9]+/', '-', $text) ?? '';
        return trim($text, '-');
    }
}
