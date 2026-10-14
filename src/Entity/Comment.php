<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Link;
use ApiPlatform\Doctrine\Orm\Filter\OrderFilter;
use ApiPlatform\Metadata\ApiFilter;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity]
#[ORM\Index(fields: ['createdAt'])]
#[ApiResource(
    normalizationContext: ['groups' => ['comment:read']],
    denormalizationContext: ['groups' => ['comment:write']],
    operations: [
        new GetCollection(cacheHeaders: ['max_age' => 0, 'shared_max_age' => 30, 'vary' => ['Accept']]),
        new Post(
            security: "is_granted('ROLE_USER')",
            processor: \App\State\CommentCreateProcessor::class,
        ),
        new Patch(
            security: "is_granted('ROLE_USER') and object.getAuthor() == user",
        ),
        new Delete(
            security: "is_granted('ROLE_ADMIN') or (is_granted('ROLE_USER') and object.getAuthor() == user)",
        ),
    ],
)]
#[ApiResource(
    uriTemplate: '/tutorials/{tutorialId}/comments',
    uriVariables: [
        'tutorialId' => new Link(fromClass: Tutorial::class, toProperty: 'tutorial'),
    ],
    operations: [new GetCollection()],
    normalizationContext: ['groups' => ['comment:read']],
    order: ['createdAt' => 'DESC'],
)]
#[ApiFilter(OrderFilter::class, properties: ['createdAt'])]
class Comment
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['comment:read'])]
    private ?int $id = null;

    #[ORM\Column(type: 'text')]
    #[Assert\NotBlank]
    #[Assert\Length(min: 1, max: 2000)]
    #[Groups(['comment:read', 'comment:write'])]
    private ?string $content = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['comment:read'])]
    private ?User $author = null;

    #[ORM\ManyToOne(targetEntity: Tutorial::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['comment:write'])]
    private ?Tutorial $tutorial = null;

    #[ORM\Column]
    #[Groups(['comment:read'])]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }

    public function getContent(): ?string { return $this->content; }
    public function setContent(string $content): static { $this->content = $content; return $this; }

    public function getAuthor(): ?User { return $this->author; }
    public function setAuthor(?User $author): static { $this->author = $author; return $this; }

    public function getTutorial(): ?Tutorial { return $this->tutorial; }
    public function setTutorial(?Tutorial $tutorial): static { $this->tutorial = $tutorial; return $this; }

    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}
