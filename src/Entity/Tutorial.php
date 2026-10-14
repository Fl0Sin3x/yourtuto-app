<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiFilter;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Doctrine\Orm\Filter\OrderFilter;
use App\Filter\TutorialSearchFilter;
use App\Enum\TutorialSource;
use App\Repository\TutorialRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: TutorialRepository::class)]
#[ORM\HasLifecycleCallbacks]
#[ORM\Index(fields: ['createdAt'])]
#[ORM\Index(fields: ['source'])]
#[ORM\Index(fields: ['source', 'createdAt'])]
#[ApiResource(
    normalizationContext: ['groups' => ['tutorial:read']],
    denormalizationContext: ['groups' => ['tutorial:write']],
    operations: [
        new GetCollection(
            paginationPartial: true,
            normalizationContext: ['groups' => ['tutorial:list']],
            cacheHeaders: ['max_age' => 0, 'shared_max_age' => 90, 'vary' => ['Accept']],
        ),
        new Get(cacheHeaders: ['max_age' => 0, 'shared_max_age' => 60, 'vary' => ['Accept']]),
        new Post(
            security: "is_granted('ROLE_USER')",
            processor: \App\State\TutorialCreateProcessor::class,
        ),
        new Patch(security: "is_granted('ROLE_ADMIN') or (is_granted('ROLE_USER') and object.getAuthor() == user)"),
        new Delete(security: "is_granted('ROLE_ADMIN') or (is_granted('ROLE_USER') and object.getAuthor() == user)"),
    ]
)]
#[ApiFilter(TutorialSearchFilter::class)]
#[ApiFilter(SearchFilter::class, properties: [
    'source'     => 'exact',
    'categories' => 'exact',
    'tags'       => 'exact',
    'author'     => 'exact',
    'difficulty' => 'exact',
])]
#[ApiFilter(OrderFilter::class, properties: ['createdAt', 'title', 'viewCount'])]
class Tutorial
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['tutorial:read', 'tutorial:list'])]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Assert\NotBlank]
    #[Assert\Length(max: 255)]
    #[Groups(['tutorial:read', 'tutorial:list', 'tutorial:write'])]
    private ?string $title = null;

    #[ORM\Column(length: 300, unique: true)]
    #[Groups(['tutorial:read', 'tutorial:list'])]
    private ?string $slug = null;

    #[ORM\Column(type: 'text', nullable: true)]
    #[Groups(['tutorial:read', 'tutorial:list', 'tutorial:write'])]
    private ?string $description = null;

    /**
     * HTML/Markdown content (community tutorials only) — excluded from list for performance
     */
    #[ORM\Column(type: 'text', length: 65535, nullable: true)]
    #[Groups(['tutorial:read', 'tutorial:write'])]
    private ?string $content = null;

    /**
     * URL source for aggregated tutorials (YouTube, DEV.to, etc.)
     */
    #[ORM\Column(nullable: true)]
    #[Assert\Url(requireTld: true)]
    #[Groups(['tutorial:read', 'tutorial:list', 'tutorial:write'])]
    private ?string $externalUrl = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['tutorial:read', 'tutorial:list'])]
    private ?string $thumbnailUrl = null;

    #[ORM\Column(length: 50, enumType: TutorialSource::class)]
    #[Groups(['tutorial:read', 'tutorial:list', 'tutorial:write'])]
    private TutorialSource $source = TutorialSource::Community;

    /**
     * External ID used for deduplication (e.g. YouTube video ID)
     */
    #[ORM\Column(nullable: true, unique: true)]
    #[Groups(['tutorial:read', 'tutorial:list'])]
    private ?string $externalId = null;

    #[ORM\Column(length: 20, nullable: true)]
    #[Groups(['tutorial:read', 'tutorial:list', 'tutorial:write'])]
    private ?string $difficulty = null;

    #[ORM\Column(length: 50, nullable: true)]
    #[Groups(['tutorial:read', 'tutorial:list', 'tutorial:write'])]
    private ?string $duration = null;

    #[ORM\Column(options: ['default' => 0])]
    #[Groups(['tutorial:read', 'tutorial:list'])]
    private int $viewCount = 0;

    #[ORM\Column]
    #[Groups(['tutorial:read', 'tutorial:list'])]
    private bool $published = false;

    #[ORM\Column]
    #[Groups(['tutorial:read', 'tutorial:list'])]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(nullable: true)]
    #[Groups(['tutorial:read', 'tutorial:list'])]
    private ?\DateTimeImmutable $updatedAt = null;

    /** Cached AI TL;DR (list of bullet points). Not exposed in API groups. */
    // jsonb (not json): Postgres can't compare json values, which breaks SELECT DISTINCT on tutorials
    #[ORM\Column(type: 'json', nullable: true, options: ['jsonb' => true])]
    private ?array $aiSummary = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $aiSummaryAt = null;

    #[ORM\ManyToOne(targetEntity: User::class, inversedBy: 'tutorials', fetch: 'EAGER')]
    #[Groups(['tutorial:read', 'tutorial:list'])]
    private ?User $author = null;

    #[ORM\ManyToMany(targetEntity: Category::class, inversedBy: 'tutorials', fetch: 'EAGER')]
    #[Groups(['tutorial:read', 'tutorial:list', 'tutorial:write'])]
    private Collection $categories;

    #[ORM\ManyToMany(targetEntity: Tag::class, inversedBy: 'tutorials', cascade: ['persist'], fetch: 'EAGER')]
    #[Groups(['tutorial:read', 'tutorial:list', 'tutorial:write'])]
    private Collection $tags;

    public function __construct()
    {
        $this->createdAt  = new \DateTimeImmutable();
        $this->categories = new ArrayCollection();
        $this->tags       = new ArrayCollection();
    }

    #[ORM\PrePersist]
    public function ensureSlug(): void
    {
        if (!$this->slug) {
            $base = $this->slugify($this->title ?? 'tutorial');
            $this->slug = $base ?: 'tutorial-' . uniqid();
        }
    }

    private function slugify(string $text): string
    {
        $text = transliterator_transliterate('Any-Latin; Latin-ASCII', $text) ?? $text;
        $text = mb_strtolower($text);
        $text = preg_replace('/[^a-z0-9]+/', '-', $text) ?? '';
        $text = trim($text, '-');
        return $text ?: '';
    }

    public function getId(): ?int { return $this->id; }

    public function getTitle(): ?string { return $this->title; }
    public function setTitle(string $title): static { $this->title = $title; return $this; }

    public function getSlug(): ?string { return $this->slug; }
    public function setSlug(string $slug): static { $this->slug = $slug; return $this; }

    public function getDescription(): ?string { return $this->description; }
    public function setDescription(?string $description): static { $this->description = $description; return $this; }

    public function getContent(): ?string { return $this->content; }
    public function setContent(?string $content): static { $this->content = $content; return $this; }

    public function getExternalUrl(): ?string { return $this->externalUrl; }
    public function setExternalUrl(?string $externalUrl): static { $this->externalUrl = $externalUrl; return $this; }

    public function getThumbnailUrl(): ?string { return $this->thumbnailUrl; }
    public function setThumbnailUrl(?string $thumbnailUrl): static { $this->thumbnailUrl = $thumbnailUrl; return $this; }

    public function getSource(): TutorialSource { return $this->source; }
    public function setSource(TutorialSource $source): static { $this->source = $source; return $this; }

    public function getExternalId(): ?string { return $this->externalId; }
    public function setExternalId(?string $externalId): static { $this->externalId = $externalId; return $this; }

    public function getDifficulty(): ?string { return $this->difficulty; }
    public function setDifficulty(?string $difficulty): static { $this->difficulty = $difficulty; return $this; }

    public function getDuration(): ?string { return $this->duration; }
    public function setDuration(?string $duration): static { $this->duration = $duration; return $this; }

    public function getViewCount(): int { return $this->viewCount; }
    public function incrementViewCount(): static { $this->viewCount++; return $this; }

    public function isPublished(): bool { return $this->published; }
    public function setPublished(bool $published): static { $this->published = $published; return $this; }

    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }

    public function getUpdatedAt(): ?\DateTimeImmutable { return $this->updatedAt; }
    /** @return list<string>|null */
    public function getAiSummary(): ?array { return $this->aiSummary; }
    /** @param list<string>|null $points */
    public function setAiSummary(?array $points): static { $this->aiSummary = $points; $this->aiSummaryAt = $points ? new \DateTimeImmutable() : null; return $this; }
    public function getAiSummaryAt(): ?\DateTimeImmutable { return $this->aiSummaryAt; }

    public function setUpdatedAt(?\DateTimeImmutable $updatedAt): static { $this->updatedAt = $updatedAt; return $this; }

    public function getAuthor(): ?User { return $this->author; }
    public function setAuthor(?User $author): static { $this->author = $author; return $this; }

    public function getCategories(): Collection { return $this->categories; }
    public function addCategory(Category $category): static
    {
        if (!$this->categories->contains($category)) {
            $this->categories->add($category);
        }
        return $this;
    }
    public function removeCategory(Category $category): static
    {
        $this->categories->removeElement($category);
        return $this;
    }

    public function getTags(): Collection { return $this->tags; }
    public function addTag(Tag $tag): static
    {
        if (!$this->tags->contains($tag)) {
            $this->tags->add($tag);
        }
        return $this;
    }
    public function removeTag(Tag $tag): static
    {
        $this->tags->removeElement($tag);
        return $this;
    }
}
