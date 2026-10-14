<?php

namespace App\Entity;

use App\Repository\LearningPathRepository;
use Doctrine\ORM\Mapping as ORM;

/**
 * A curated, ordered sequence of tutorials (e.g. "Build with LLMs").
 * Steps are stored as an ordered list of tutorial ids.
 */
#[ORM\Entity(repositoryClass: LearningPathRepository::class)]
class LearningPath
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 120, unique: true)]
    private string $slug;

    #[ORM\Column(length: 150)]
    private string $title;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $description = null;

    #[ORM\Column(length: 20, nullable: true)]
    private ?string $level = null;

    #[ORM\Column(length: 10, nullable: true)]
    private ?string $icon = null;

    /** @var list<int> */
    #[ORM\Column(type: 'json')]
    private array $tutorialIds = [];

    #[ORM\Column(options: ['default' => true])]
    private bool $published = true;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    public function __construct(string $slug, string $title)
    {
        $this->slug      = $slug;
        $this->title     = $title;
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }
    public function getSlug(): string { return $this->slug; }
    public function getTitle(): string { return $this->title; }
    public function setTitle(string $title): static { $this->title = $title; return $this; }
    public function getDescription(): ?string { return $this->description; }
    public function setDescription(?string $d): static { $this->description = $d; return $this; }
    public function getLevel(): ?string { return $this->level; }
    public function setLevel(?string $level): static { $this->level = $level; return $this; }
    public function getIcon(): ?string { return $this->icon; }
    public function setIcon(?string $icon): static { $this->icon = $icon; return $this; }
    /** @return list<int> */
    public function getTutorialIds(): array { return $this->tutorialIds; }
    /** @param list<int> $ids */
    public function setTutorialIds(array $ids): static { $this->tutorialIds = array_values(array_unique(array_map('intval', $ids))); return $this; }
    public function isPublished(): bool { return $this->published; }
    public function setPublished(bool $p): static { $this->published = $p; return $this; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}
