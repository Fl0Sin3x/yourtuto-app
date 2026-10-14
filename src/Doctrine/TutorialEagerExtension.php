<?php

namespace App\Doctrine;

use ApiPlatform\Doctrine\Orm\Extension\QueryCollectionExtensionInterface;
use ApiPlatform\Doctrine\Orm\Util\QueryNameGeneratorInterface;
use ApiPlatform\Metadata\Operation;
use App\Entity\Tutorial;
use Doctrine\ORM\QueryBuilder;

/**
 * Forces LEFT JOIN FETCH on author/categories/tags when listing tutorials,
 * eliminating N+1 queries to the remote PostgreSQL instance.
 */
final class TutorialEagerExtension implements QueryCollectionExtensionInterface
{
    public function applyToCollection(
        QueryBuilder $queryBuilder,
        QueryNameGeneratorInterface $queryNameGenerator,
        string $resourceClass,
        ?Operation $operation = null,
        array $context = [],
    ): void {
        if ($resourceClass !== Tutorial::class) {
            return;
        }

        $alias = $queryBuilder->getRootAliases()[0];

        $queryBuilder
            ->addSelect('_author', '_categories', '_tags')
            ->leftJoin("{$alias}.author",     '_author')
            ->leftJoin("{$alias}.categories", '_categories')
            ->leftJoin("{$alias}.tags",        '_tags');
    }
}
