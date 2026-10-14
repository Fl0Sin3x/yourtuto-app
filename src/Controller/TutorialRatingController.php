<?php

namespace App\Controller;

use App\Entity\TutorialRating;
use App\Repository\TutorialRatingRepository;
use App\Repository\TutorialRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

class TutorialRatingController extends AbstractController
{
    #[Route('/api/tutorial-ratings/batch', name: 'api_tutorial_ratings_batch', methods: ['GET'])]
    public function batch(
        Request $request,
        TutorialRatingRepository $repo,
    ): JsonResponse {
        $ids = array_filter(array_map('intval', explode(',', $request->query->get('ids', ''))));
        if (empty($ids)) {
            return $this->json([]);
        }

        $ratings = $repo->createQueryBuilder('r')
            ->where('r.tutorial IN (:ids)')
            ->setParameter('ids', $ids)
            ->getQuery()
            ->getResult();

        $grouped = [];
        foreach ($ratings as $r) {
            $tid = $r->getTutorial()->getId();
            if (!isset($grouped[$tid])) {
                $grouped[$tid] = ['sum' => 0, 'count' => 0];
            }
            $grouped[$tid]['sum']   += $r->getRating();
            $grouped[$tid]['count'] += 1;
        }

        $result = [];
        foreach ($grouped as $tid => $data) {
            $result[$tid] = [
                'average' => round($data['sum'] / $data['count'], 1),
                'count'   => $data['count'],
            ];
        }

        return $this->json($result);
    }

    #[Route('/api/tutorials/{id}/rating', name: 'api_tutorial_rating_get', methods: ['GET'])]
    public function get(
        int $id,
        TutorialRatingRepository $repo,
    ): JsonResponse {
        $ratings = $repo->findBy(['tutorial' => $id]);

        $count   = count($ratings);
        $average = $count > 0
            ? round(array_sum(array_map(fn($r) => $r->getRating(), $ratings)) / $count, 1)
            : 0;

        $userRating = null;
        if ($this->getUser()) {
            foreach ($ratings as $r) {
                if ($r->getUser()->getId() === $this->getUser()->getId()) {
                    $userRating = $r->getRating();
                    break;
                }
            }
        }

        return $this->json([
            'average'    => $average,
            'count'      => $count,
            'userRating' => $userRating,
        ]);
    }

    #[Route('/api/tutorials/{id}/rating', name: 'api_tutorial_rating_post', methods: ['POST'])]
    public function rate(
        int $id,
        Request $request,
        TutorialRatingRepository $repo,
        TutorialRepository $tutorialRepo,
        EntityManagerInterface $em,
    ): JsonResponse {
        $user = $this->getUser();
        if (!$user) {
            return $this->json(['error' => 'Non authentifié.'], 401);
        }

        $data   = json_decode($request->getContent(), true);
        $rating = (int) ($data['rating'] ?? 0);

        if ($rating < 1 || $rating > 5) {
            return $this->json(['error' => 'La note doit être entre 1 et 5.'], 422);
        }

        $tutorial = $tutorialRepo->find($id);
        if (!$tutorial) {
            return $this->json(['error' => 'Tutoriel introuvable.'], 404);
        }

        $existing = $repo->findOneBy(['user' => $user, 'tutorial' => $tutorial]);
        if ($existing) {
            $existing->setRating($rating);
        } else {
            $existing = (new TutorialRating())
                ->setUser($user)
                ->setTutorial($tutorial)
                ->setRating($rating);
            $em->persist($existing);
        }

        $em->flush();

        $ratings = $repo->findBy(['tutorial' => $tutorial]);
        $count   = count($ratings);
        $average = round(array_sum(array_map(fn($r) => $r->getRating(), $ratings)) / $count, 1);

        return $this->json(['average' => $average, 'count' => $count, 'userRating' => $rating]);
    }
}
