<?php

namespace App\EventSubscriber;

use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Event\ResponseEvent;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpFoundation\JsonResponse;

class SecurityHeadersSubscriber implements EventSubscriberInterface
{
    public function __construct(
        private readonly RateLimiterFactory $loginLimiter,
        private readonly RateLimiterFactory $registerLimiter,
        private readonly RateLimiterFactory $liveSearchLimiter,
    ) {}

    public static function getSubscribedEvents(): array
    {
        return [
            KernelEvents::REQUEST  => ['onKernelRequest',  10],
            KernelEvents::RESPONSE => ['onKernelResponse', 0],
        ];
    }

    public function onKernelRequest(RequestEvent $event): void
    {
        if (!$event->isMainRequest()) {
            return;
        }

        $request = $event->getRequest();
        $path    = $request->getPathInfo();
        $ip      = $request->getClientIp() ?? 'unknown';

        $limiter = match (true) {
            $path === '/api/login'       && $request->isMethod('POST') => $this->loginLimiter->create($ip),
            $path === '/api/register'    && $request->isMethod('POST') => $this->registerLimiter->create($ip),
            $path === '/api/live-search' && $request->isMethod('GET')  => $this->liveSearchLimiter->create($ip),
            default => null,
        };

        if ($limiter === null) {
            return;
        }

        $limit = $limiter->consume(1);
        if (!$limit->isAccepted()) {
            $retryAfter = $limit->getRetryAfter()->getTimestamp() - time();
            $response = new JsonResponse(
                ['error' => 'Too many requests. Please try again later.'],
                Response::HTTP_TOO_MANY_REQUESTS,
                ['Retry-After' => $retryAfter]
            );
            $event->setResponse($response);
        }
    }

    public function onKernelResponse(ResponseEvent $event): void
    {
        if (!$event->isMainRequest()) {
            return;
        }

        $headers = $event->getResponse()->headers;

        $headers->set('X-Content-Type-Options', 'nosniff');
        $headers->set('X-Frame-Options', 'DENY');
        $headers->set('X-XSS-Protection', '1; mode=block');
        $headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        $headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

        // Remove info-leaking headers
        $headers->remove('X-Powered-By');
        $headers->remove('Server');
    }
}
