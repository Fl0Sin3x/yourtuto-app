<?php

namespace App\Controller;

use App\Entity\User;
use App\Repository\LearningPathRepository;
use App\Service\LearningPathService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/paths')]
final class LearningPathController extends AbstractController
{
    public function __construct(
        private readonly LearningPathRepository $paths,
        private readonly LearningPathService $service,
    ) {}

    #[Route('', name: 'api_paths_list', methods: ['GET'])]
    public function list(): JsonResponse
    {
        $paths = $this->paths->findPublished();
        $user  = $this->getUser();
        $done  = $this->service->completedByPath($paths, $user instanceof User ? $user : null);

        return $this->json(array_map(
            fn ($p) => $this->service->summary($p, count($done[$p->getId()] ?? [])),
            $paths,
        ));
    }

    #[Route('/{slug}', name: 'api_paths_show', methods: ['GET'], requirements: ['slug' => '[a-z0-9-]+'])]
    public function show(string $slug): JsonResponse
    {
        $path = $this->paths->findOneBy(['slug' => $slug, 'published' => true]);
        if (!$path) {
            return $this->json(['error' => 'Path not found'], 404);
        }

        $user = $this->getUser();
        $done = $user instanceof User ? $this->service->completedTutorialIds($user) : [];
        $steps = $this->service->steps($path);
        $completed = count(array_filter($steps, fn ($t) => isset($done[$t->getId()])));

        return $this->json($this->service->summary($path, $completed) + [
            'steps' => array_map(fn ($t) => [
                'id'           => $t->getId(),
                'slug'         => $t->getSlug(),
                'title'        => $t->getTitle(),
                'description'  => $t->getDescription(),
                'difficulty'   => $t->getDifficulty(),
                'duration'     => $t->getDuration(),
                'source'       => $t->getSource()->value,
                'thumbnailUrl' => $t->getThumbnailUrl(),
                'done'         => isset($done[$t->getId()]),
            ], $steps),
            'nextStepId' => ($next = array_values(array_filter($steps, fn ($t) => !isset($done[$t->getId()]))) ) ? $next[0]->getId() : null,
        ]);
    }
}
