<?php

namespace App\Service;

use App\Entity\LearningPath;
use App\Entity\Tutorial;
use App\Entity\User;
use App\Repository\TutorialRepository;
use App\Repository\UserProgressRepository;

/**
 * Resolves a path's steps and the current user's progress on it.
 * A step is "done" when the user has a UserProgress entry for that tutorial (itemSlug = tutorial id).
 */
final class LearningPathService
{
    public function __construct(
        private readonly TutorialRepository $tutorials,
        private readonly UserProgressRepository $progress,
    ) {}

    /**
     * @param LearningPath[] $paths
     *
     * @return array<int, array<int, true>> pathId => [tutorialId => true] for completed steps
     */
    public function completedByPath(array $paths, ?User $user): array
    {
        $done = $user ? $this->completedTutorialIds($user) : [];
        $out = [];
        foreach ($paths as $p) {
            $out[(int) $p->getId()] = array_intersect_key($done, array_flip($p->getTutorialIds()));
        }

        return $out;
    }

    /** @return array<int, true> */
    public function completedTutorialIds(User $user): array
    {
        $ids = [];
        foreach ($this->progress->findBy(['user' => $user]) as $p) {
            if (ctype_digit($p->getItemSlug())) {
                $ids[(int) $p->getItemSlug()] = true;
            }
        }

        return $ids;
    }

    /** @return list<Tutorial> steps in path order (missing tutorials skipped) */
    public function steps(LearningPath $path): array
    {
        $ids = $path->getTutorialIds();
        if (!$ids) {
            return [];
        }
        $byId = [];
        foreach ($this->tutorials->findBy(['id' => $ids]) as $t) {
            $byId[$t->getId()] = $t;
        }

        return array_values(array_filter(array_map(fn (int $id) => $byId[$id] ?? null, $ids)));
    }

    public function summary(LearningPath $path, int $completed): array
    {
        $total = count($path->getTutorialIds());

        return [
            'slug'        => $path->getSlug(),
            'title'       => $path->getTitle(),
            'description' => $path->getDescription(),
            'level'       => $path->getLevel(),
            'icon'        => $path->getIcon(),
            'stepCount'   => $total,
            'completed'   => $completed,
            'percent'     => $total > 0 ? (int) round($completed * 100 / $total) : 0,
        ];
    }
}
