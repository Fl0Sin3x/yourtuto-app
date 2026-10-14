<?php

namespace App\Command;

use App\Entity\Category;
use App\Entity\Tag;
use App\Entity\Tutorial;
use App\Enum\TutorialSource;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\String\Slugger\AsciiSlugger;

#[AsCommand(name: 'app:seed-recipes', description: 'Seed ~270 curated recipes from JSON data files')]
class SeedRecipesCommand extends Command
{
    public function __construct(private EntityManagerInterface $em)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $category = $this->em->getRepository(Category::class)->findOneBy(['slug' => 'cuisine']);
        if (!$category) {
            $category = (new Category())->setName('Cuisine')->setSlug('cuisine');
            $this->em->persist($category);
            $this->em->flush();
        }

        $slugger  = new AsciiSlugger('fr');
        $tagCache = [];

        $getTag = function (string $name) use (&$tagCache, $slugger): Tag {
            if (isset($tagCache[$name])) {
                return $tagCache[$name];
            }
            $tag = $this->em->getRepository(Tag::class)->findOneBy(['name' => $name]);
            if (!$tag) {
                $tag = (new Tag())
                    ->setName($name)
                    ->setSlug($slugger->slug($name)->lower()->toString());
                $this->em->persist($tag);
            }
            $tagCache[$name] = $tag;
            return $tag;
        };

        $dataDir = __DIR__ . '/recipes/';
        $files   = glob($dataDir . '*.json') ?: [];
        sort($files);

        $count = 0;
        foreach ($files as $file) {
            $recipes = json_decode(file_get_contents($file), true) ?? [];
            foreach ($recipes as $r) {
                $existing = $this->em->getRepository(Tutorial::class)->findOneBy(['title' => $r['title']]);
                if ($existing) {
                    continue;
                }

                $content = "**Temps :** {$r['time']} | **Pour :** {$r['servings']} pers.\n\n";
                $content .= "## Ingrédients\n\n";
                foreach ($r['ingredients'] as $ing) {
                    $content .= "- $ing\n";
                }
                $content .= "\n## Préparation\n\n";
                foreach ($r['steps'] as $i => $step) {
                    $content .= ($i + 1) . ". $step\n";
                }

                $tutorial = (new Tutorial())
                    ->setTitle($r['title'])
                    ->setDescription($r['desc'] . ' Prêt en ' . $r['time'] . '. Pour ' . $r['servings'] . ' pers.')
                    ->setContent($content)
                    ->setSource(TutorialSource::Recipe)
                    ->setPublished(true)
                    ->addCategory($category);

                foreach ($r['tags'] as $tag) {
                    $tutorial->addTag($getTag($tag));
                }

                $this->em->persist($tutorial);
                $count++;

                if ($count % 30 === 0) {
                    $this->em->flush();
                    $io->writeln("  $count recettes insérées...");
                }
            }
        }

        $this->em->flush();
        $io->success("$count recettes insérées avec succès !");

        return Command::SUCCESS;
    }
}
