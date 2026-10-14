<?php

namespace App\Service\Aggregator;

use Anthropic\Client;
use App\Entity\Tutorial;
use App\Enum\TutorialSource;
use App\Repository\CategoryRepository;
use App\Repository\TagRepository;
use App\Repository\TutorialRepository;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\Persistence\ManagerRegistry;

/**
 * Generates unique French DIY tutorials using the Claude API.
 *
 * Usage:
 *   php bin/console app:aggregate claude --max=20
 *   php bin/console app:aggregate claude --max=5 --difficulty=débutant
 *   php bin/console app:aggregate claude --topic="Poser un carrelage"
 */
class ClaudeGeneratorAggregator implements AggregatorInterface
{
    /**
     * Default list of French DIY topics to generate tutorials for.
     * Topics are shuffled so repeated runs pick different ones.
     */
    private const TOPICS = [
        // Plomberie
        'Changer un joint de robinet', 'Déboucher un évier sans produit chimique',
        'Installer un mitigeur de douche', 'Réparer une chasse d\'eau qui coule',
        'Remplacer un siphon de lavabo', 'Installer un robinet de cuisine',
        'Changer un flexible de douche', 'Réparer une fuite sous l\'évier',
        // Électricité
        'Installer une prise électrique', 'Changer un interrupteur simple',
        'Poser un détecteur de fumée', 'Installer un dimmer',
        'Remplacer un fusible', 'Poser des goulottes électriques',
        'Installer une applique murale', 'Changer un tableau électrique',
        // Menuiserie
        'Poser une étagère sans perceuse', 'Installer une tringle à rideau',
        'Monter une bibliothèque IKEA', 'Réparer une chaise bancale',
        'Vernir un meuble en bois', 'Peindre un meuble en bois',
        'Installer des charnières de porte', 'Réparer un tiroir cassé',
        'Poser un parquet flottant', 'Installer une porte intérieure',
        'Fabriquer une étagère murale', 'Coller du carrelage mural',
        // Murs & peinture
        'Peindre un mur : technique parfaite', 'Poser du papier peint',
        'Reboucher un trou dans le plâtre', 'Lisser un mur abîmé',
        'Enlever du papier peint facilement', 'Peindre un plafond',
        'Appliquer un enduit de lissage', 'Poser de la faïence',
        // Isolation & étanchéité
        'Isoler une fenêtre qui siffle', 'Poser des joints de fenêtre',
        'Calfeutrer une porte d\'entrée', 'Poser de la laine de verre',
        'Isoler un plancher contre le froid', 'Imperméabiliser une terrasse',
        // Jardin
        'Construire un bac de compost', 'Installer un système d\'arrosage automatique',
        'Fabriquer un hôtel à insectes', 'Construire une serre mini',
        'Poser une clôture de jardin', 'Monter un abri de jardin',
        'Créer un potager surélevé', 'Installer un récupérateur d\'eau de pluie',
        // Carrelage & sols
        'Coller du carrelage de sol', 'Jointoyer un carrelage',
        'Poncer un parquet', 'Poser du lino',
        'Rénover des joints de salle de bain', 'Poser une plinthe',
        // Extérieur
        'Réparer une gouttière', 'Poser un portail coulissant',
        'Monter un garde-corps de terrasse', 'Imperméabiliser un mur extérieur',
        'Rénover une façade', 'Construire une pergola en bois',
        // Divers
        'Installer un store banne', 'Poser un miroir lourd au mur',
        'Monter une cloison en placo', 'Installer une VMC',
        'Réparer un volet roulant', 'Remplacer une serrure de porte',
        'Installer une porte de douche', 'Construire une mezzanine',
        'Rénover une cuisine', 'Installer un plan de travail',
        // Plomberie avancée
        'Installer un chauffe-eau électrique', 'Poser un lave-mains',
        'Installer un adoucisseur d\'eau', 'Remplacer une baignoire par une douche',
        'Poser un receveur de douche', 'Installer une baignoire îlot',
        'Réparer une canalisation qui fuit', 'Déboucher une canalisation bouchée',
        'Installer un filtre à eau sous évier', 'Poser un robinet thermostatique',
        'Remplacer un ballon d\'eau chaude', 'Installer un cumulus',
        'Poser un lave-vaisselle', 'Raccorder une machine à laver',
        // Électricité avancée
        'Installer un tableau électrique neuf', 'Poser des spots encastrés',
        'Installer une prise USB murale', 'Câbler une prise de courant',
        'Installer un disjoncteur différentiel', 'Poser des prises en saillie',
        'Installer un interrupteur va-et-vient', 'Poser un détecteur de mouvement',
        'Installer une sonnette sans fil', 'Câbler un interrupteur double',
        'Poser un minuteur d\'escalier', 'Installer un variateur de lumière',
        'Mettre à la terre une installation électrique', 'Installer une borne de recharge voiture',
        'Poser des LED sous meuble', 'Installer un éclairage extérieur',
        // Chauffage & climatisation
        'Installer un radiateur à inertie', 'Poser un thermostat connecté',
        'Purger un radiateur', 'Remplacer une vanne de radiateur',
        'Installer un poêle à granulés', 'Installer une climatisation réversible',
        'Poser un ventilateur de plafond', 'Nettoyer une chaudière gaz',
        'Installer un plancher chauffant électrique', 'Entretenir une pompe à chaleur',
        'Régler un thermostat de chaudière', 'Installer un convecteur électrique',
        'Poser un poêle à bois', 'Installer un insert de cheminée',
        // Menuiserie avancée
        'Fabriquer une table en bois massif', 'Construire un établi de garage',
        'Fabriquer un banc de jardin', 'Construire une cabane pour enfants',
        'Réaliser un escalier en bois', 'Poser un escalier en colimaçon',
        'Fabriquer des volets battants', 'Poser une baie vitrée coulissante',
        'Installer une véranda', 'Construire un carport en bois',
        'Fabriquer un meuble sous escalier', 'Construire un lit en bois',
        'Fabriquer un bureau sur mesure', 'Réaliser une cuisine en bois',
        'Construire un bac à sable', 'Fabriquer un composteur en palettes',
        'Construire une terrasse en bois composite', 'Installer une pergola bioclimatique',
        'Fabriquer une étagère en caisses de bois', 'Construire un poulailler',
        // Peinture & décoration
        'Peindre un radiateur', 'Peindre des carrelages sans les remplacer',
        'Réaliser un effet béton ciré sur un mur', 'Poser du stuc décoratif',
        'Créer un mur en briques de parement', 'Poser du lambris PVC',
        'Installer des moulures décoratives', 'Peindre un escalier en bois',
        'Réaliser une peinture géométrique murale', 'Poser un sol en résine époxy',
        'Créer un effet ardoise sur un mur', 'Appliquer une peinture à la chaux',
        'Poser du papier peint panoramique', 'Réaliser un trompe-l\'œil',
        'Peindre un meuble de cuisine', 'Customiser des meubles IKEA',
        // Sol & revêtements
        'Poser du carrelage hexagonal', 'Poser du carrelage grand format',
        'Installer un parquet massif', 'Rénover un parquet ancien',
        'Poser du vinyle en lame', 'Installer un sol en béton ciré',
        'Poser de la moquette', 'Rénover un escalier en béton',
        'Poser des plinthes en carrelage', 'Installer un sol stratifié',
        'Poser du carrelage en chevron', 'Remettre à neuf un parquet abîmé',
        // Isolation & étanchéité avancée
        'Isoler un toit en pente de l\'intérieur', 'Isoler des combles perdus',
        'Poser un pare-vapeur', 'Isoler thermiquement une cave',
        'Isoler phoniquement une pièce', 'Étanchéifier une terrasse carrelée',
        'Traiter l\'humidité dans un sous-sol', 'Poser un drainage périphérique',
        'Réaliser un enduit hydrofuge', 'Colmater des fissures dans un mur',
        'Isoler une porte de garage', 'Poser un joint de dilatation',
        // Jardin avancé
        'Construire une rocaille', 'Aménager une mare de jardin',
        'Installer un arrosage goutte à goutte', 'Construire un mur de soutènement',
        'Poser des dalles de jardin', 'Construire un escalier extérieur en bois',
        'Installer un portail automatique', 'Monter une serre tunnel',
        'Créer une allée gravillonnée', 'Construire un muret en pierre sèche',
        'Installer un éclairage solaire de jardin', 'Construire un nichoir à oiseaux',
        'Aménager un coin barbecue en dur', 'Construire un four à pizza extérieur',
        'Installer une pompe de bassin', 'Créer un potager vertical',
        // Garage & atelier
        'Organiser un garage avec des rangements muraux', 'Construire une workbench DIY',
        'Installer des grilles de rangement pour outils', 'Peindre un sol de garage',
        'Monter une porte de garage sectionnelle', 'Installer un éclairage LED dans un garage',
        'Fabriquer un établi pliable', 'Créer un atelier dans un sous-sol',
        'Installer une prise de courant dans un garage', 'Poser une dalle béton dans un garage',
        // Salle de bain
        'Rénover entièrement une salle de bain', 'Poser un meuble vasque suspendu',
        'Installer une douche à l\'italienne', 'Poser une baignoire encastrée',
        'Installer un miroir avec éclairage LED', 'Poser un radiateur sèche-serviettes',
        'Remplacer un bac de douche fissuré', 'Carreler une douche à l\'italienne',
        'Installer un WC suspendu', 'Poser une cabine de douche',
        'Rénover des joints de douche', 'Installer un pare-douche',
        // Cuisine
        'Rénover une cuisine sans tout casser', 'Changer les façades de cuisine',
        'Poser un crédence de cuisine', 'Installer un évier de cuisine',
        'Poser un robinet extractible', 'Installer une hotte aspirante',
        'Poser un plan de travail en béton', 'Fabriquer un îlot de cuisine',
        'Installer des tiroirs dans des meubles de cuisine', 'Poser une crédence en carrelage métro',
        // Toiture & façade
        'Réparer une toiture en tuiles', 'Changer des ardoises abîmées',
        'Poser des fenêtres de toit Velux', 'Nettoyer et traiter une toiture',
        'Réparer une gouttière en zinc', 'Poser des gouttières en PVC',
        'Ravaler une façade en crépi', 'Peindre une façade extérieure',
        'Traiter des fissures de façade', 'Poser des bardages bois',
        // Aménagement & rangement
        'Construire un dressing sur mesure', 'Aménager un placard sous les combles',
        'Fabriquer des tiroirs coulissants', 'Installer des étagères dans un placard',
        'Construire un lit mezzanine pour enfant', 'Aménager un couloir avec des rangements',
        'Fabriquer un meuble TV encastré', 'Créer une bibliothèque murale intégrée',
        'Construire un banc coffre', 'Aménager un coin bureau dans une chambre',
        // Rénovation & restauration
        'Restaurer un meuble en bois ancien', 'Réparer un carrelage fissuré',
        'Rénover des volets en bois', 'Restaurer une porte ancienne',
        'Réparer un parquet qui grince', 'Rénover des fenêtres en bois',
        'Traiter du bois contre les termites', 'Réparer un mur en béton fissuré',
        'Restaurer une baignoire ancienne', 'Rénover un escalier en bois',
        // Sécurité & domotique
        'Installer une alarme maison sans fil', 'Poser une caméra de surveillance extérieure',
        'Installer un interphone vidéo', 'Poser un verrou connecté',
        'Installer un détecteur de gaz', 'Poser un détecteur de monoxyde de carbone',
        'Installer des serrures de sécurité', 'Mettre en place un système d\'éclairage automatique',
        'Installer un store motorisé', 'Poser des volets roulants électriques',
        // Maçonnerie & béton
        'Couler une dalle béton', 'Construire un muret en parpaings',
        'Réaliser un enduit de façade', 'Poser des bordures de jardin en béton',
        'Construire des marches en béton', 'Réparer un escalier en béton fissuré',
        'Réaliser un dallage en béton', 'Construire une fondation pour abri de jardin',
        'Poser des pavés autobloquants', 'Créer un chemin en béton imprimé',
        // Menuiserie extérieure
        'Poser une porte d\'entrée blindée', 'Installer une porte-fenêtre',
        'Poser des fenêtres double vitrage', 'Installer un velux',
        'Construire une cabane de jardin en bois', 'Poser un bardage en bois',
        'Installer un brise-vue en bois', 'Fabriquer un portail en bois',
        'Construire une clôture en bois naturel', 'Poser une pergola en aluminium',
        // Économies d\'énergie
        'Installer des panneaux solaires thermiques', 'Poser un chauffe-eau solaire',
        'Installer une récupération d\'eau de pluie enterrée', 'Isoler une toiture terrasse',
        'Poser un double vitrage sur fenêtre existante', 'Installer un puits de lumière',
        'Créer une toiture végétalisée', 'Installer un poêle à granulés à insert',
        'Poser des brise-soleil orientables', 'Installer une VMC double flux',
        // Petits travaux pratiques
        'Accrocher un tableau lourd', 'Fixer une télévision au mur',
        'Monter un lit en bois avec rangements', 'Assembler un meuble flat-pack difficile',
        'Réparer une charnière de porte cassée', 'Débloquer une porte qui frotte',
        'Remettre d\'aplomb une porte qui ferme mal', 'Réparer un store enrouleur',
        'Changer la poignée d\'une porte', 'Fixer des patères et crochets muraux',
        // Terrasse & extérieur
        'Construire une terrasse sur pilotis', 'Poser des lames de terrasse en bois exotique',
        'Créer une terrasse en pierre naturelle', 'Installer un jacuzzi extérieur',
        'Construire un pool house', 'Poser un brise-vent de terrasse',
        'Installer une cuisine extérieure', 'Construire un bar de jardin en bois',
        'Poser un parquet extérieur en teck', 'Aménager une terrasse sur toit',
        // Plâtrerie & cloisons
        'Monter une cloison en plaques de plâtre', 'Réaliser un faux plafond en placo',
        'Poser des spots dans un faux plafond', 'Créer une niche dans un mur',
        'Ouvrir un mur non porteur', 'Poser des cornières de plâtre',
        'Réaliser un coffrage pour canalisation', 'Poser un habillage de colonne',
        'Créer un renfoncement décoratif dans un mur', 'Poser des baguettes de finition',
    ];

