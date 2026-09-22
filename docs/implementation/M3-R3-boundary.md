# M3 — R3 human decision implementation

The 2026-09-23 human R3 decision fills LOCK 06/07's deliberately deferred minimum-data and protection fields. JD 01–15 and LOCK 01–09 are unchanged. R3 permits neither online profiles nor any transmission of personal records. The existing main/play UI stays optional and independent of storage availability.

## Contradiction check and red-team

- No profile prerequisite, preselected last person or profile-first flow. Creating a player does not save a report. Native radio selection and a separate Save action implement C-09.
- Only nickname input; system labels are exactly Player 1, Player 2, etc. No age, account, auth, uploaded image, voice or location input. The grown-up boundary states its editing/deletion purpose; it claims neither verified identity nor legal consent.
- IDB-only names and history, with no server or telemetry transport. Minimal session resume remains round/mission/version only. BroadcastChannel transmits the literal `changed`, never a name or record. Personal state is never in URL or navigation history.
- Separate report revision and record revision. Saving uses explicit report payload; the system never claims measured physical success. Attribution correction moves the same record only after scope confirmation; a later report revision remains a distinct explicit save.
- Scope-aware C-17 deletion: Cancel initially focused, native modal background inert, Escape cancels. One player deletes its records and pending envelopes. All-local deletion also removes known legacy player/team/history keys, including orphaned scopes, while preserving unrelated storage/preferences. Downloaded backups are explicitly outside browser deletion scope. Old open legacy tabs remain an M5 migration/release condition, not a proven closed-origin guarantee.
- New local storage stores no historical analytics, timestamps, age or inferred completion. Pending envelopes are retained only as part of explicitly requested local history, removable with their player or all-local deletion. A minimal random epoch and next-label counter are control metadata, not a user activity log.
- A deletion epoch fences stale all-data writes. Player existence/revision checks fence late operations after one-player deletion. Atomic IDB operations/records plus unique target/report/revision intent prevent duplicate saves even across tabs. Success requires transaction completion and read-back. Failure/unknown remains distinct from success.
- A late operation may commit to the originally chosen player after navigation. It cannot overwrite a different screen/context. Management reconciles the original operation; Retry never silently allocates a replacement operation.
- Legacy access reads key presence only; there is no import or old-success dashboard. Explicit all-local deletion is authorized by R3 and the LOCK 09 deletion exception to migration preservation. IDB deletion and legacy deletion cannot share one atomic transaction; a partial cleanup has explicit failure copy and can be retried.

## Repository schema

`jumvi-companion-v1`, version 1: `meta`, `players`, `operations`, `records`.

Player: random local id, system label, optional nickname, concurrency revision. No timestamps. Report: local report id/revision, mission/mechanics version, optional round id, explicit complete/early declaration. Operation: identity, deletion epoch, selected target/revision, canonical payload SHA-256, unique intent and pending/committed state. Record: operation identity, target, explicit report, attribution revision. Reconciliation is local only; no cloud backup is implied.

Default lifetime: until explicit deletion or browser/OS removal. No permanent durability promise. Database denied/blocked/evicted/corrupt and quota failures must not stop physical play or imply a verified save.

## TR / EN-US disclosure

TR: Oyuncu geçmişi yalnızca bu cihazdaki bu tarayıcıda saklanır. Bu bir çevrimiçi hesap değildir. Tarayıcı verilerini temizlemek geçmişi silebilir.

EN-US: Player history is stored only in this browser on this device. It is not an online account. Clearing browser data may remove it.

The management context additionally explains local retention and absence of server transmission/retention. A future network requirement is a mandatory new human privacy decision; this module has no transport fallback.

## Validation scope

Chromium + WebKit synthetic contexts, real IndexedDB, UI flows, concurrent operations, transaction abort/quota, deletion fences, denied/blocked/versionchange, reload reconciliation, guest/report separation, correction, rename, C-17 cancellation, TR/EN and 200% reflow, negative network/history checks. Test data is synthetic and isolated. Real children, actual iOS/Android assistive technology, outdoor hardware and old open production-tab migration are not represented as tested.
