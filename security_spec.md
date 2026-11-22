# Viroklipz Firestore Security Specification

## 1. Data Invariants
1. **Identity Integrity**: No user may create or mutate a `UserProfile`, `UserReaction`, `UserFollow`, `Clip`, or `ClipComment` with an `authorId`, `uid`, `userId`, or `followerId` different from `request.auth.uid`.
2. **Verified Accounts**: All write operations require `request.auth != null && request.auth.token.email_verified == true`.
3. **PII Isolation**: User email is stored exclusively in `/users/{userId}/private/info` and is unreadable and unwritable by any other user.
4. **Atomic Like Synchronization**: Incrementing or decrementing `likesCount` on `/clips/{clipId}` by a non-owner is ONLY permitted as part of a `writeBatch` that synchronously creates or deletes `/users/{uid}/likes/{clipId}` (`existsAfter` / `!existsAfter`).
5. **Immutable Origins**: `uid`, `authorId`, `id`, and `createdAt` cannot be modified after document creation.
6. **Strict Timestamping**: `createdAt` and `updatedAt` must equal `request.time`.
7. **Size & Type Bounds**: Every string, array (`hashtags.size() <= 8`), and document ID (`^[a-zA-Z0-9_\-]+$`, max 128 chars) is bounded to prevent resource exhaustion.
8. **No Raw Media in Firestore**: Firestore stores clip metadata, presets, captions, and optional HTTPS CDN `videoUrl` references (`^https://.*`, <= 300 chars); raw video binaries reside in external object storage or client IndexedDB.
9. **Moderation Privacy & Ownership**: `/reports/{reportId}` is strictly write-only (`reporterId == request.auth.uid`, read/list/update/delete denied to all clients), and `/users/{userId}/blocked/{targetId}` is strictly owner-isolated.
10. **Direct Message Participant Isolation**: `/directThreads/{threadId}` is readable/listable strictly by users in `participantIds` (`size() == 2` distinct IDs), and subcollection messages enforce the Master Gate via parent `get()`.
11. **Status Note Ownership**: `/statusNotes/{userId}` can only be written or deleted by `userId == request.auth.uid` with `note.size() <= 60`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Identity Spoofing on Clip Create**: `{ id: "c1", authorId: "victim_uid", ... }` -> `PERMISSION_DENIED` (`authorId != request.auth.uid`).
2. **Shadow Field Injection on Profile**: `{ uid: "u1", ..., isAdmin: true }` -> `PERMISSION_DENIED` (`keys().hasOnly(...)` rejects ghost fields).
3. **Unverified Email Token Write**: Valid payload with `email_verified: false` -> `PERMISSION_DENIED`.
4. **PII Cross-Read**: User B reads `/users/userA/private/info` -> `PERMISSION_DENIED`.
5. **ID Poisoning**: Creating `/clips/` with a 200-char ID or invalid characters `../admin` -> `PERMISSION_DENIED` (`isValidId` fails).
6. **Likes Desync Attack**: Non-owner increments `likesCount` on `/clips/c1` by `+100` or without creating `/users/{uid}/likes/c1` -> `PERMISSION_DENIED`.
7. **Caption Hijack via Like Update**: Non-owner updates `caption` alongside `likesCount` -> `PERMISSION_DENIED` (`affectedKeys().hasOnly(['likesCount'])` fails).
8. **Client-Forged Timestamp**: `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> `PERMISSION_DENIED`.
9. **Array Overflow**: Clip `hashtags` with 25 elements -> `PERMISSION_DENIED` (`hashtags.size() <= 8`).
10. **Array Type Poisoning**: `hashtags: [12345]` -> `PERMISSION_DENIED` (`hashtags[0] is string` fails).
11. **Immutable Owner Tampering**: Owner tries to change `authorId` or `createdAt` during `update` -> `PERMISSION_DENIED`.
12. **Private Clip Scraping**: Non-owner queries `clips` with `visibility: "private"` -> `PERMISSION_DENIED` (`allow list` requires `visibility == 'public' || authorId == request.auth.uid`).
13. **Report Scraping / Cross-Read**: User attempts `get` or `list` on `/reports/{reportId}` -> `PERMISSION_DENIED` (`allow get, list: if false`).
14. **Self-Block or Spoofed Blocker**: User writes `/users/userA/blocked/userB` with `blockerId != request.auth.uid` or `targetId == userId` -> `PERMISSION_DENIED`.
15. **Unsafe Video URL Scheme**: Clip created with `videoUrl: "javascript:alert(1)"` -> `PERMISSION_DENIED` (`^https://.*` regex fails).
16. **DM Eavesdropping**: Non-participant User C reads or writes `/directThreads/uA__uB/messages/m1` -> `PERMISSION_DENIED` (Master Gate fails).
17. **Status Note Spoofing**: User B updates `/statusNotes/userA` -> `PERMISSION_DENIED` (`isOwner(userId)` fails).
