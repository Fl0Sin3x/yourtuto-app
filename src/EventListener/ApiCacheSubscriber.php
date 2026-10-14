<?php

namespace App\EventListener;

use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\Event\ResponseEvent;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * Caches full JSON responses in APCu (shared memory across all FrankenPHP workers).
 * First request = MISS (~2s, hits DB). All subsequent = HIT (~5ms, from APCu).
 */
final class ApiCacheSubscriber implements EventSubscriberInterface
{
    private const CACHEABLE = [
        '/api/tutorials'  => 90,
        '/api/categories' => 300,
        '/api/tags'       => 300,
        '/api/comments'   => 30,
    ];

    public static function getSubscribedEvents(): array
    {
        return [
            KernelEvents::REQUEST  => ['onRequest', 30],
            KernelEvents::RESPONSE => ['onResponse', -128],
        ];
    }

    public function onRequest(RequestEvent $event): void
    {
        if (!$event->isMainRequest() || $event->getRequest()->getMethod() !== 'GET') {
            return;
        }

        $key = $this->key($event->getRequest()->getPathInfo(), $event->getRequest()->getQueryString() ?? '');
        if ($key === null) {
            return;
        }

        if (!function_exists('apcu_fetch')) {
            return;
        }

        $entry = apcu_fetch($key, $ok);
        if (!$ok) {
            return;
        }

        $event->setResponse(new Response($entry['body'], $entry['status'], [
            'Content-Type' => 'application/ld+json',
            'X-Cache'      => 'HIT',
        ]));
    }

    public function onResponse(ResponseEvent $event): void
    {
        if (!$event->isMainRequest()) {
            return;
        }

        $request  = $event->getRequest();
        $response = $event->getResponse();

        if ($request->getMethod() !== 'GET' || $response->getStatusCode() !== 200) {
            return;
        }
        if ($response->headers->get('X-Cache') === 'HIT') {
            return;
        }

        $path = $request->getPathInfo();
        $ttl  = $this->ttl($path);
        if ($ttl === null) {
            return;
        }

        if (!function_exists('apcu_store')) {
            return;
        }

        $key = $this->key($path, $request->getQueryString() ?? '');
        if ($key === null || apcu_exists($key)) {
            return;
        }

        apcu_store($key, [
            'body'   => (string) $response->getContent(),
            'status' => $response->getStatusCode(),
        ], $ttl);

        $response->headers->set('X-Cache', 'MISS');
    }

    private function key(string $path, string $qs): ?string
    {
        foreach (self::CACHEABLE as $prefix => $_) {
            if ($path === $prefix || str_starts_with($path, $prefix . '/') || str_starts_with($path, $prefix . '?')) {
                return 'apicache_' . md5($path . '|' . $qs);
            }
        }
        return null;
    }

    private function ttl(string $path): ?int
    {
        foreach (self::CACHEABLE as $prefix => $ttl) {
            if ($path === $prefix || str_starts_with($path, $prefix)) {
                return $ttl;
            }
        }
        return null;
    }
}