    public function __construct(
        private EntityManagerInterface      $em,
        private readonly ManagerRegistry    $registry,
        private readonly TutorialRepository $tutorialRepository,
        private readonly TagRepository      $tagRepository,
        private readonly CategoryRepository $categoryRepository,
        private readonly ?string            $anthropicApiKey = null,
    ) {}

    public function aggregate(array $options = []): array
    {
        // No API key configured: nothing to generate, skip gracefully
        if ($this->anthropicApiKey === null || $this->anthropicApiKey === '') {
            return ['count' => 0];
        }

        $limit      = (int) ($options['limit'] ?? $options['max'] ?? 10);
        $difficulty = $options['difficulty'] ?? null;
        $topicOpt   = $options['topic'] ?? null;

        $topics = $topicOpt
            ? [$topicOpt]
            : $this->pickTopics($limit);

        $client  = new Client(apiKey: $this->anthropicApiKey);
        $created = 0;

        foreach ($topics as $topic) {
            if ($created >= $limit) {
                break;
            }

            $externalId = 'claude-' . md5(mb_strtolower(trim($topic)));

            if ($this->tutorialRepository->findByExternalId($externalId)) {
                continue;
            }

            $tutorialData = $this->generateTutorial($client, $topic, $difficulty);
            if (!$tutorialData) {
                continue;
            }

            $tutorial = new Tutorial();
            $tutorial
                ->setTitle($tutorialData['title'])
                ->setSlug($externalId)
                ->setDescription($tutorialData['description'])
                ->setContent($tutorialData['content'])
                ->setSource(TutorialSource::Generated)
                ->setExternalId($externalId)
                ->setPublished(true);

            foreach (array_slice($tutorialData['tags'] ?? [], 0, 6) as $tagName) {
                $tagName = trim((string) $tagName);
                if ($tagName && strlen($tagName) <= 60) {
                    $slug = $this->slugify($tagName);
                    $tutorial->addTag($this->tagRepository->findOrCreate($tagName, $slug));
                }
            }

            $saved = false;
            for ($attempt = 0; $attempt < 3 && !$saved; $attempt++) {
                try {
                    $this->em->persist($tutorial);
                    $this->em->flush();
                    $saved = true;
                    ++$created;
                } catch (\Doctrine\DBAL\Exception\UniqueConstraintViolationException) {
                    $this->em = $this->registry->resetManager();
                    $this->tagRepository->clearCache();
                    // Re-attach tags with fresh EM before retry
                    $tutorial = (new Tutorial())
                        ->setTitle($tutorialData['title'])
                        ->setSlug($externalId)
                        ->setDescription($tutorialData['description'])
                        ->setContent($tutorialData['content'])
                        ->setSource(TutorialSource::Generated)
                        ->setExternalId($externalId)
                        ->setPublished(true);
                    foreach (array_slice($tutorialData['tags'] ?? [], 0, 6) as $tagName) {
                        $tagName = trim((string) $tagName);
                        if ($tagName && strlen($tagName) <= 60) {
                            $tutorial->addTag($this->tagRepository->findOrCreate($tagName, $this->slugify($tagName)));
                        }
                    }
                }
            }
        }

        return ['count' => $created];
    }

