<?php

namespace App\Command;

use App\Entity\LearningPath;
use App\Enum\TutorialSource;
use App\Repository\LearningPathRepository;
use App\Repository\TutorialRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Builds curated learning paths from the dev tutorial batches (idempotent: updates existing paths).
 * Steps are ordered beginner -> intermediate -> advanced.
 */
#[AsCommand(name: 'app:seed-paths', description: 'Create or update the curated learning paths')]
final class SeedLearningPathsCommand extends Command
{
    public const PATHS = [
        'batch1-ia-llm'       => ['ia-llm-agents', 'Construire avec l\'IA et les LLM', 'Des premières requêtes à l\'API jusqu\'aux agents autonomes.', '🤖'],
        'batch2-web-frontend' => ['developpeur-frontend', 'Développeur frontend moderne', 'HTML, CSS, JavaScript, React et les outils du web moderne.', '🎨'],
        'batch3-backend-api'  => ['backend-api', 'Backend & APIs', 'Concevoir, sécuriser et déployer des APIs robustes.', '⚙️'],
        'batch4-outils-git'   => ['outils-git-devops', 'Outils du développeur & Git', 'Git, terminal, Docker et automatisation au quotidien.', '🧰'],
    ];

    private const LEVEL_ORDER = ['Débutant' => 0, 'Intermédiaire' => 1, 'Avancé' => 2];

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly LearningPathRepository $paths,
        private readonly TutorialRepository $tutorials,
        private readonly string $dataDir = __DIR__ . '/dev-tutorials/',
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        foreach (self::PATHS as $file => [$slug, $title, $description, $icon]) {
            $items = json_decode((string) @file_get_contents($this->dataDir . $file . '.json'), true) ?: [];
            usort($items, fn ($a, $b) => (self::LEVEL_ORDER[$a['level'] ?? ''] ?? 1) <=> (self::LEVEL_ORDER[$b['level'] ?? ''] ?? 1));

            $ids = [];
            foreach ($items as $item) {
                $t = $this->tutorials->findOneBy(['title' => $item['title'], 'source' => TutorialSource::Dev]);
                if ($t) {
                    $ids[] = (int) $t->getId();
                }
            }
            if (!$ids) {
                $io->warning(sprintf('%s: no matching tutorials (run app:seed-dev-tutorials first)', $slug));
                continue;
            }

            $path = $this->paths->findOneBy(['slug' => $slug]) ?? new LearningPath($slug, $title);
            $path->setTitle($title)->setDescription($description)->setIcon($icon)->setTutorialIds($ids)
                ->setLevel(count($ids) > 8 ? 'complet' : 'essentiel');
            $this->em->persist($path);
            $io->writeln(sprintf('  %s %s (%d étapes)', $icon, $title, count($ids)));
        }

        $this->em->flush();
        $io->success('Learning paths up to date.');

        return Command::SUCCESS;
    }
}
