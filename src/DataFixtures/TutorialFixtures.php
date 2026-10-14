<?php

namespace App\DataFixtures;

use App\Entity\Category;
use App\Entity\Tag;
use App\Entity\Tutorial;
use App\Enum\TutorialSource;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;

class TutorialFixtures extends Fixture
{
    public function load(ObjectManager $manager): void
    {
        $cats = [];
        foreach (['Développement web', 'Automobile', 'Design', 'DevOps'] as $name) {
            $c = new Category();
            $c->setName($name)->setSlug($this->slugify($name));
            $manager->persist($c);
            $cats[$name] = $c;
        }

        $tags = [];
        foreach (['symfony', 'react', 'php', 'javascript', 'mini-cooper', 'mécanique', 'css', 'docker'] as $name) {
            $t = new Tag();
            $t->setName($name)->setSlug($name);
            $manager->persist($t);
            $tags[$name] = $t;
        }

        // Uniquement des tutos communauté avec du vrai contenu
        $fixtures = [
            [
                'title'      => 'Débuter avec Symfony 7 et API Platform',
                'description'=> 'Guide complet pour créer une API REST avec Symfony 7 et API Platform 3.',
                'content'    => "# Symfony 7 + API Platform\n\n## Prérequis\n- PHP 8.2+\n- Composer\n\n## Installation\n\n```bash\ncomposer create-project symfony/skeleton mon-projet\ncomposer require api-platform/symfony\n```\n\n## Créer une ressource API\n\nAnnote ton entité avec `#[ApiResource]` et API Platform génère automatiquement les endpoints CRUD.",
                'categories' => ['Développement web'],
                'tags'       => ['symfony', 'php'],
            ],
            [
                'title'      => 'Remplacer la calandre d\'une Mini Cooper R56',
                'description'=> 'Tutoriel pas à pas pour changer la calandre avant d\'une Mini Cooper R56 soi-même.',
                'content'    => "# Remplacement calandre Mini Cooper R56\n\n## Outils nécessaires\n- Tournevis Torx T20\n- Clips de remplacement\n\n## Étapes\n\n1. Retirer les clips de fixation supérieurs\n2. Dégager la calandre par le bas\n3. Déconnecter les éventuels capteurs\n4. Clipser la nouvelle calandre de bas en haut\n\n⚠️ Ne pas forcer, les clips se cassent facilement.",
                'categories' => ['Automobile'],
                'tags'       => ['mini-cooper', 'mécanique'],
            ],
            [
                'title'      => 'Docker Compose pour une stack PHP/MySQL',
                'description'=> 'Mettez en place un environnement de développement complet avec Docker Compose.',
                'content'    => "# Docker Compose PHP + MySQL\n\n```yaml\nservices:\n  app:\n    image: php:8.3-fpm\n    volumes:\n      - .:/var/www\n  db:\n    image: mysql:8.0\n    environment:\n      MYSQL_ROOT_PASSWORD: root\n      MYSQL_DATABASE: myapp\n```\n\nLancez avec `docker compose up -d`.",
                'categories' => ['DevOps'],
                'tags'       => ['php', 'docker'],
            ],
        ];

        foreach ($fixtures as $data) {
            $t = new Tutorial();
            $t->setTitle($data['title'])
              ->setSlug($this->slugify($data['title']) . '-' . substr(uniqid(), -6))
              ->setDescription($data['description'])
              ->setContent($data['content'])
              ->setSource(TutorialSource::Community)
              ->setPublished(true);

            foreach ($data['categories'] as $catName) {
                $t->addCategory($cats[$catName]);
            }
            foreach ($data['tags'] as $tagName) {
                $t->addTag($tags[$tagName]);
            }

            $manager->persist($t);
        }

        $manager->flush();
    }

    private function slugify(string $text): string
    {
        $text = mb_strtolower($text);
        $text = preg_replace('/[^a-z0-9]+/', '-', $text);
        return trim($text, '-');
    }
}
