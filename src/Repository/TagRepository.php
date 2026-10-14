<?php

namespace App\Repository;

use App\Entity\Tag;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

class TagRepository extends ServiceEntityRepository
{
    /** @var array<string, Tag> */
    private array $cache = [];

    public function clearCache(): void
    {
        $this->cache = [];
    }

    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Tag::class);
    }

    public function findOrCreate(string $name, string $slug): Tag
    {
        if (isset($this->cache[$slug])) {
            $tag = $this->cache[$slug];
            if ($this->getEntityManager()->contains($tag)) {
                return $tag;
            }
            unset($this->cache[$slug]);
        }

        $tag = $this->findOneBy(['slug' => $slug]);

        if (!$tag) {
            $tag = new Tag();
            $tag->setName($name)->setSlug($slug);
            $this->getEntityManager()->persist($tag);
        }

        return $this->cache[$slug] = $tag;
    }
}
