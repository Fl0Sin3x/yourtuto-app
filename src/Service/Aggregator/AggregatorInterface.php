<?php

namespace App\Service\Aggregator;

interface AggregatorInterface
{
    /**
     * Fetch tutorials from the external source and persist new ones.
     *
     * @param array<string, mixed> $options  e.g. ['query' => 'symfony', 'maxResults' => 20]
     * @return array{count: int, externalIds: string[]}
     */
    public function aggregate(array $options = []): array;
}
