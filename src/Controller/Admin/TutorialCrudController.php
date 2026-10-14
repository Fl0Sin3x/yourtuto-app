<?php

namespace App\Controller\Admin;

use App\Entity\Tutorial;
use App\Enum\TutorialSource;
use EasyCorp\Bundle\EasyAdminBundle\Config\Action;
use EasyCorp\Bundle\EasyAdminBundle\Config\Actions;
use EasyCorp\Bundle\EasyAdminBundle\Config\Crud;
use EasyCorp\Bundle\EasyAdminBundle\Config\Filters;
use EasyCorp\Bundle\EasyAdminBundle\Controller\AbstractCrudController;
use EasyCorp\Bundle\EasyAdminBundle\Field\AssociationField;
use EasyCorp\Bundle\EasyAdminBundle\Field\BooleanField;
use EasyCorp\Bundle\EasyAdminBundle\Field\ChoiceField;
use EasyCorp\Bundle\EasyAdminBundle\Field\DateTimeField;
use EasyCorp\Bundle\EasyAdminBundle\Field\IdField;
use EasyCorp\Bundle\EasyAdminBundle\Field\IntegerField;
use EasyCorp\Bundle\EasyAdminBundle\Field\TextareaField;
use EasyCorp\Bundle\EasyAdminBundle\Field\TextField;
use EasyCorp\Bundle\EasyAdminBundle\Filter\BooleanFilter;
use EasyCorp\Bundle\EasyAdminBundle\Filter\ChoiceFilter;

class TutorialCrudController extends AbstractCrudController
{
    public static function getEntityFqcn(): string
    {
        return Tutorial::class;
    }

    public function configureCrud(Crud $crud): Crud
    {
        return $crud
            ->setEntityLabelInSingular('Tutoriel')
            ->setEntityLabelInPlural('Tutoriels')
            ->setDefaultSort(['createdAt' => 'DESC'])
            ->setSearchFields(['title', 'description', 'slug'])
            ->setPaginatorPageSize(30);
    }

    public function configureActions(Actions $actions): Actions
    {
        return $actions
            ->add(Crud::PAGE_INDEX, Action::DETAIL);
    }

    public function configureFilters(Filters $filters): Filters
    {
        return $filters
            ->add(BooleanFilter::new('published'))
            ->add(ChoiceFilter::new('source')->setChoices(array_combine(
                array_map(fn($s) => $s->value, TutorialSource::cases()),
                array_map(fn($s) => $s->value, TutorialSource::cases()),
            )));
    }

    public function configureFields(string $pageName): iterable
    {
        $sources = array_combine(
            array_map(fn($s) => $s->value, TutorialSource::cases()),
            array_map(fn($s) => $s->value, TutorialSource::cases()),
        );

        yield IdField::new('id')->onlyOnIndex();
        yield TextField::new('title', 'Titre');
        yield TextField::new('slug')->hideOnIndex();
        yield ChoiceField::new('source', 'Source')->setChoices($sources);
        yield BooleanField::new('published', 'Publié');
        yield TextField::new('difficulty', 'Niveau')->hideOnIndex();
        yield TextField::new('duration', 'Durée')->hideOnIndex();
        yield TextareaField::new('description', 'Description')->hideOnIndex();
        yield TextareaField::new('content', 'Contenu')->onlyOnForms()->setNumOfRows(20);
        yield AssociationField::new('categories', 'Catégories')->hideOnIndex();
        yield AssociationField::new('tags', 'Tags')->hideOnIndex();
        yield AssociationField::new('author', 'Auteur')->hideOnIndex();
        yield IntegerField::new('viewCount', 'Vues')->hideOnForm();
        yield DateTimeField::new('createdAt', 'Créé le')->hideOnForm()->setFormat('dd/MM/yyyy HH:mm');
    }
}
