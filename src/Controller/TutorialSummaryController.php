<?php

namespace App\Controller;

use App\Repository\TutorialRepository;
use App\Service\Summary\TutorialSummarizer;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

final class TutorialSummaryController extends AbstractController
{
    #[Route('/api/tutorials/{id}/summary', name: 'api_tutorial_summary', requirements: ['id' => '\d+'], methods: ['GET'], priority: 10)]
    public function __invoke(int $id, TutorialRepository $tutorials, TutorialSummarizer $summarizer): JsonResponse
    {
        $tutorial = $tutorials->find($id);
        if (!$tutorial || !$tutorial->isPublished()) {
            return $this->json(['error' => 'Tutorial not found'], 404);
        }

        $response = $this->json($summarizer->summarize($tutorial));
        $response->setPublic();
        $response->setMaxAge(3600);

        return $response;
    }
}
