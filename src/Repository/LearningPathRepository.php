<?php

namespace App\Repository;

use App\Entity\LearningPath;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<LearningPath> */
class LearningPathRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, LearningPath::class);
    }

    /** @return LearningPath[] */
    public function findPublished(): array
    {
        return $this->findBy(['published' => true], ['id' => 'ASC']);
    }
}
