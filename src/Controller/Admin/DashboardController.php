<?php

namespace App\Controller\Admin;

use App\Entity\Category;
use App\Entity\Comment;
use App\Entity\Tag;
use App\Entity\Tutorial;
use App\Entity\TutorialRating;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use EasyCorp\Bundle\EasyAdminBundle\Attribute\AdminDashboard;
use EasyCorp\Bundle\EasyAdminBundle\Config\Dashboard;
use EasyCorp\Bundle\EasyAdminBundle\Config\MenuItem;
use EasyCorp\Bundle\EasyAdminBundle\Controller\AbstractDashboardController;
use EasyCorp\Bundle\EasyAdminBundle\Router\AdminUrlGenerator;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[AdminDashboard(routePath: '/admin', routeName: 'admin')]
#[IsGranted('ROLE_ADMIN')]
class DashboardController extends AbstractDashboardController
{
    public function __construct(private EntityManagerInterface $em) {}

    public function index(): Response
    {
        // If a specific CRUD is requested via query param, let EasyAdmin handle it
        if ($this->container->get('request_stack')->getCurrentRequest()?->query->has('crudControllerFqcn')) {
            return parent::index();
        }

        $conn = $this->em->getConnection();

        // Counts
        $stats = [
            'tutorials'  => (int) $conn->fetchOne('SELECT COUNT(*) FROM tutorial'),
            'published'  => (int) $conn->fetchOne("SELECT COUNT(*) FROM tutorial WHERE published = true"),
            'users'      => (int) $conn->fetchOne('SELECT COUNT(*) FROM "user"'),
            'comments'   => (int) $conn->fetchOne('SELECT COUNT(*) FROM comment'),
            'ratings'    => (int) $conn->fetchOne('SELECT COUNT(*) FROM tutorial_rating'),
            'views'      => (int) $conn->fetchOne('SELECT COALESCE(SUM(view_count), 0) FROM tutorial'),
            'avgRating'  => round((float) $conn->fetchOne('SELECT COALESCE(AVG(rating), 0) FROM tutorial_rating'), 1),
        ];

        // Tutorials by source
        $bySource = $conn->fetchAllKeyValue(
            "SELECT source, COUNT(*) FROM tutorial GROUP BY source ORDER BY COUNT(*) DESC"
        );

        // Last 7 days signups
        $newUsers = (int) $conn->fetchOne(
            "SELECT COUNT(*) FROM \"user\" WHERE created_at >= NOW() - INTERVAL '7 days'"
        );

        // Last 7 days tutorials
        $newTutorials = (int) $conn->fetchOne(
            "SELECT COUNT(*) FROM tutorial WHERE created_at >= NOW() - INTERVAL '7 days'"
        );

        // Recent comments
        $recentComments = $conn->fetchAllAssociative(
            'SELECT c.content, c.created_at, u.username, t.title AS tutorial_title
             FROM comment c
             JOIN "user" u ON c.author_id = u.id
             JOIN tutorial t ON c.tutorial_id = t.id
             ORDER BY c.created_at DESC LIMIT 5'
        );

        // Top tutorials by views
        $topTutorials = $conn->fetchAllAssociative(
            'SELECT title, view_count, source FROM tutorial ORDER BY view_count DESC LIMIT 5'
        );

        $urlGenerator = $this->container->get(AdminUrlGenerator::class);

        return $this->render('admin/dashboard.html.twig', [
            'stats'           => $stats,
            'bySource'        => $bySource,
            'newUsers'        => $newUsers,
            'newTutorials'    => $newTutorials,
            'recentComments'  => $recentComments,
            'topTutorials'    => $topTutorials,
            'urlTutorials'    => $urlGenerator->setController(TutorialCrudController::class)->generateUrl(),
            'urlUsers'        => $urlGenerator->setController(UserCrudController::class)->generateUrl(),
            'urlComments'     => $urlGenerator->setController(CommentCrudController::class)->generateUrl(),
        ]);
    }

    public function configureDashboard(): Dashboard
    {
        return Dashboard::new()
            ->setTitle('YourTuto Admin')
            ->setFaviconPath('favicon.ico')
            ->renderContentMaximized();
    }

    public function configureMenuItems(): iterable
    {
        yield MenuItem::section('Contenu');
        yield MenuItem::linkTo(TutorialCrudController::class,      'Tutoriels',   'fas fa-book');
        yield MenuItem::linkTo(CategoryCrudController::class,      'Catégories',  'fas fa-folder');
        yield MenuItem::linkTo(TagCrudController::class,           'Tags',        'fas fa-tags');

        yield MenuItem::section('Communauté');
        yield MenuItem::linkTo(UserCrudController::class,          'Utilisateurs','fas fa-users');
        yield MenuItem::linkTo(CommentCrudController::class,       'Commentaires','fas fa-comments');
        yield MenuItem::linkTo(TutorialRatingCrudController::class,'Notes',       'fas fa-star');

        yield MenuItem::section('');
        yield MenuItem::linkToUrl('← Retour au site', 'fas fa-arrow-left', '/');
    }
}
