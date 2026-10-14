<?php

namespace App\Controller;

use App\Entity\RecipeReview;
use App\Repository\RecipeReviewRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

class RecipeReviewController extends AbstractController
{
    #[Route('/api/recipe/{spoonacularId}/reviews', name: 'api_recipe_reviews_get', methods: ['GET'])]
    public function get(
        string $spoonacularId,
        RecipeReviewRepository $repo,
    ): JsonResponse {
        $reviews = $repo->findBy(['spoonacularId' => $spoonacularId], ['createdAt' => 'DESC']);

        $count   = count($reviews);
        $average = $count > 0
            ? round(array_sum(array_map(fn($r) => $r->getRating(), $reviews)) / $count, 1)
            : 0;

        $userReviewId = null;
        $userRating   = null;
        if ($this->getUser()) {
            foreach ($reviews as $r) {
                if ($r->getAuthor()->getId() === $this->getUser()->getId()) {
                    $userReviewId = $r->getId();
                    $userRating   = $r->getRating();
                    break;
                }
            }
        }

        return $this->json([
            'average'      => $average,
            'count'        => $count,
            'userReviewId' => $userReviewId,
            'userRating'   => $userRating,
            'reviews'      => array_map(fn($r) => [
                'id'        => $r->getId(),
                'rating'    => $r->getRating(),
                'comment'   => $r->getComment(),
                'createdAt' => $r->getCreatedAt()->format('Y-m-d\TH:i:s'),
                'author'    => ['id' => $r->getAuthor()->getId(), 'username' => $r->getAuthor()->getUsername()],
            ], $reviews),
        ]);
    }

    #[Route('/api/recipe/{spoonacularId}/reviews', name: 'api_recipe_reviews_post', methods: ['POST'])]
    public function create(
        string $spoonacularId,
        Request $request,
        RecipeReviewRepository $repo,
        EntityManagerInterface $em,
    ): JsonResponse {
        $user = $this->getUser();
        if (!$user) {
            return $this->json(['error' => 'Non authentifié.'], 401);
        }

        $data    = json_decode($request->getContent(), true);
        $rating  = (int) ($data['rating'] ?? 0);
        $comment = isset($data['comment']) ? trim($data['comment']) : null;

        if ($rating < 1 || $rating > 5) {
            return $this->json(['error' => 'La note doit être entre 1 et 5.'], 422);
        }
        if ($comment !== null && strlen($comment) > 1000) {
            return $this->json(['error' => 'Le commentaire ne peut pas dépasser 1000 caractères.'], 422);
        }

        $existing = $repo->findOneBy(['author' => $user, 'spoonacularId' => $spoonacularId]);
        if ($existing) {
            $existing->setRating($rating);
            $existing->setComment($comment ?: null);
        } else {
            $existing = (new RecipeReview())
                ->setSpoonacularId($spoonacularId)
                ->setAuthor($user)
                ->setRating($rating)
                ->setComment($comment ?: null);
            $em->persist($existing);
        }

        $em->flush();

        $reviews = $repo->findBy(['spoonacularId' => $spoonacularId], ['createdAt' => 'DESC']);
        $count   = count($reviews);
        $average = round(array_sum(array_map(fn($r) => $r->getRating(), $reviews)) / $count, 1);

        return $this->json([
            'average'      => $average,
            'count'        => $count,
            'userReviewId' => $existing->getId(),
            'userRating'   => $rating,
            'reviews'      => array_map(fn($r) => [
                'id'        => $r->getId(),
                'rating'    => $r->getRating(),
                'comment'   => $r->getComment(),
                'createdAt' => $r->getCreatedAt()->format('Y-m-d\TH:i:s'),
                'author'    => ['id' => $r->getAuthor()->getId(), 'username' => $r->getAuthor()->getUsername()],
            ], $reviews),
        ]);
    }

    #[Route('/api/recipe-reviews/{id}', name: 'api_recipe_reviews_delete', methods: ['DELETE'])]
    public function delete(
        int $id,
        RecipeReviewRepository $repo,
        EntityManagerInterface $em,
    ): JsonResponse {
        $user   = $this->getUser();
        $review = $repo->find($id);

        if (!$review) {
            return $this->json(['error' => 'Avis introuvable.'], 404);
        }
        if (!$user || $review->getAuthor()->getId() !== $user->getId()) {
            return $this->json(['error' => 'Non autorisé.'], 403);
        }

        $em->remove($review);
        $em->flush();

        return $this->json(null, 204);
    }
}
