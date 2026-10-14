<?php

namespace App\Filter;

use ApiPlatform\Doctrine\Orm\Filter\AbstractFilter;
use ApiPlatform\Doctrine\Orm\Util\QueryNameGeneratorInterface;
use ApiPlatform\Metadata\Operation;
use Doctrine\ORM\QueryBuilder;

/**
 * Custom OR filter: ?search=foo matches title OR description
 */
final class TutorialSearchFilter extends AbstractFilter
{
    protected function filterProperty(
        string $property,
        mixed $value,
        QueryBuilder $queryBuilder,
        QueryNameGeneratorInterface $queryNameGenerator,
        string $resourceClass,
        ?Operation $operation = null,
        array $context = []
    ): void {
        if ($property !== 'search' || empty($value)) {
            return;
        }

        $alias      = $queryBuilder->getRootAliases()[0];
        $paramName  = $queryNameGenerator->generateParameterName('search');

        $queryBuilder
            ->andWhere(
                $queryBuilder->expr()->orX(
                    $queryBuilder->expr()->like("{$alias}.title", ":{$paramName}"),
                    $queryBuilder->expr()->like("{$alias}.description", ":{$paramName}"),
                )
            )
            ->setParameter($paramName, '%' . addcslashes($value, '%_') . '%');
    }

    public function getDescription(string $resourceClass): array
    {
        return [
            'search' => [
                'property' => null,
                'type'     => 'string',
                'required' => false,
                'description' => 'Search in title and description (OR)',
            ],
        ];
    }
}
