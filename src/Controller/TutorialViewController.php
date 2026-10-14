<?php

namespace App\Controller;

use App\Repository\TutorialRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use App\Service\SimilarityScorer;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;

class TutorialViewController extends AbstractController
{
    #[Route('/api/tutorials/{id}/view', name: 'api_tutorial_view', methods: ['POST'])]
    public function incrementView(
        int $id,
        TutorialRepository $repo,
        EntityManagerInterface $em,
    ): JsonResponse {
        $tutorial = $repo->find($id);
        if (!$tutorial) {
            return $this->json(['error' => 'Tutoriel introuvable.'], 404);
        }

        $tutorial->incrementViewCount();
        $em->flush();

        return $this->json(['viewCount' => $tutorial->getViewCount()]);
    }

    #[Route('/api/tutorials/{id}/related', name: 'api_tutorial_related', methods: ['GET'])]
    public function related(
        int $id,
        TutorialRepository $repo,
        SerializerInterface $serializer,
        SimilarityScorer $scorer,
        Request $request,
        CacheInterface $cache,
    ): JsonResponse {
        $limit = min(12, max(1, (int) $request->query->get('limit', 6)));

        // Similarity ranking is costly (several queries + scoring): cache the JSON 1h per tutorial/limit
        $json = $cache->get(sprintf('related_%d_%d', $id, $limit), function (ItemInterface $item) use ($id, $limit, $repo, $serializer, $scorer): string {
            $item->expiresAfter(3600);

            return $this->computeRelated($id, $limit, $repo, $serializer, $scorer);
        });

        $response = new JsonResponse($json, 200, [], true);
        $response->setPublic();
        $response->setMaxAge(300);

        return $response;
    }

    private function computeRelated(int $id, int $limit, TutorialRepository $repo, SerializerInterface $serializer, SimilarityScorer $scorer): string
    {
        $tutorial = $repo->find($id);
        if (!$tutorial) {
            return '[]';
        }

        $tagIds      = $tutorial->getTags()->map(fn($t) => $t->getId())->toArray();
        $categoryIds = $tutorial->getCategories()->map(fn($c) => $c->getId())->toArray();

        // Candidate pool built from cheap id-only queries (a DISTINCT over joined full rows timed out on preprod),
        // then hydrated with tags/categories in one query and ranked by content similarity.
        $idsFor = function (?string $join, string $cond, array $params, int $max) use ($repo, $id): array {
            $qb = $repo->createQueryBuilder('t')->select('t.id')
                ->where('t.id != :id')->andWhere('t.published = true')->andWhere($cond)
                ->setParameter('id', $id)->orderBy('t.id', 'DESC')->setMaxResults($max);
            if ($join) {
                $qb->innerJoin($join, 'j');
            }
            foreach ($params as $k => $v) {
                $qb->setParameter($k, $v);
            }

            return array_column($qb->getQuery()->getScalarResult(), 'id');
        };

        $ids = [];
        if (!empty($tagIds)) {
            $ids = array_merge($ids, $idsFor('t.tags', 'j.id IN (:ids)', ['ids' => $tagIds], 80));
        }
        if (!empty($categoryIds)) {
            $ids = array_merge($ids, $idsFor('t.categories', 'j.id IN (:ids)', ['ids' => $categoryIds], 60));
        }
        $ids = array_merge($ids, $idsFor(null, 't.source = :source', ['source' => $tutorial->getSource()], 40));
        $ids = array_slice(array_values(array_unique(array_map('intval', $ids))), 0, 150);

        $candidates = $ids === [] ? [] : $repo->createQueryBuilder('t')
            ->addSelect('tag', 'cat')
            ->leftJoin('t.tags', 'tag')
            ->leftJoin('t.categories', 'cat')
            ->where('t.id IN (:ids)')
            ->setParameter('ids', $ids)
            ->getQuery()->getResult();

        $related = $scorer->rank($tutorial, $candidates, $limit);

        return $serializer->serialize($related, 'json', ['groups' => ['tutorial:list']]);
    }
}