    private function generateTutorial(Client $client, string $topic, ?string $difficulty): ?array
    {
        $difficultyLine = $difficulty ? "- difficulty: \"{$difficulty}\" (débutant / intermédiaire / avancé)" : '';

        $prompt = <<<PROMPT
            Tu es un expert en bricolage et rénovation. Génère un tutoriel complet en français pour : "{$topic}".

            Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, respectant exactement ce schéma :
            {
              "title": "Titre du tutoriel (string)",
              "description": "Résumé accrocheur de 1-2 phrases (string)",
              "difficulty": "Débutant | Intermédiaire | Avancé (string)",
              "duration": "Ex: 30 min, 2h, 1 journée (string)",
              "content": "Contenu complet en Markdown (string)",
              "tags": ["tag1", "tag2", ...] (3 à 6 tags pertinents en français)
            }

            {$difficultyLine}

            Pour "content", structure le Markdown ainsi :
            ## Matériel nécessaire
            (liste des outils et matériaux indispensables, format liste à tirets)

            ## Matériel optionnel
            (liste des outils pratiques mais non obligatoires, format liste à tirets — si aucun, omettre cette section)

            ## Avant de commencer
            (conseils de sécurité et préparation)

            ## Étapes
            ### Étape 1 : ...
            ...

            ## Conseils & astuces
            (2-3 conseils pratiques)

            Sois précis, pratique et adapté au grand public français.
            PROMPT;

        try {
            $message = $client->messages->create(
                model: 'claude-haiku-4-5',
                maxTokens: 2048,
                messages: [['role' => 'user', 'content' => trim($prompt)]],
            );

            $text = '';
            foreach ($message->content as $block) {
                if ($block->type === 'text') {
                    $text = $block->text;
                    break;
                }
            }

            // Extract JSON from the response (strip any accidental wrapping)
            if (preg_match('/\{.*\}/s', $text, $m)) {
                $data = json_decode($m[0], true);
                if (json_last_error() === JSON_ERROR_NONE && !empty($data['title'])) {
                    return $data;
                }
            }
        } catch (\Throwable $e) {
            fwrite(STDERR, "[claude] Error for topic \"{$topic}\": " . $e->getMessage() . "\n");
        }

        return null;
    }

    /** Pick $n topics that aren't already in DB, shuffled. */
    private function pickTopics(int $n): array
    {
        $shuffled = self::TOPICS;
        shuffle($shuffled);

        $picked = [];
        foreach ($shuffled as $topic) {
            if (count($picked) >= $n * 2) {
                break; // enough candidates
            }
            $externalId = 'claude-' . md5(mb_strtolower(trim($topic)));
            if (!$this->tutorialRepository->findByExternalId($externalId)) {
                $picked[] = $topic;
            }
        }

        return array_slice($picked, 0, $n);
    }

    private function slugify(string $text): string
    {
        $text = mb_strtolower($text);
        $text = preg_replace('/[^a-z0-9]+/', '-', $text) ?? '';
        return trim($text, '-');
    }
}
