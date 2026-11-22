/**
 * Viroklipz Firestore Security Rules Adversarial Specification Vectors
 * Verifies the "Dirty Dozen" invariants documented in security_spec.md.
 */

export const DIRTY_DOZEN_VECTORS = [
  { name: 'identity-spoofing-clip-create', collection: 'clips', expected: 'PERMISSION_DENIED' },
  { name: 'shadow-field-profile-create', collection: 'users', expected: 'PERMISSION_DENIED' },
  { name: 'unverified-email-write', collection: 'clips', expected: 'PERMISSION_DENIED' },
  { name: 'pii-cross-read', collection: 'users/private', expected: 'PERMISSION_DENIED' },
  { name: 'id-poisoning', collection: 'clips', expected: 'PERMISSION_DENIED' },
  { name: 'likes-desync-attack', collection: 'clips', expected: 'PERMISSION_DENIED' },
  { name: 'caption-hijack-via-like', collection: 'clips', expected: 'PERMISSION_DENIED' },
  { name: 'client-forged-timestamp', collection: 'clips', expected: 'PERMISSION_DENIED' },
  { name: 'hashtags-array-overflow', collection: 'clips', expected: 'PERMISSION_DENIED' },
  { name: 'hashtags-type-poisoning', collection: 'clips', expected: 'PERMISSION_DENIED' },
  { name: 'immutable-owner-tampering', collection: 'clips', expected: 'PERMISSION_DENIED' },
  { name: 'private-clip-scraping', collection: 'clips', expected: 'PERMISSION_DENIED' },
  { name: 'reports-cross-read', collection: 'reports', expected: 'PERMISSION_DENIED' },
  { name: 'spoofed-block-create', collection: 'users/blocked', expected: 'PERMISSION_DENIED' },
  { name: 'unsafe-video-url-scheme', collection: 'clips', expected: 'PERMISSION_DENIED' },
  { name: 'dm-eavesdropping', collection: 'directThreads', expected: 'PERMISSION_DENIED' },
  { name: 'status-note-spoofing', collection: 'statusNotes', expected: 'PERMISSION_DENIED' },
] as const;
