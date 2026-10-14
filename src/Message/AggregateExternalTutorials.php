<?php

namespace App\Message;

final class AggregateExternalTutorials
{
    public function __construct(
        public readonly string $source,
        public readonly array  $options = [],
    ) {}
}
