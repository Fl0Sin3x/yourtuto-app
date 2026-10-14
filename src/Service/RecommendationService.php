<?php

namespace App\Service;

use Anthropic\Client;
use App\Entity\User;
use App\Entity\Tutorial;
use App\Repository\TutorialRepository;
use App\Repository\UserProgressRepository;

class RecommendationService
{
    private const MAX_HISTORY    = 15;
    private const MAX_CANDIDATES = 50;
    private const MAX_RESULTS    = 5;

    public function __construct(
        private readonly TutorialRepository      $tutorialRepository,
        private readonly UserProgressRepository  $progressRepository,
        private readonly ?string                 $anthropicApiKey = null,
    ) {}

    /** @return Tutorial[] */
    public function getRecommendations(User $user): array
    {
        $history = $this->progressRepository->findBy(
            ['user' => $user],
            ['completedAt' => 'DESC'],
            self::MAX_HISTORY,
        );

        if (empty($history)) {
            return [];
        }

        $doneSlugs = array_map(fn($p) => $p->getItemSlug(), $history);

        $candidates = $this->tutorialRepository->findCandidatesExcluding($doneSlugs, self::MAX_CANDIDATES);

        if (empty($candidates)) {
            return [];
        }

        $historyTitles = array_map(fn($p) => $p->getTitle(), $history);
        $candidateList = array_map(fn(Tutorial $t) => ['id' => $t->getId(), 'title' => $t->getTitle()], $candidates);

        $ids = $this->askClaude($historyTitles, $candidateList);

        if (!empty($ids)) {
            $indexed = [];
            foreach ($candidates as $t) {
                $indexed[$t->getId()] = $t;
            }

            $result = [];
            foreach ($ids as $id) {
                if (isset($indexed[$id])) {
                    $result[] = $indexed[$id];
                }
            }

            return $result;
        }

        // Fallback: return the first N candidates (already shuffled in repository)
        return array_slice($candidates, 0, self::MAX_RESULTS);
    }

    /** @return int[] */
    private function askClaude(array $historyTitles, array $candidates): array
    {
        $historyJson   = json_encode($historyTitles, JSON_UNESCAPED_UNICODE);
        $candidateJson = json_encode($candidates, JSON_UNESCAPED_UNICODE);

        $prompt = <<<PROMPT
            Tu es un moteur de recommandation de tutoriels.

            L'utilisateur a déjà consulté ces tutoriels :
            {$historyJson}

            Voici les tutoriels disponibles (id + titre) :
            {$candidateJson}

            Réponds UNIQUEMENT avec un tableau JSON des IDs des 5 tutoriels les plus pertinents pour cet utilisateur, sans aucun texte autour.
            Exemple : [12, 34, 7, 89, 3]
            PROMPT;

        // No API key configured (e.g. local dev / demo): skip AI ranking gracefully
        if ($this->anthropicApiKey === null || $this->anthropicApiKey === '') {
            return [];
        }

        try {
            $client  = new Client(apiKey: $this->anthropicApiKey);
            $message = $client->messages->create(
                model: 'claude-haiku-4-5',
                maxTokens: 128,
                messages: [['role' => 'user', 'content' => trim($prompt)]],
            );

            $text = '';
            foreach ($message->content as $block) {
                if ($block->type === 'text') {
                    $text = $block->text;
                    break;
                }
            }

            if (preg_match('/\[[\d,\s]+\]/', $text, $m)) {
                $ids = json_decode($m[0], true);
                if (is_array($ids)) {
                    return array_slice(array_filter($ids, 'is_int'), 0, self::MAX_RESULTS);
                }
            }
        } catch (\Throwable) {
            // fail silently — recommendations are non-critical
        }

        return [];
    }
}
