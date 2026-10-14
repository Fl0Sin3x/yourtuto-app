<?php

namespace App\Controller;

use App\Entity\Tutorial;
use App\Service\RecommendationService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/recommendations', methods: ['GET'])]
#[IsGranted('ROLE_USER')]
class RecommendationController extends AbstractController
{
    public function __construct(private readonly RecommendationService $recommendationService) {}

    public function __invoke(): JsonResponse
    {
        $tutorials = $this->recommendationService->getRecommendations($this->getUser());

        return $this->json(array_map(fn(Tutorial $t) => [
            'id'           => $t->getId(),
            'title'        => $t->getTitle(),
            'slug'         => $t->getSlug(),
            'description'  => $t->getDescription(),
            'externalUrl'  => $t->getExternalUrl(),
            'thumbnailUrl' => $t->getThumbnailUrl(),
            'source'       => $t->getSource()->value,
            'externalId'   => $t->getExternalId(),
            'published'    => $t->isPublished(),
            'createdAt'    => $t->getCreatedAt()->format(\DateTimeInterface::ATOM),
            'updatedAt'    => $t->getUpdatedAt()?->format(\DateTimeInterface::ATOM),
            'author'       => $t->getAuthor() ? ['id' => $t->getAuthor()->getId(), 'username' => $t->getAuthor()->getUsername()] : null,
            'categories'   => array_map(fn($c) => ['id' => $c->getId(), 'name' => $c->getName(), 'slug' => $c->getSlug()], $t->getCategories()->toArray()),
            'tags'         => array_map(fn($tag) => ['id' => $tag->getId(), 'name' => $tag->getName(), 'slug' => $tag->getSlug()], $t->getTags()->toArray()),
        ], $tutorials));
    }
}
