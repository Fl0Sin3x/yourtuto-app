<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use App\Repository\UserRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Validator\Constraints\UniqueEntity;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\UserInterface;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: UserRepository::class)]
#[ORM\Table(name: '`user`')]
#[UniqueEntity(fields: ['email'], message: 'This email is already in use.')]
#[ApiResource(
    operations: [
        new Get(normalizationContext: ['groups' => ['user:read']]),
        new GetCollection(
            normalizationContext: ['groups' => ['user:read']],
            security: "is_granted('ROLE_ADMIN')"
        ),
        new Patch(
            normalizationContext: ['groups' => ['user:read']],
            denormalizationContext: ['groups' => ['user:write']],
            security: "is_granted('ROLE_USER') and object == user"
        ),
    ]
)]
class User implements UserInterface, PasswordAuthenticatedUserInterface
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['user:read', 'tutorial:read', 'tutorial:list', 'comment:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 180, unique: true)]
    #[Assert\NotBlank]
    #[Assert\Email]
    #[Assert\Length(max: 180)]
    #[Groups(['user:write'])]  // email never exposed in read
    private ?string $email = null;

    #[ORM\Column(length: 100)]
    #[Assert\NotBlank]
    #[Assert\Length(min: 2, max: 100)]
    #[Assert\Regex(pattern: '/^[\pL\pN\s._-]+$/u', message: 'Username contains invalid characters.')]
    #[Groups(['user:read', 'user:write', 'tutorial:read', 'tutorial:list', 'comment:read'])]
    private ?string $username = null;

    #[ORM\Column]
    private array $roles = [];

    #[ORM\Column(nullable: true)]
    private ?string $password = null;

    #[ORM\Column(nullable: true)]
    private ?string $googleId = null;

    #[ORM\Column(nullable: true)]
    private ?string $githubId = null;

    #[Assert\NotBlank(groups: ['registration'])]
    #[Assert\Length(min: 8, max: 255)]
    #[Assert\Regex(
        pattern: '/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/',
        message: 'Password must contain at least one uppercase letter, one lowercase letter, and one digit.',
        groups: ['registration']
    )]
    #[Groups(['user:write'])]
    private ?string $plainPassword = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['user:read', 'user:write', 'tutorial:list', 'comment:read'])]
    private ?string $avatar = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['user:read', 'tutorial:list', 'comment:read'])]
    private ?string $profilePicture = null;

    #[ORM\Column(type: 'text', nullable: true)]
    #[Assert\Length(max: 1000)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $bio = null;

    #[ORM\Column]
    #[Groups(['user:read'])]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(length: 100, nullable: true)]
    private ?string $resetPasswordToken = null;

    #[ORM\Column(nullable: true)]
    private ?\DateTimeImmutable $resetPasswordTokenExpiresAt = null;

    #[ORM\OneToMany(mappedBy: 'author', targetEntity: Tutorial::class, orphanRemoval: true)]
    private Collection $tutorials;

    public function __construct()
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->tutorials = new ArrayCollection();
    }

    public function getId(): ?int { return $this->id; }

    public function getEmail(): ?string { return $this->email; }
    public function setEmail(string $email): static { $this->email = $email; return $this; }

    public function getUsername(): ?string { return $this->username; }
    public function setUsername(string $username): static { $this->username = $username; return $this; }

    public function getUserIdentifier(): string { return (string) $this->email; }

    public function getRoles(): array
    {
        $roles = $this->roles;
        $roles[] = 'ROLE_USER';
        return array_unique($roles);
    }
    public function setRoles(array $roles): static { $this->roles = $roles; return $this; }

    public function getPassword(): ?string { return $this->password; }
    public function setPassword(?string $password): static { $this->password = $password; return $this; }

    public function getGoogleId(): ?string { return $this->googleId; }
    public function setGoogleId(?string $googleId): static { $this->googleId = $googleId; return $this; }

    public function getGithubId(): ?string { return $this->githubId; }
    public function setGithubId(?string $githubId): static { $this->githubId = $githubId; return $this; }

    public function getPlainPassword(): ?string { return $this->plainPassword; }
    public function setPlainPassword(?string $plainPassword): static { $this->plainPassword = $plainPassword; return $this; }

    public function getAvatar(): ?string { return $this->avatar; }
    public function setAvatar(?string $avatar): static { $this->avatar = $avatar; return $this; }

    public function getProfilePicture(): ?string { return $this->profilePicture; }
    public function setProfilePicture(?string $profilePicture): static { $this->profilePicture = $profilePicture; return $this; }

    public function getBio(): ?string { return $this->bio; }
    public function setBio(?string $bio): static { $this->bio = $bio; return $this; }

    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }

    public function getResetPasswordToken(): ?string { return $this->resetPasswordToken; }
    public function setResetPasswordToken(?string $token): static { $this->resetPasswordToken = $token; return $this; }

    public function getResetPasswordTokenExpiresAt(): ?\DateTimeImmutable { return $this->resetPasswordTokenExpiresAt; }
    public function setResetPasswordTokenExpiresAt(?\DateTimeImmutable $expiresAt): static { $this->resetPasswordTokenExpiresAt = $expiresAt; return $this; }

    public function getTutorials(): Collection { return $this->tutorials; }

    public function eraseCredentials(): void { $this->plainPassword = null; }
}
