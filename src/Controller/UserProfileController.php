<?php

namespace App\Controller;

use App\Entity\Comment;
use App\Repository\TutorialRatingRepository;
use App\Repository\TutorialRepository;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

class UserProfileController extends AbstractController
{
    /**
     * Public profile stats: total views, tutorial count, avg rating across all tutorials.
     */
    #[Route('/api/users/{id}/profile-stats', name: 'api_user_profile_stats', methods: ['GET'])]
    public function profileStats(
        int $id,
        UserRepository $userRepo,
        TutorialRepository $tutorialRepo,
        TutorialRatingRepository $ratingRepo,
    ): JsonResponse {
        $user = $userRepo->find($id);
        if (!$user) {
            return $this->json(['error' => 'Utilisateur introuvable.'], 404);
        }

        $tutorials = $tutorialRepo->findBy(['author' => $user, 'published' => true]);

        $totalViews    = 0;
        $totalRatings  = 0;
        $ratingSum     = 0;

        foreach ($tutorials as $tuto) {
            $totalViews += $tuto->getViewCount();
            $ratings     = $ratingRepo->findBy(['tutorial' => $tuto]);
            $totalRatings += count($ratings);
            $ratingSum    += array_sum(array_map(fn($r) => $r->getRating(), $ratings));
        }

        return $this->json([
            'tutorialCount' => count($tutorials),
            'totalViews'    => $totalViews,
            'avgRating'     => $totalRatings > 0 ? round($ratingSum / $totalRatings, 1) : null,
        ]);
    }

    /**
     * Per-tutorial stats for a user (views, avg rating, comment count).
     * Used by the creator dashboard (MyTutorialsPage).
     */
    #[Route('/api/users/{id}/tutorial-stats', name: 'api_user_tutorial_stats', methods: ['GET'])]
    public function tutorialStats(
        int $id,
        UserRepository $userRepo,
        TutorialRepository $tutorialRepo,
        TutorialRatingRepository $ratingRepo,
        EntityManagerInterface $em,
    ): JsonResponse {
        $user = $userRepo->find($id);
        if (!$user) {
            return $this->json([]);
        }

        // Only the owner or admin can see detailed stats
        $currentUser = $this->getUser();
        if (!$currentUser || ($currentUser->getId() !== $user->getId() && !in_array('ROLE_ADMIN', $currentUser->getRoles()))) {
            return $this->json([], 403);
        }

        $tutorials = $tutorialRepo->findBy(['author' => $user], ['createdAt' => 'DESC']);
        $result    = [];

        foreach ($tutorials as $tuto) {
            $ratings      = $ratingRepo->findBy(['tutorial' => $tuto]);
            $ratingCount  = count($ratings);
            $avgRating    = $ratingCount > 0
                ? round(array_sum(array_map(fn($r) => $r->getRating(), $ratings)) / $ratingCount, 1)
                : null;
            $commentCount = (int) $em->createQueryBuilder()
                ->select('COUNT(c.id)')
                ->from(Comment::class, 'c')
                ->where('c.tutorial = :tuto')
                ->setParameter('tuto', $tuto)
                ->getQuery()
                ->getSingleScalarResult();

            $result[$tuto->getId()] = [
                'viewCount'    => $tuto->getViewCount(),
                'avgRating'    => $avgRating,
                'ratingCount'  => $ratingCount,
                'commentCount' => $commentCount,
            ];
        }

        return $this->json($result);
    }
}
