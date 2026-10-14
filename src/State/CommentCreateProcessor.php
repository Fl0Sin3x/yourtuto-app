<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\Comment;
use Symfony\Bundle\SecurityBundle\Security;

final class CommentCreateProcessor implements ProcessorInterface
{
    public function __construct(
        private readonly ProcessorInterface $inner,
        private readonly Security           $security,
    ) {}

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        if ($data instanceof Comment && !$data->getAuthor()) {
            $data->setAuthor($this->security->getUser());
        }

        return $this->inner->process($data, $operation, $uriVariables, $context);
    }
}
