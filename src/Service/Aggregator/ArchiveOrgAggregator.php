<?php

namespace App\Service\Aggregator;

use App\Entity\Tutorial;
use App\Enum\TutorialSource;
use App\Repository\TagRepository;
use App\Repository\TutorialRepository;
use App\Service\TranslatorService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

/**
 * Fetches public-domain DIY / craft manuals from the Internet Archive (archive.org).
 * No API key required. All content is public domain or open-license.
 *
 * Usage examples:
 *   php bin/console app:aggregate archive --query="carpentry" --max=20
 *   php bin/console app:aggregate archive --query="plomberie bricolage" --lang=French --max=15
 */
class ArchiveOrgAggregator implements AggregatorInterface
{
    private const SEARCH_URL  = 'https://archive.org/advancedsearch.php';
    private const THUMB_URL   = 'https://archive.org/services/img/%s';
    private const DETAILS_URL = 'https://archive.org/details/%s';

    /**
     * Preset subject queries for common DIY topics.
     * Used when no --query is provided.
     */
    private const DEFAULT_SUBJECTS = [
        'carpentry', 'plumbing', 'do-it-yourself', 'house construction',
        'electrical wiring', 'masonry', 'woodworking',
    ];

    /**
     * Maps English subject keywords → French tags added automatically.
     * Allows searching "bricolage" in French to find English-language manuals.
     */
    private const SUBJECT_TO_FR_TAGS = [
        'carpentry'          => ['Menuiserie',  'Bricolage'],
        'joinery'            => ['Menuiserie',  'Bricolage'],
        'woodworking'        => ['Menuiserie',  'Bricolage'],
        'plumbing'           => ['Plomberie',   'Bricolage'],
        'do-it-yourself'     => ['Bricolage'],
        'diy'                => ['Bricolage'],
        'house construction' => ['Construction','Bricolage'],
        'masonry'            => ['Maçonnerie',  'Bricolage'],
        'electrical wiring'  => ['Électricité', 'Bricolage'],
        'painting'           => ['Peinture',    'Bricolage'],
        'roofing'            => ['Toiture',     'Bricolage'],
        'home repair'        => ['Réparation',  'Bricolage'],
        'gardening'          => ['Jardinage'],
        'metalwork'          => ['Métallurgie', 'Bricolage'],
    ];

    public function __construct(
        private readonly HttpClientInterface    $httpClient,
        private readonly EntityManagerInterface $em,
        private readonly TutorialRepository     $tutorialRepository,
        private readonly TagRepository          $tagRepository,
        private readonly TranslatorService      $translator,
    ) {}

