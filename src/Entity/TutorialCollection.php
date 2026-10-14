<?php

namespace App\Entity;

use App\Repository\TutorialCollectionRepository;
use Doctrine\ORM\Mapping as ORM;

/**
 * A user-curated list of tutorials, shareable at /c/{slug} when public.
 */
#[ORM\Entity(repositoryClass: TutorialCollectionRepository::class)]
#[ORM\Index(columns: ['owner_id'], name: 'idx_tutorial_collection_owner')]
class TutorialCollection
{
    public const MAX_ITEMS = 100;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private User $owner;

    #[ORM\Column(length: 140, unique: true)]
    private string $slug;

    #[ORM\Column(length: 120)]
    private string $title;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $description = null;

    /** @var list<int> */
    #[ORM\Column(type: 'json', options: ['jsonb' => true])]
    private array $tutorialIds = [];

    #[ORM\Column(options: ['default' => false])]
    private bool $public = false;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column]
    private \DateTimeImmutable $updatedAt;

    public function __construct(User $owner, string $slug, string $title)
    {
        $this->owner     = $owner;
        $this->slug      = $slug;
        $this->title     = $title;
        $this->createdAt = $this->updatedAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }
    public function getOwner(): User { return $this->owner; }
    public function getSlug(): string { return $this->slug; }
    public function getTitle(): string { return $this->title; }
    public function setTitle(string $t): static { $this->title = $t; return $this->touch(); }
    public function getDescription(): ?string { return $this->description; }
    public function setDescription(?string $d): static { $this->description = $d; return $this->touch(); }
    /** @return list<int> */
    public function getTutorialIds(): array { return $this->tutorialIds; }
    /** @param list<int> $ids */
    public function setTutorialIds(array $ids): static
    {
        $this->tutorialIds = array_slice(array_values(array_unique(array_map('intval', $ids))), 0, self::MAX_ITEMS);
        return $this->touch();
    }
    public function addTutorialId(int $id): static { return $this->setTutorialIds([...$this->tutorialIds, $id]); }
    public function removeTutorialId(int $id): static { return $this->setTutorialIds(array_filter($this->tutorialIds, fn ($x) => $x !== $id)); }
    public function isPublic(): bool { return $this->public; }
    public function setPublic(bool $p): static { $this->public = $p; return $this->touch(); }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
    public function getUpdatedAt(): \DateTimeImmutable { return $this->updatedAt; }
    private function touch(): static { $this->updatedAt = new \DateTimeImmutable(); return $this; }
}
