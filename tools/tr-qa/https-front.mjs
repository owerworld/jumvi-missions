/* Terminates TLS in front of tools/tr-qa/serve.mjs. The panel cookie is Secure,
 * and WebKit — correctly — refuses to store a Secure cookie on an http
 * origin, so testing one-tap entry over http://127.0.0.1 can only ever show
 * it failing. Chromium hides that by treating localhost as trustworthy.
 * This gives both engines a real https origin to judge.

 * Measured, and the reason this file exists: over http://127.0.0.1 the panel's
 * one-tap entry PASSED in Chromium and FAILED in WebKit — no cookie stored, so
 * the second visit was a 401. Over https with the same code, both engines land
 * on the panel with nothing typed. Without this, the obvious reading of that
 * split would have been "one-tap entry is broken in Safari", and the fix would
 * have been to drop the Secure flag — weakening the cookie to satisfy a
 * limitation of the test rig.
 *
 *   openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem \
 *     -days 2 -nodes -subj "/CN=localhost" \
 *     -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
 *   node tools/tr-qa/serve.mjs . 8950
 *   node tools/tr-qa/https-front.mjs <dir-with-the-pem-files> 8960 8950
 *
 * The certificate is self-signed, so drive it with ignoreHTTPSErrors: true.
 * Never point this at anything but a local server. */
import https from "node:https";
import http from "node:http";
import fs from "node:fs";
const [, , certDir, listen, upstream] = process.argv;
https.createServer(
  { key: fs.readFileSync(certDir + "/key.pem"), cert: fs.readFileSync(certDir + "/cert.pem") },
  (req, res) => {
    const proxy = http.request(
      { host: "127.0.0.1", port: Number(upstream), path: req.url, method: req.method, headers: req.headers },
      (up) => { res.writeHead(up.statusCode, up.headers); up.pipe(res); }
    );
    proxy.on("error", (e) => { res.writeHead(502); res.end(String(e)); });
    req.pipe(proxy);
  }
).listen(Number(listen), () => console.log(`https://127.0.0.1:${listen} -> 127.0.0.1:${upstream}`));
