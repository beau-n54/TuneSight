# Durable Working deployment and recovery

Migration: `20261012000100_durable_working_revisions.sql`.

Deploy in this order: expand schema, verify managed canary and production schema,
then deploy the compatible R04/R05 application. The accepted older application
does not read these tables and can continue using its browser Working store while
the migration is applied. There is no automatic data import or second writer.

Saved data consists of bounded sparse mutation/history JSON, never source binary
snapshots or all-Table evidence. Each revision is at most 2 MiB; each vehicle has a
maximum of 128 saved revisions and 64 MiB of revision payload across all sessions.
Limits are checked under the same vehicle row lock as head CAS and deletion.
Limit rejection preserves every existing revision. No oldest-history eviction or
automatic pruning is permitted. Revisions remain until the owner deletes their
vehicle through the existing deletion workflow. They can be read/replayed only
while the exact admitted session remains available and compatible; its existing
30-day evidence lifetime is unchanged. Source-lease expiry does not erase history.

The existing private-object deletion outbox removes source/session objects before
vehicle deletion. Foreign-key cascades then remove scopes and revisions in the
same database transaction as the vehicle. R04 introduces no new storage objects
or signed URLs. A failed object deletion leaves both the vehicle and its revisions
in place for retry; a pending deletion rejects further Working saves.

The browser's previous Working namespace is preserved byte-for-byte. On first
load the server's head takes precedence. If only legacy browser Working exists,
it is loaded as an unsaved proposal. Import requires explicit Save and fresh
server-side replay. Conflicting legacy data remains available for deliberate
loading and never silently replaces the durable head. New authenticated devices
read the server head without relying on legacy browser data.

Saved revisions, their parent, previous head, restoration source, actor, database
timestamp, exact identity, content SHA-256, capability and contract are immutable.
Restoration adds a revision whose parent references the selected historical
revision and whose previous head records the head it replaced. Continued editing
then parents from that newly restored head. Each uncertain save retains its exact
idempotency request in page memory; retry returns the same committed revision.
A concurrent later head is an explicit conflict, never a silent merge.

Recovery after application failure is forward-compatible: leave the additive
tables and saved revisions intact, disable new mutations by withdrawing the new
application, and repair/redeploy the compatible application. An older browser-only
application cannot represent the durable server head; do not describe its local
state as current server history or automatically re-import it. Never drop these
tables or revert their schema after durable data exists. A destructive schema
rollback requires a separately reviewed, owner-preserving migration. Migration
reapplication is safe and must preserve existing scope/head/revision records.

Build Calibration, BIN/container export and Direct Flash remain locked. Durable
history confers no checksum, output, installation or vehicle-write qualification.
