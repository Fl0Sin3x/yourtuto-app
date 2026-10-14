<?php

namespace App\Entity;

use App\Repository\UserProgressRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: UserProgressRepository::class)]
#[ORM\UniqueConstraint(columns: ['user_id', 'item_slug', 'source'])]
class UserProgress
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private int $id;

    #[ORM\ManyToOne]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column(length: 300)]
    private string $itemSlug;

    #[ORM\Column(length: 50)]
    private string $source;

    #[ORM\Column(length: 255)]
    private string $title;

    #[ORM\Column(nullable: true)]
    private ?string $thumbnailUrl = null;

    #[ORM\Column(nullable: true)]
    private ?string $externalUrl = null;

    #[ORM\Column]
    private \DateTimeImmutable $completedAt;

    #[ORM\Column(options: ['default' => false])]
    private bool $isDone = false;

    public function __construct(User $user, string $itemSlug, string $source, string $title, ?string $thumbnailUrl, ?string $externalUrl)
    {
        $this->user         = $user;
        $this->itemSlug     = $itemSlug;
        $this->source       = $source;
        $this->title        = $title;
        $this->thumbnailUrl = $thumbnailUrl;
        $this->externalUrl  = $externalUrl;
        $this->completedAt  = new \DateTimeImmutable();
    }

    public function getId(): int               { return $this->id; }
    public function getUser(): User            { return $this->user; }
    public function getItemSlug(): string      { return $this->itemSlug; }
    public function getSource(): string        { return $this->source; }
    public function getTitle(): string         { return $this->title; }
    public function getThumbnailUrl(): ?string { return $this->thumbnailUrl; }
    public function getExternalUrl(): ?string  { return $this->externalUrl; }
    public function getCompletedAt(): \DateTimeImmutable { return $this->completedAt; }
    public function isDone(): bool             { return $this->isDone; }
    public function setIsDone(bool $isDone): void { $this->isDone = $isDone; }
}
