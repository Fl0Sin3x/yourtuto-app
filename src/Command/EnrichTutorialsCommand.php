<?php

namespace App\Command;

use App\Entity\Tutorial;
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
    name: 'app:enrich-tutorials',
    description: 'Enrichit le contenu des tutoriels courts via Claude API',
)]
class EnrichTutorialsCommand extends Command
{
    public function __construct(
        private EntityManagerInterface $em,
        private readonly ManagerRegistry $doctrine,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addOption('min-length', null, InputOption::VALUE_REQUIRED, 'Longueur minimale du contenu actuel pour ne pas enrichir', 3000);
        $this->addOption('batch', null, InputOption::VALUE_REQUIRED, 'Flush tous les N tutoriels', 5);
        $this->addOption('source', null, InputOption::VALUE_REQUIRED, 'Filtrer par source (ex: generated,community)', 'generated,community');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $minLength = (int) $input->getOption('min-length');
        $batch     = (int) $input->getOption('batch');
        $sources   = array_filter(array_map('trim', explode(',', $input->getOption('source') ?? '')));

        $apiKey = $_ENV['ANTHROPIC_API_KEY'] ?? null;
        if (!$apiKey) {
            $io->error('ANTHROPIC_API_KEY manquante.');
            return Command::FAILURE;
        }

        $client = new Client(apiKey: $apiKey);

        $qb = $this->em->createQueryBuilder()
            ->select('t')
            ->from(Tutorial::class, 't')
            ->where('t.published = true')
            ->andWhere('t.content IS NULL OR LENGTH(t.content) < :minLen')
            ->setParameter('minLen', $minLength)
            ->orderBy('t.id', 'ASC');

        if (!empty($sources)) {
            $qb->andWhere('t.source IN (:sources)')->setParameter('sources', $sources);
        }

        $tutorials = $qb->getQuery()->getResult();

        $total = count($tutorials);
        $io->title("$total tutoriels à enrichir (contenu < {$minLength} chars)");

        if ($total === 0) {
            $io->success('Rien à enrichir.');
            return Command::SUCCESS;
        }

        $io->progressStart($total);
        $done = 0;
        $errors = 0;

        foreach ($tutorials as $tutorial) {
            try {
                $enriched = $this->enrichViaClaud($client, $tutorial);

                if ($enriched) {
                    $tutorial->setContent($enriched);
                    $done++;
                }
            } catch (\Throwable $e) {
                $errors++;
                $io->note("Erreur #{$tutorial->getId()} : " . substr($e->getMessage(), 0, 100));
                if (!$this->em->isOpen()) {
                    $this->em = $this->doctrine->resetManager();
                }
            }

            $io->progressAdvance();

            if ($done % $batch === 0) {
                try {
                    $this->em->flush();
                } catch (\Throwable $e) {
                    $errors++;
                    if (!$this->em->isOpen()) {
                        $this->em = $this->doctrine->resetManager();
                    }
                }
            }
        }

        // Flush final
        try {
            $this->em->flush();
        } catch (\Throwable) {}

        $io->progressFinish();
        $io->success("Enrichissement terminé : {$done} tutoriels mis à jour, {$errors} erreurs.");

        return Command::SUCCESS;
    }

    private function enrichViaClaud(Client $client, Tutorial $tutorial): ?string
    {
        $title       = $tutorial->getTitle();
        $description = $tutorial->getDescription() ?? '';
        $current     = $tutorial->getContent() ?? '';
        $tags        = implode(', ', $tutorial->getTags()->map(fn($t) => $t->getName())->toArray());
        $difficulty  = $tutorial->getDifficulty() ?? 'intermédiaire';

        $prompt = <<<PROMPT
Tu es un expert technique qui rédige des tutoriels de développement détaillés en français.

Voici un tutoriel à enrichir :
- Titre : {$title}
- Description : {$description}
- Tags : {$tags}
- Niveau : {$difficulty}
- Contenu actuel :
{$current}

Ta mission : réécrire et enrichir considérablement ce tutoriel en Markdown.
Le contenu final doit faire entre 1500 et 3000 mots et inclure :

1. Une introduction qui explique le contexte et pourquoi c'est utile
2. Les prérequis (outils, versions, connaissances)
3. Toutes les étapes détaillées avec explications
4. Des blocs de code complets et commentés
5. Des tableaux comparatifs si pertinent
6. Les erreurs courantes et comment les éviter
7. Des conseils avancés / bonnes pratiques
8. Une conclusion avec les prochaines étapes suggérées

Réponds UNIQUEMENT avec le contenu Markdown, sans introduction ni commentaire.
PROMPT;

        $response = $client->messages->create(
            model: 'claude-haiku-4-5',
            maxTokens: 3000,
            messages: [['role' => 'user', 'content' => $prompt]],
        );

        $text = '';
        foreach ($response->content as $block) {
            if ($block->type === 'text') {
                $text = trim($block->text);
                break;
            }
        }

        return $text ?: null;
    }
}
