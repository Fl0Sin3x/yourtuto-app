<?php

namespace App\Command;

use App\Entity\Category;
use App\Entity\Tag;
use App\Entity\Tutorial;
use App\Enum\TutorialSource;
use Anthropic\Client;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:generate-tutorials',
    description: 'Génère des tutoriels dev via Claude API et les insère en base',
)]
class GenerateTutorialsCommand extends Command
{
    public function __construct(
        private EntityManagerInterface $em,
        private readonly ManagerRegistry $doctrine,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addOption('count', 'c', InputOption::VALUE_REQUIRED, 'Nombre de tutoriels à générer', 10);
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $count = (int) $input->getOption('count');

        $apiKey = $_ENV['ANTHROPIC_API_KEY'] ?? null;
        if (!$apiKey) {
            $io->error('La variable ANTHROPIC_API_KEY est absente.');
            return Command::FAILURE;
        }

        $client = new Client(apiKey: $apiKey);

        // Catégories disponibles
        $catNames = [
            'Développement web', 'PHP', 'Symfony', 'JavaScript', 'React',
            'Python', 'DevOps', 'Telegram & Bots', 'IA & Claude', 'Git',
            'Base de données', 'Sécurité', 'TypeScript', 'Node.js', 'CSS',
        ];

        // S'assurer que les catégories existent en base, on ne retient que leurs IDs
        $catIds = [];
        foreach ($catNames as $name) {
            $c = $this->em->getRepository(Category::class)->findOneBy(['name' => $name]);
            if (!$c) {
                $c = new Category();
                $c->setName($name)->setSlug($this->slugify($name));
                $this->em->persist($c);
                $this->em->flush();
            }
            $catIds[$name] = $c->getId();
        }

        $io->title("Génération de $count tutoriels via Claude API");
        $io->progressStart($count);

        $generated = 0;
        $attempts  = 0;

        while ($generated < $count && $attempts < $count * 3) {
            $attempts++;

            try {
                $response = $client->messages->create(
                    model: 'claude-haiku-4-5',
                    maxTokens: 800,
                    messages: [['role' => 'user', 'content' => $this->buildPrompt($catNames)]],
                );

                $raw = '';
                foreach ($response->content as $block) {
                    if ($block->type === 'text') {
                        $raw = $block->text;
                        break;
                    }
                }
                $data = $this->parseJson($raw);

                if (!$data || empty($data['title'])) {
                    continue;
                }

                // Vérifier doublon par titre
                $exists = $this->em->getRepository(Tutorial::class)->findOneBy(['title' => $data['title']]);
                if ($exists) {
                    continue;
                }

                $tutorial = new Tutorial();
                $tutorial->setTitle(mb_substr($data['title'], 0, 255))
                         ->setSlug($this->uniqueSlug($data['title']))
                         ->setDescription(mb_substr($data['description'] ?? '', 0, 500))
                         ->setContent($data['content'] ?? '')
                         ->setDifficulty($data['difficulty'] ?? 'intermédiaire')
                         ->setDuration($data['duration'] ?? '30 min')
                         ->setSource(TutorialSource::Community)
                         ->setPublished(true);

                // Catégories — recharger depuis l'EM courant via l'ID
                foreach ((array) ($data['categories'] ?? []) as $catName) {
                    if (isset($catIds[$catName])) {
                        $cat = $this->em->getRepository(Category::class)->find($catIds[$catName]);
                        if ($cat) {
                            $tutorial->addCategory($cat);
                        }
                    }
                }

                // Tags — chercher par name ET par slug pour éviter les doublons PostgreSQL
                foreach ((array) ($data['tags'] ?? []) as $tagName) {
                    $tagName = mb_strtolower(trim($tagName));
                    if (!$tagName) {
                        continue;
                    }
                    $slug = $this->slugify($tagName);
                    $tag  = $this->em->getRepository(Tag::class)->findOneBy(['name' => $tagName])
                         ?? $this->em->getRepository(Tag::class)->findOneBy(['slug' => $slug]);
                    if (!$tag) {
                        try {
                            $tag = new Tag();
                            $tag->setName($tagName)->setSlug($slug);
                            $this->em->persist($tag);
                            $this->em->flush(); // flush immédiat pour détecter le doublon maintenant
                        } catch (\Throwable) {
                            if (!$this->em->isOpen()) {
                                $this->em = $this->doctrine->resetManager();
                            }
                            // Re-fetch après conflict
                            $tag = $this->em->getRepository(Tag::class)->findOneBy(['slug' => $slug]);
                            if (!$tag) {
                                continue;
                            }
                        }
                    }
                    $tutorial->addTag($tag);
                }

                $this->em->persist($tutorial);
                $this->em->flush();

                $generated++;
                $io->progressAdvance();

            } catch (\Throwable $e) {
                $io->note('Erreur : ' . $e->getMessage());
                // Réouvrir l'EM s'il a été fermé après une exception Doctrine
                if (!$this->em->isOpen()) {
                    $this->em = $this->doctrine->resetManager();
                }
            }
        }

        $io->progressFinish();
        $io->success("$generated tutoriels insérés en base ($attempts tentatives).");

        return Command::SUCCESS;
    }

