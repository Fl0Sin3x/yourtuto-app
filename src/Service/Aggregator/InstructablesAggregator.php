<?php

namespace App\Service\Aggregator;

use App\Entity\Tutorial;
use App\Enum\TutorialSource;
use App\Repository\CategoryRepository;
use App\Repository\TagRepository;
use App\Repository\TutorialRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Fetches DIY / home-improvement tutorials from Instructables category RSS feeds.
 *
 * Available categories (pass as option 'category'):
 *   homeimprovement, workshop, craft, outside, living, food, technology
 */
class InstructablesAggregator implements AggregatorInterface
{
    private const RSS_URL = 'https://www.instructables.com/projects/%s/rss.xml';

    /** Map of Instructables category → human-readable label used for auto-tagging */
    private const CATEGORY_LABELS = [
        'homeimprovement' => 'Bricolage',
        'workshop'        => 'Atelier',
        'craft'           => 'Loisirs créatifs',
        'outside'         => 'Extérieur',
        'living'          => 'Maison',
        'food'            => 'Cuisine',
        'technology'      => 'Technologie',
    ];

    public function __construct(
        private readonly HttpClientInterface    $httpClient,
        private readonly EntityManagerInterface $em,
        private readonly TutorialRepository     $tutorialRepository,
        private readonly TagRepository          $tagRepository,
        private readonly CategoryRepository     $categoryRepository,
    ) {}

    public function aggregate(array $options = []): array
    {
        $category = $options['category'] ?? 'homeimprovement';
        $limit    = (int) ($options['limit'] ?? 20);

        $url = sprintf(self::RSS_URL, $category);

        $response = $this->httpClient->request('GET', $url, [
            'headers' => ['User-Agent' => 'YourTuto/1.0 (+https://yourtuto.com)'],
            'timeout' => 10,
        ]);

        $xml = new \SimpleXMLElement($response->getContent());

        // Register namespaces used by Instructables RSS
        $xml->registerXPathNamespace('media', 'http://search.yahoo.com/mrss/');
        $xml->registerXPathNamespace('dc', 'http://purl.org/dc/elements/1.1/');

        $items   = $xml->channel->item ?? [];
        $created = 0;
        $externalIds = [];

        foreach ($items as $index => $item) {
            if ($index >= $limit) {
                break;
            }

            $link = trim((string) $item->link);
            if (!$link) {
                continue;
            }

            // Use the URL path as external ID (stable, unique per project)
            $externalId    = 'instructables-' . $this->slugFromUrl($link);
            $externalIds[] = $externalId;

            if ($this->tutorialRepository->findByExternalId($externalId)) {
                continue;
            }

            $title = html_entity_decode(trim((string) $item->title), ENT_QUOTES | ENT_HTML5, 'UTF-8');
            if (!$title) {
                continue;
            }

            $description = $this->extractDescription((string) ($item->description ?? ''));
            $thumbnail   = $this->extractThumbnail($item);

            $tutorial = new Tutorial();
            $tutorial
                ->setTitle($title)
                ->setDescription($description)
                ->setExternalUrl($link)
                ->setThumbnailUrl($thumbnail)
                ->setSource(TutorialSource::Instructables)
                ->setExternalId($externalId)
                ->setPublished(true);

            // Tag with the category label
            $label    = self::CATEGORY_LABELS[$category] ?? ucfirst($category);
            $tagSlug  = $this->slugify($label);
            $tutorial->addTag($this->tagRepository->findOrCreate($label, $tagSlug));

            // Also tag as "DIY"
            $tutorial->addTag($this->tagRepository->findOrCreate('DIY', 'diy'));

            $this->em->persist($tutorial);
            ++$created;
        }

        $this->em->flush();

        return ['count' => $created, 'externalIds' => $externalIds];
    }

    private function slugFromUrl(string $url): string
    {
        $path = parse_url($url, PHP_URL_PATH) ?? $url;
        return trim($path, '/');
    }

    private function extractDescription(string $html): ?string
    {
        if (!$html) {
            return null;
        }

        $text = strip_tags($html);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = preg_replace('/\s+/', ' ', $text);
        $text = trim($text ?? '');

        return $text ? mb_substr($text, 0, 400) : null;
    }

    private function extractThumbnail(\SimpleXMLElement $item): ?string
    {
        // media:thumbnail
        $media = $item->children('http://search.yahoo.com/mrss/');
        if (isset($media->thumbnail)) {
            $url = (string) $media->thumbnail->attributes()['url'];
            if ($url) {
                return $url;
            }
        }

        // enclosure
        if (isset($item->enclosure)) {
            $url = (string) $item->enclosure->attributes()['url'];
            if ($url && str_contains($url, 'instructables.com')) {
                return $url;
            }
        }

        // img tag in description HTML
        if (preg_match('/<img[^>]+src=["\']([^"\']+)["\']/', (string) ($item->description ?? ''), $m)) {
            return $m[1];
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
