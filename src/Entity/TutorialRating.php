<?php

namespace App\Entity;

use App\Repository\TutorialRatingRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: TutorialRatingRepository::class)]
#[ORM\UniqueConstraint(name: 'unique_user_tutorial_rating', columns: ['user_id', 'tutorial_id'])]
class TutorialRating
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?User $user = null;

    #[ORM\ManyToOne(targetEntity: Tutorial::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?Tutorial $tutorial = null;

    #[ORM\Column(type: 'smallint')]
    private int $rating = 0;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }
    public function getUser(): ?User { return $this->user; }
    public function setUser(?User $user): static { $this->user = $user; return $this; }
    public function getTutorial(): ?Tutorial { return $this->tutorial; }
    public function setTutorial(?Tutorial $tutorial): static { $this->tutorial = $tutorial; return $this; }
    public function getRating(): int { return $this->rating; }
    public function setRating(int $rating): static { $this->rating = $rating; return $this; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}