    private function buildPrompt(array $catNames): string
    {
        $cats = implode(', ', $catNames);

        $topics = [
            'PHP 8 readonly properties', 'Symfony HttpClient', 'React Server Components',
            'Python decorateurs', 'Docker multi-stage builds', 'PostgreSQL full-text search',
            'JWT refresh tokens', 'TypeScript discriminated unions', 'Node.js streams',
            'CSS container queries', 'GraphQL subscriptions', 'Redis pub/sub en PHP',
            'Symfony Scheduler', 'FastAPI background tasks', 'GitHub Actions matrix',
            'Tailwind CSS responsive design', 'Vue 3 Composition API', 'Laravel Octane',
            'Python type hints avancés', 'Nginx load balancing', 'AWS CloudFront CDN',
            'Claude API system prompt', 'Bot Telegram payments', 'Deno KV database',
            'Astro islands architecture', 'Bun test runner', 'tRPC avec Next.js',
            'Prisma transactions', 'Zod schema composition', 'SvelteKit routing',
            'Nuxt 3 auto-imports', 'Hono middleware', 'Cloudflare D1 database',
            'Symfony Notifier', 'PHPStan niveau max', 'Rector migration PHP',
            'OpenTelemetry traces Python', 'Kubernetes Helm charts', 'Terraform modules',
            'Stripe subscriptions PHP', 'Elasticsearch aggregations', 'RabbitMQ avec PHP',
            'Apache Kafka introduction', 'WebRTC peer-to-peer', 'Web Crypto API',
        ];

        $topic = $topics[array_rand($topics)];

        return <<<PROMPT
Génère un tutoriel de développement en français sur : "$topic".

Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans explication :
{
  "title": "titre accrocheur (max 80 chars)",
  "description": "description courte (max 200 chars)",
  "content": "contenu markdown du tutoriel (300-600 chars, avec du code)",
  "categories": ["max 2 catégories parmi : $cats"],
  "tags": ["3 à 5 tags lowercase sans espace"],
  "difficulty": "débutant|intermédiaire|avancé",
  "duration": "X min"
}
PROMPT;
    }

    private function parseJson(string $raw): ?array
    {
        // Extraire le JSON même si Claude ajoute du texte autour
        if (preg_match('/\{.*\}/s', $raw, $m)) {
            $data = json_decode($m[0], true);
            return is_array($data) ? $data : null;
        }
        return null;
    }

    private function uniqueSlug(string $title): string
    {
        $base = $this->slugify($title);
        $slug = $base . '-' . substr(uniqid(), -6);

        // S'assurer de l'unicité
        while ($this->em->getRepository(Tutorial::class)->findOneBy(['slug' => $slug])) {
            $slug = $base . '-' . substr(uniqid(), -6);
        }

        return $slug;
    }

    private function slugify(string $text): string
    {
        $text = mb_strtolower($text);
        $map  = ['é'=>'e','è'=>'e','ê'=>'e','ë'=>'e','à'=>'a','â'=>'a','î'=>'i','ï'=>'i','ô'=>'o','ù'=>'u','û'=>'u','ü'=>'u','ç'=>'c','ñ'=>'n'];
        $text = strtr($text, $map);
        $text = preg_replace('/[^a-z0-9]+/', '-', $text);
        return trim($text, '-');
    }
}