    public function aggregate(array $options = []): array
    {
        $query   = $options['query']    ?? null;
        $lang    = $options['lang']     ?? 'English';
        $limit   = (int) ($options['limit'] ?? $options['max'] ?? 20);
        $minYear = (int) ($options['minYear'] ?? 0);
        $maxYear = (int) ($options['maxYear'] ?? 0);

        // Build the Lucene query
        if ($query) {
            $lucene = "(title:\"{$query}\" OR subject:\"{$query}\" OR description:\"{$query}\")";
        } else {
            $subjects = array_map(fn($s) => "subject:\"{$s}\"", self::DEFAULT_SUBJECTS);
            $lucene   = '(' . implode(' OR ', $subjects) . ')';
        }

        $lucene .= ' AND mediatype:texts';

        if ($lang) {
            $lucene .= " AND language:{$lang}";
        }
        if ($minYear > 0) {
            $lucene .= " AND date:[{$minYear}-01-01T00:00:00Z TO *]";
        }
        if ($maxYear > 0) {
            $lucene .= " AND date:[* TO {$maxYear}-12-31T23:59:59Z]";
        }

        $response = $this->httpClient->request('GET', self::SEARCH_URL, [
            'query' => [
                'q'          => $lucene,
                'fl[]'       => 'identifier,title,description,subject,date,creator,downloads',
                'sort[]'     => 'downloads desc',
                'rows'       => $limit * 2, // fetch more to allow filtering dupes
                'output'     => 'json',
            ],
            'timeout' => 12,
        ]);

        $data    = $response->toArray();
        $docs    = $data['response']['docs'] ?? [];
        $created = 0;
        $externalIds = [];

        foreach ($docs as $doc) {
            if ($created >= $limit) {
                break;
            }

            $identifier = $doc['identifier'] ?? null;
            if (!$identifier) {
                continue;
            }

            $externalId    = 'archive-' . $identifier;
            $externalIds[] = $externalId;

            if ($this->tutorialRepository->findByExternalId($externalId)) {
                continue;
            }

            $title = $this->cleanText($doc['title'] ?? '');
            if (!$title || mb_strlen($title) < 10) {
                continue;
            }

            // Translate title and description to French (stored directly in DB)
            try {
                $title = $this->translator->translate($title);
            } catch (\Throwable) {
                // keep English title on failure
            }

            $description = $this->buildDescription($doc);
            if ($description) {
                try {
                    $description = $this->translator->translate($description);
                } catch (\Throwable) {
                    // keep English description on failure
                }
            }
            $thumbnail   = sprintf(self::THUMB_URL, $identifier);
            $externalUrl = sprintf(self::DETAILS_URL, $identifier);

            $tutorial = new Tutorial();
            $tutorial
                ->setTitle($title)
                ->setSlug($externalId) // externalId = 'archive-{identifier}', guaranteed unique
                ->setDescription($description)
                ->setExternalUrl($externalUrl)
                ->setThumbnailUrl($thumbnail)
                ->setSource(TutorialSource::Archive)
                ->setExternalId($externalId)
                ->setPublished(true);

            // Tags from subjects
            $subjects  = (array) ($doc['subject'] ?? []);
            $frTagsAdded = [];
            foreach (array_slice($subjects, 0, 4) as $subject) {
                $subject = $this->cleanText((string) $subject);
                if (!$subject || strlen($subject) > 60) {
                    continue;
                }
                $tutorial->addTag($this->tagRepository->findOrCreate($subject, $this->slugify($subject)));

                // Add French tags mapped from English subject keywords
                $subjectLower = mb_strtolower($subject);
                foreach (self::SUBJECT_TO_FR_TAGS as $keyword => $frTags) {
                    if (str_contains($subjectLower, $keyword)) {
                        foreach ($frTags as $frTag) {
                            if (!in_array($frTag, $frTagsAdded, true)) {
                                $tutorial->addTag($this->tagRepository->findOrCreate($frTag, $this->slugify($frTag)));
                                $frTagsAdded[] = $frTag;
                            }
                        }
                    }
                }
            }

            // Always tag as "Archive" + "Domaine public"
            $tutorial->addTag($this->tagRepository->findOrCreate('Archive.org', 'archive-org'));
            $tutorial->addTag($this->tagRepository->findOrCreate('Domaine public', 'domaine-public'));

            $this->em->persist($tutorial);
            ++$created;
        }

        $this->em->flush();

        return ['count' => $created, 'externalIds' => $externalIds];
    }

    private function buildDescription(array $doc): ?string
    {
        // description can be a string or an array
        $raw = $doc['description'] ?? null;
        if (is_array($raw)) {
            $raw = implode(' ', $raw);
        }

        $text = $this->cleanText((string) $raw);

        // Prepend year + author metadata if available
        $meta = [];
        if (!empty($doc['date'])) {
            $year = substr($doc['date'], 0, 4);
            if (is_numeric($year)) {
                $meta[] = "Publié en {$year}";
            }
        }
        if (!empty($doc['creator'])) {
            $creators = (array) $doc['creator'];
            $meta[]   = 'Par ' . implode(', ', array_slice($creators, 0, 2));
        }

        $prefix = $meta ? implode(' · ', $meta) . '. ' : '';
        $full   = $prefix . $text;

        return $full ? mb_substr($full, 0, 500) : null;
    }

    private function cleanText(string $text): string
    {
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = strip_tags($text);
        $text = preg_replace('/\s+/', ' ', $text) ?? '';
        return trim($text);
    }

    private function slugify(string $text): string
    {
        $text = mb_strtolower($text);
        $text = preg_replace('/[^a-z0-9]+/', '-', $text) ?? '';
        return trim($text, '-');
    }
}
