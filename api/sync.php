<?php
/**
 * Study Quest — sync endpoint.
 *
 * Stores one JSON copy of the app state per family code, so the phone, the
 * PC and a parent's phone all see the same progress. Upload the whole api/
 * folder next to index.html. Works on PHP 7.0+ with no database.
 *
 *   GET  sync.php?ping=1                 -> {"ok":true,"app":"studyquest"}
 *   GET  sync.php?family=CODE            -> {"ok":true,"rev":3,"state":{...}|null}
 *   POST sync.php?family=CODE  {baseRev, state}
 *        -> 200 {"ok":true,"rev":4}
 *        -> 409 {"ok":false,"error":"conflict","rev":4,"state":{...}}  (merge and retry)
 *
 * Files are saved as api/data/<sha256>.php starting with "<?php exit; ?>",
 * so even a server that ignores .htaccess will never show their contents.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');

define('SQ_MAX_BYTES', 3000000);
define('SQ_GUARD', "<?php http_response_code(404); exit; ?>\n");

function sq_reply($code, $body)
{
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function sq_read($file)
{
    if (!is_file($file)) {
        return null;
    }
    $raw = file_get_contents($file);
    if ($raw === false) {
        return null;
    }
    $nl = strpos($raw, "\n");
    $json = $nl === false ? $raw : substr($raw, $nl + 1);
    $rec = json_decode($json);
    return is_object($rec) ? $rec : null;
}

if (isset($_GET['ping'])) {
    sq_reply(200, array('ok' => true, 'app' => 'studyquest', 'v' => 1));
}

$family = isset($_GET['family']) ? strtoupper((string) $_GET['family']) : '';
if (!preg_match('/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/', $family)) {
    sq_reply(400, array('ok' => false, 'error' => 'bad-family'));
}

$dir = __DIR__ . '/data';
if (!is_dir($dir) && !@mkdir($dir, 0750, true)) {
    sq_reply(500, array('ok' => false, 'error' => 'no-data-folder'));
}
$file = $dir . '/' . hash('sha256', 'studyquest:' . $family) . '.php';
$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';

if ($method === 'GET') {
    $rec = sq_read($file);
    sq_reply(200, array(
        'ok' => true,
        'rev' => $rec ? (int) $rec->rev : 0,
        'state' => $rec ? $rec->state : null,
    ));
}

if ($method !== 'POST') {
    sq_reply(405, array('ok' => false, 'error' => 'method'));
}

$body = file_get_contents('php://input');
if ($body === false || strlen($body) > SQ_MAX_BYTES) {
    sq_reply(413, array('ok' => false, 'error' => 'too-big'));
}
$in = json_decode($body);
if (!is_object($in) || !isset($in->state) || !is_object($in->state)) {
    sq_reply(400, array('ok' => false, 'error' => 'bad-body'));
}
$baseRev = isset($in->baseRev) ? (int) $in->baseRev : -1;

$lock = fopen($file . '.lock', 'c');
if ($lock === false || !flock($lock, LOCK_EX)) {
    sq_reply(500, array('ok' => false, 'error' => 'lock'));
}

$rec = sq_read($file);
$rev = $rec ? (int) $rec->rev : 0;
if ($rev !== $baseRev) {
    flock($lock, LOCK_UN);
    fclose($lock);
    sq_reply(409, array('ok' => false, 'error' => 'conflict', 'rev' => $rev, 'state' => $rec ? $rec->state : null));
}

$new = array('rev' => $rev + 1, 'updated' => time(), 'state' => $in->state);
$tmp = $file . '.' . getmypid() . '.tmp';
$ok = file_put_contents($tmp, SQ_GUARD . json_encode($new, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) !== false
    && rename($tmp, $file);

flock($lock, LOCK_UN);
fclose($lock);

if (!$ok) {
    @unlink($tmp);
    sq_reply(500, array('ok' => false, 'error' => 'write'));
}
sq_reply(200, array('ok' => true, 'rev' => $rev + 1));
