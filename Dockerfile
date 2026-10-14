# Stage 1: Build frontend
FROM node:22-alpine AS frontend-build
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: PHP application
FROM dunglas/frankenphp:php8.4-alpine

RUN apk add --no-cache libpq-dev icu-dev \
    && install-php-extensions pdo pdo_pgsql pgsql intl opcache apcu

RUN echo "opcache.enable=1" >> /usr/local/etc/php/conf.d/opcache.ini \
    && echo "opcache.memory_consumption=128" >> /usr/local/etc/php/conf.d/opcache.ini \
    && echo "opcache.max_accelerated_files=10000" >> /usr/local/etc/php/conf.d/opcache.ini \
    && echo "opcache.validate_timestamps=0" >> /usr/local/etc/php/conf.d/opcache.ini \
    && echo "opcache.jit=tracing" >> /usr/local/etc/php/conf.d/opcache.ini \
    && echo "opcache.jit_buffer_size=64M" >> /usr/local/etc/php/conf.d/opcache.ini \
    && echo "apc.enabled=1" >> /usr/local/etc/php/conf.d/apcu.ini \
    && echo "apc.shm_size=64M" >> /usr/local/etc/php/conf.d/apcu.ini \
    && echo "apc.enable_cli=1" >> /usr/local/etc/php/conf.d/apcu.ini

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY Caddyfile /etc/caddy/Caddyfile

WORKDIR /app
COPY . .
# .env is no longer committed: start from the example defaults (real env vars override them)
RUN [ -f .env ] || cp .env.example .env

# Copy built frontend assets into public/
COPY --from=frontend-build /build/dist/ public/

# Composer disables plugins when running as root non-interactively; symfony/runtime is a plugin
# and generates vendor/autoload_runtime.php, so allow it explicitly. Fail the build if install fails.
ENV COMPOSER_ALLOW_SUPERUSER=1
RUN composer install --no-dev --optimize-autoloader --no-scripts --no-interaction \
    && test -f vendor/autoload_runtime.php
RUN APP_ENV=prod APP_SECRET=dummy php bin/console assets:install public --no-debug --no-interaction || true

CMD ["/bin/sh", "-c", "php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration && { [ \"$SEED_ON_BOOT\" = \"1\" ] && php bin/console app:seed-paths --no-interaction || true; } && php bin/console cache:warmup --env=prod --no-debug 2>/dev/null || true && SERVER_NAME=:${PORT:-8080} frankenphp run --config /etc/caddy/Caddyfile"]
