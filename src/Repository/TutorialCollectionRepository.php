<?php

namespace App\Repository;

use App\Entity\TutorialCollection;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<TutorialCollection> */
class TutorialCollectionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, TutorialCollection::class);
    }

    /** @return list<array{slug: string, updatedAt: \DateTimeImmutable}> */
    public function publicSlugs(int $max = 1000): array
    {
        return $this->createQueryBuilder('c')->select('c.slug', 'c.updatedAt')
            ->where('c.public = true')->orderBy('c.updatedAt', 'DESC')->setMaxResults($max)
            ->getQuery()->getArrayResult();
    }
}
