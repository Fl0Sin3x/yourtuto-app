<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use App\Repository\TagRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: TagRepository::class)]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    normalizationContext: ['groups' => ['tag:read']],
    operations: [
        new GetCollection(cacheHeaders: ['max_age' => 0, 'shared_max_age' => 300, 'vary' => ['Accept']]),
        new Get(),
    ]
)]
class Tag
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['tag:read', 'tutorial:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 80, unique: true)]
    #[Assert\NotBlank]
    #[Groups(['tag:read', 'tutorial:read', 'tutorial:write'])]
    private ?string $name = null;

    #[ORM\Column(length: 100, unique: true)]
    #[Groups(['tag:read'])]
    private ?string $slug = null;

    #[ORM\ManyToMany(mappedBy: 'tags', targetEntity: Tutorial::class)]
    private Collection $tutorials;

    public function __construct()
    {
        $this->tutorials = new ArrayCollection();
    }

    #[ORM\PrePersist]
    public function ensureSlug(): void
    {
        if (!$this->slug && $this->name) {
            $text = mb_strtolower($this->name);
            $text = preg_replace('/[^a-z0-9]+/', '-', $text) ?? '';
            $this->slug = trim($text, '-') ?: 'tag-' . uniqid();
        }
    }

    public function getId(): ?int { return $this->id; }

    public function getName(): ?string { return $this->name; }
    public function setName(string $name): static { $this->name = $name; return $this; }

    public function getSlug(): ?string { return $this->slug; }
    public function setSlug(string $slug): static { $this->slug = $slug; return $this; }

    public function getTutorials(): Collection { return $this->tutorials; }
}
