<?php

namespace App\Repository;

use App\Entity\Tutorial;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class TutorialRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Tutorial::class);
    }

    public function findByExternalId(string $externalId): ?Tutorial
    {
        return $this->findOneBy(['externalId' => $externalId]);
    }

    /**
     * Returns up to $limit published tutorials whose slugs are not in $excludeSlugs, in random order.
     *
     * @param  string[] $excludeSlugs
     * @return Tutorial[]
     */
    /**
     * Returns published tutorials for a given source with JOIN FETCH (no N+1).
     *
     * @return Tutorial[]
     */
    public function findPublishedBySource(string $source, int $limit): array
    {
        return $this->createQueryBuilder('t')
            ->leftJoin('t.categories', 'c')->addSelect('c')
            ->leftJoin('t.tags', 'tag')->addSelect('tag')
            ->leftJoin('t.author', 'a')->addSelect('a')
            ->where('t.published = true')
            ->andWhere('t.source = :source')
            ->setParameter('source', $source)
            ->orderBy('t.id', 'DESC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }

    /**
     * Returns up to $limit published tutorials whose slugs are not in $excludeSlugs, in random order.
     *
     * @param  string[] $excludeSlugs
     * @return Tutorial[]
     */
    public function findCandidatesExcluding(array $excludeSlugs, int $limit = 50): array
    {
        $qb = $this->createQueryBuilder('t')
            ->leftJoin('t.categories', 'c')->addSelect('c')
            ->leftJoin('t.tags', 'tag')->addSelect('tag')
            ->leftJoin('t.author', 'a')->addSelect('a')
            ->where('t.published = true')
            ->setMaxResults($limit);

        if (!empty($excludeSlugs)) {
            $qb->andWhere('t.slug NOT IN (:slugs)')
               ->setParameter('slugs', $excludeSlugs);
        }

        $results = $qb->getQuery()->getResult();
        shuffle($results);

        return $results;
    }
}
