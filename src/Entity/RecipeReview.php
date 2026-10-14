<?php

namespace App\Entity;

use App\Repository\RecipeReviewRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: RecipeReviewRepository::class)]
#[ORM\UniqueConstraint(name: 'unique_user_recipe_review', columns: ['author_id', 'spoonacular_id'])]
#[ORM\Index(fields: ['spoonacularId'])]
class RecipeReview
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 50)]
    private string $spoonacularId = '';

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    private ?User $author = null;

    #[ORM\Column(type: 'smallint')]
    private int $rating = 0;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $comment = null;

    #[ORM\Column]
    private \DateTimeImmutable $createdAt;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
    }

    public function getId(): ?int { return $this->id; }
    public function getSpoonacularId(): string { return $this->spoonacularId; }
    public function setSpoonacularId(string $id): static { $this->spoonacularId = $id; return $this; }
    public function getAuthor(): ?User { return $this->author; }
    public function setAuthor(?User $author): static { $this->author = $author; return $this; }
    public function getRating(): int { return $this->rating; }
    public function setRating(int $rating): static { $this->rating = $rating; return $this; }
    public function getComment(): ?string { return $this->comment; }
    public function setComment(?string $comment): static { $this->comment = $comment; return $this; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
}
