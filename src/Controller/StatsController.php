<?php

namespace App\Controller;

use App\Service\Stats\CatalogStats;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

final class StatsController extends AbstractController
{
    #[Route('/api/stats/overview', name: 'api_stats_overview', methods: ['GET'])]
    public function overview(CatalogStats $stats): JsonResponse
    {
        $response = $this->json($stats->overview());
        $response->setPublic();
        $response->setMaxAge(600);

        return $response;
    }
}
