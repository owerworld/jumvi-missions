# Why the `-1` suffix

`fredoka-var-latin-1.woff2`, not `fredoka-var-latin.woff2`.

CORE_ASSETS paths are unversioned on purpose — the service worker precaches
literal URLs and a `?v=` would stop the precache matching. That is fine until
you request one of those paths *before* the deploy has reached every edge node.
Cloudflare Pages answers an unknown path with the SPA fallback: HTTP 200,
`content-type` copied from a sibling, and an HTML body. `/assets/*` is
`max-age=86400, stale-while-revalidate=604800`, so that answer sticks around.

That is exactly what happened on the first Fredoka deploy. Four consecutive
GETs to the plain URL returned 29704 / 29704 / **54793 bytes of HTML** / 29704,
all with `cf-cache-status: HIT` — one shard had cached the fallback.

The service worker makes it worse rather than better: `cache.addAll` treats a
200 as success, so it would happily store that HTML *as the font* and keep it
until the next CACHE_NAME bump.

So: **when the bytes at an unversioned path change, give the file a new name.**
A fresh name is a fresh cache key on every node, and it needs no dashboard
access to fix. Bump the suffix (`-1` → `-2`) and update the three references:
style.css @font-face, the index.html preload, and CORE_ASSETS.

Verify by MAGIC BYTES, never by status code and never by content-type:
    curl -s <url> | head -c4 | xxd -p     # must be 774f4632 ("wOF2")
