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

#[AsCommand(name: 'app:seed-dev-tutorials', description: 'Seed ~150 curated dev/AI/agent tutorials')]
class SeedDevTutorialsCommand extends Command
{
    public function __construct(private EntityManagerInterface $em)
    {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $slugger   = new AsciiSlugger('fr');
        $catCache  = [];
        $tagCache  = [];

        $getCategory = function (string $name) use (&$catCache, $slugger): Category {
            if (isset($catCache[$name])) return $catCache[$name];
            $slug = $slugger->slug($name)->lower()->toString();
            $cat  = $this->em->getRepository(Category::class)->findOneBy(['name' => $name])
                 ?? $this->em->getRepository(Category::class)->findOneBy(['slug' => $slug]);
            if (!$cat) {
                $cat = (new Category())->setName($name)->setSlug($slug);
                $this->em->persist($cat);
                $this->em->flush();
            }
            $catCache[$name] = $cat;
            return $cat;
        };

        $getTag = function (string $name) use (&$tagCache, $slugger): Tag {
            if (isset($tagCache[$name])) return $tagCache[$name];
            $slug = $slugger->slug($name)->lower()->toString();
            $tag  = $this->em->getRepository(Tag::class)->findOneBy(['name' => $name])
                 ?? $this->em->getRepository(Tag::class)->findOneBy(['slug' => $slug]);
            if (!$tag) {
                $tag = (new Tag())->setName($name)->setSlug($slug);
                $this->em->persist($tag);
            }
            $tagCache[$name] = $tag;
            return $tag;
        };

        $dataDir = __DIR__ . '/dev-tutorials/';
        $files   = glob($dataDir . '*.json') ?: [];
        sort($files);

        $count = 0;
        foreach ($files as $file) {
            $tutorials = json_decode(file_get_contents($file), true) ?? [];
            foreach ($tutorials as $t) {
                $existing = $this->em->getRepository(Tutorial::class)->findOneBy(['title' => $t['title']]);
                if ($existing) continue;

                $content  = "**Niveau :** {$t['level']} | **Durée estimée :** {$t['time']}\n\n";
                $content .= $t['content'];

                $tutorial = (new Tutorial())
                    ->setTitle($t['title'])
                    ->setDescription($t['desc'])
                    ->setContent($content)
                    ->setSource(TutorialSource::Dev)
                    ->setPublished(true)
                    ->addCategory($getCategory($t['category']));

                foreach ($t['tags'] as $tag) {
                    $tutorial->addTag($getTag($tag));
                }

                $this->em->persist($tutorial);
                $count++;

                if ($count % 30 === 0) {
                    $this->em->flush();
                    $io->writeln("  $count tutoriels insérés...");
                }
            }
        }

        $this->em->flush();
        $io->success("$count tutoriels dev/IA insérés avec succès !");

        return Command::SUCCESS;
    }
}
