<?php

namespace App\Service\Summary;

use App\Entity\Tutorial;
use Doctrine\ORM\EntityManagerInterface;

/**
 * TL;DR for a tutorial: cached AI summary when available, otherwise a free extractive fallback
 * (section headings + first sentences). Fallbacks are not persisted so they upgrade once AI is enabled.
 */
final class TutorialSummarizer
{
    private const MAX_POINTS = 4;

    public function __construct(
        private readonly AiSummaryClient $ai,
        private readonly EntityManagerInterface $em,
    ) {}

    /** @return array{points: list<string>, source: 'ai'|'extractive', cached: bool} */
    public function summarize(Tutorial $tutorial): array
    {
        if ($cached = $tutorial->getAiSummary()) {
            return ['points' => $cached, 'source' => 'ai', 'cached' => true];
        }

        $text = trim((string) $tutorial->getContent()) ?: trim((string) $tutorial->getDescription());

        if ($this->ai->isAvailable() && mb_strlen($text) > 200) {
            $raw = $this->ai->complete($this->prompt((string) $tutorial->getTitle(), $text));
            $points = $raw ? $this->parseBullets($raw) : [];
            if (count($points) >= 2) {
                $tutorial->setAiSummary($points);
                $this->em->flush();

                return ['points' => $points, 'source' => 'ai', 'cached' => false];
            }
        }

        return ['points' => $this->extractive($text), 'source' => 'extractive', 'cached' => false];
    }

    /** @return list<string> */
    public function extractive(string $markdown): array
    {
        $points = [];

        // 1. Section headings are the best outline of a tutorial
        if (preg_match_all('/^#{2,3}\s+(.+)$/mu', $markdown, $m)) {
            foreach ($m[1] as $h) {
                $h = trim(preg_replace('/^(étape|step)\s*\d+\s*[:–-]?\s*/iu', '', $this->clean($h)) ?? '');
                if ($h !== '' && !preg_match('/^(introduction|conclusion|prérequis|sommaire)$/iu', $h)) {
                    $points[] = $h;
                }
            }
        }

        // 2. Otherwise: first sentences of the prose
        if (count($points) < 2) {
            $prose = $this->clean(preg_replace('/```.*?```/su', ' ', $markdown) ?? $markdown);
            $sentences = preg_split('/(?<=[.!?])\s+/u', $prose) ?: [];
            foreach ($sentences as $s) {
                if (mb_strlen($s) >= 25) {
                    $points[] = $s;
                }
                if (count($points) >= self::MAX_POINTS) {
                    break;
                }
            }
        }

        $points = array_values(array_unique(array_map(fn ($p) => $this->truncate($p, 140), $points)));

        return array_slice($points, 0, self::MAX_POINTS);
    }

    /** @return list<string> */
    public function parseBullets(string $raw): array
    {
        $out = [];
        foreach (preg_split('/\R/u', $raw) ?: [] as $line) {
            $line = trim(preg_replace('/^\s*(?:[-*•]|\d+[.)])\s*/u', '', $line) ?? '');
            if (mb_strlen($line) >= 10) {
                $out[] = $this->truncate($this->clean($line), 160);
            }
        }

        return array_slice($out, 0, self::MAX_POINTS);
    }

    private function prompt(string $title, string $text): string
    {
        return "Résume ce tutoriel en 3 ou 4 points clés concrets (ce qu'on apprend / fait), en français, "
            . "une puce '- ' par ligne, sans introduction ni conclusion.\n\nTitre : {$title}\n\n"
            . mb_substr($text, 0, 6000);
    }

    private function clean(string $s): string
    {
        $s = strip_tags($s);
        $s = preg_replace('/!?\[([^\]]*)\]\([^)]*\)/u', '$1', $s) ?? $s; // links/images -> text
        $s = preg_replace('/[*_`#>]+/u', '', $s) ?? $s;

        return trim(preg_replace('/\s+/u', ' ', $s) ?? $s);
    }

    private function truncate(string $s, int $max): string
    {
        return mb_strlen($s) <= $max ? $s : rtrim(mb_substr($s, 0, $max - 1)) . '…';
    }
}
