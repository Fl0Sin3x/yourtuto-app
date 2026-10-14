<?php

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\Tutorial;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\SecurityBundle\Security;

final class TutorialCreateProcessor implements ProcessorInterface
{
    public function __construct(
        private readonly ProcessorInterface    $inner,
        private readonly Security              $security,
        private readonly EntityManagerInterface $em,
    ) {}

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): mixed
    {
        if (!$data instanceof Tutorial) {
            return $this->inner->process($data, $operation, $uriVariables, $context);
        }

        /** @var User|null $user */
        $user = $this->security->getUser();
        if ($user) {
            $data->setAuthor($user);
        }

        if (!$data->getSlug()) {
            $data->setSlug($this->generateUniqueSlug($data->getTitle() ?? 'tutorial'));
        }

        return $this->inner->process($data, $operation, $uriVariables, $context);
    }

    private function generateUniqueSlug(string $title): string
    {
        $base = $this->slugify($title);
        $slug = $base;
        $i    = 1;

        $repo = $this->em->getRepository(Tutorial::class);
        while ($repo->findOneBy(['slug' => $slug])) {
            $slug = $base . '-' . $i++;
        }

        return $slug;
    }

    private function slugify(string $text): string
    {
        $text = transliterator_transliterate('Any-Latin; Latin-ASCII', $text) ?? $text;
        $text = mb_strtolower($text);
        $text = preg_replace('/[^a-z0-9]+/', '-', $text);
        return trim($text, '-');
    }
}
