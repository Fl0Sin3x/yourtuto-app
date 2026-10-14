<?php

use App\Kernel;
use Symfony\Component\HttpFoundation\Request;

require_once __DIR__ . '/vendor/autoload.php';

$_SERVER['APP_ENV'] ??= 'prod';
$_SERVER['APP_DEBUG'] ??= '0';

$kernel = new Kernel($_SERVER['APP_ENV'], (bool) $_SERVER['APP_DEBUG']);
$kernel->boot();

$handler = static function () use ($kernel): void {
    $request  = Request::createFromGlobals();
    $response = $kernel->handle($request);
    $response->send();
    $kernel->terminate($request, $response);
};

while (\frankenphp_handle_request($handler));
