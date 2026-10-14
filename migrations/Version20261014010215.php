<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20261014010215 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Add cached AI summary columns to tutorial (additive)';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE tutorial ADD ai_summary JSON DEFAULT NULL');
        $this->addSql('ALTER TABLE tutorial ADD ai_summary_at TIMESTAMP(0) WITHOUT TIME ZONE DEFAULT NULL');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE tutorial DROP ai_summary');
        $this->addSql('ALTER TABLE tutorial DROP ai_summary_at');
    }
}
