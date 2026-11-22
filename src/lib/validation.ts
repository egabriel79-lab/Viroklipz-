import type { AudioPreset, ClipCategory, ReportReason } from '../types/viroklipz';

export const ID_REGEX = /^[a-zA-Z0-9_-]+$/;
export const USERNAME_REGEX = /^[a-z0-9._]{3,24}$/;

export const MAX_ID_LEN = 128;
export const MAX_USERNAME_LEN = 24;
export const MIN_USERNAME_LEN = 3;
export const MAX_DISPLAY_NAME_LEN = 40;
export const MAX_NAME_PART_LEN = 40;
export const MAX_PHONE_LEN = 24;
export const MAX_EMAIL_LEN = 120;
export const MAX_BIO_LEN = 160;
export const MAX_AVATAR_URL_LEN = 300;
export const MAX_MEDIA_URL_LEN = 300;
export const MAX_CAPTION_LEN = 220;
export const MAX_COMMENT_LEN = 240;
export const MAX_NOTE_LEN = 60;
export const MAX_REPORT_DETAILS_LEN = 240;
export const MAX_HASHTAGS = 8;
export const MAX_HASHTAG_LEN = 32;
export const MAX_AUDIO_TITLE_LEN = 80;
export const MAX_VISUAL_PRESET_LEN = 120;

export const MAX_VIDEO_FILE_MB = 80;
export const MAX_VIDEO_FILE_BYTES = MAX_VIDEO_FILE_MB * 1024 * 1024;
export const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
] as const;

export const ALLOWED_CATEGORIES: readonly ClipCategory[] = [
  'baile',
  'musica',
  'cocina',
  'deportes',
  'arte',
  'comedia',
  'viajes',
];

export const ALLOWED_AUDIO_PRESETS: readonly AudioPreset[] = [
  'urban_beat',
  'sunset_house',
  'lofi_espresso',
  'alpine_rush',
  'analog_synth',
];

export const ALLOWED_REPORT_REASONS: readonly ReportReason[] = [
  'spam',
  'acoso',
  'contenido_inapropiado',
  'derechos_autor',
];

const PROHIBITED_TEXT_PATTERNS: readonly RegExp[] = [
  /\b(pornografia|porno|xxx|nudes?|onlyfans\.com|bet365|casino\s*gratis|phishing)\b/i,
  /\b(matate|suicidate|violacion|pedofilia|nazi)\b/i,
  /\b(estafa|tarjeta\s*clonada|dinero\s*facil\s*whatsapp)\b/i,
];

export function containsProhibitedContent(raw: string): boolean {
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return PROHIBITED_TEXT_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function validateVideoFile(file: File): { ok: true } | { ok: false; message: string } {
  const lowerName = file.name.toLowerCase();
  const hasAllowedExt =
    lowerName.endsWith('.mp4') || lowerName.endsWith('.webm') || lowerName.endsWith('.mov');
  const hasAllowedMime =
    ALLOWED_VIDEO_MIME_TYPES.includes(file.type as (typeof ALLOWED_VIDEO_MIME_TYPES)[number]);

  if (!hasAllowedMime && !hasAllowedExt) {
    return {
      ok: false,
      message: 'Formato no compatible. Usa un video .mp4, .webm o .mov.',
    };
  }
  if (file.size <= 0) {
    return {
      ok: false,
      message: 'El archivo de video está vacío.',
    };
  }
  if (file.size > MAX_VIDEO_FILE_BYTES) {
    return {
      ok: false,
      message: `El video supera el límite máximo de ${MAX_VIDEO_FILE_MB} MB.`,
    };
  }
  return { ok: true };
}

export function sanitizeUsername(raw: string, fallbackUid?: string): string {
  const cleaned = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, MAX_USERNAME_LEN);

  if (USERNAME_REGEX.test(cleaned)) {
    return cleaned;
  }

  const suffix = (fallbackUid || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 8);
  const candidate = `klip.${suffix || 'creador'}`.slice(0, MAX_USERNAME_LEN);
  return candidate.length >= MIN_USERNAME_LEN ? candidate : 'klip.creador';
}

export function sanitizeAvatarUrl(raw: string | null | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (trimmed.length > MAX_AVATAR_URL_LEN) return '';
  if (trimmed.startsWith('/src/assets/') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return '';
}

export function sanitizeMediaUrl(raw: string | null | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (trimmed.length > MAX_MEDIA_URL_LEN) return '';
  if (trimmed.startsWith('https://')) {
    return trimmed;
  }
  return '';
}

export function parseHashtags(raw: string): string[] {
  const tokens = raw
    .split(/[\s,]+/)
    .map((t) => t.trim().replace(/^#+/, '').toLowerCase())
    .map((t) =>
      t
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, MAX_HASHTAG_LEN),
    )
    .filter((t) => t.length >= 1);

  return Array.from(new Set(tokens)).slice(0, MAX_HASHTAGS);
}

export function validateClipPayload(input: {
  caption: string;
  audioTitle: string;
  category: ClipCategory;
  audioPreset: AudioPreset;
  durationSec: number;
}): { ok: true } | { ok: false; message: string } {
  const caption = input.caption.trim();
  if (caption.length < 1 || caption.length > MAX_CAPTION_LEN) {
    return {
      ok: false,
      message: `La descripción debe tener entre 1 y ${MAX_CAPTION_LEN} caracteres.`,
    };
  }
  if (containsProhibitedContent(caption)) {
    return {
      ok: false,
      message: 'La descripción contiene términos no permitidos por las normas de Viroklipz.',
    };
  }
  const audioTitle = input.audioTitle.trim();
  if (audioTitle.length < 1 || audioTitle.length > MAX_AUDIO_TITLE_LEN) {
    return {
      ok: false,
      message: `El título de audio debe tener entre 1 y ${MAX_AUDIO_TITLE_LEN} caracteres.`,
    };
  }
  if (!ALLOWED_CATEGORIES.includes(input.category)) {
    return { ok: false, message: 'Categoría no válida.' };
  }
  if (!ALLOWED_AUDIO_PRESETS.includes(input.audioPreset)) {
    return { ok: false, message: 'Pista de audio no válida.' };
  }
  if (input.durationSec < 3 || input.durationSec > 60) {
    return { ok: false, message: 'La duración debe estar entre 3 y 60 segundos.' };
  }
  return { ok: true };
}

export function validateProfilePayload(input: {
  username: string;
  displayName: string;
  bio: string;
}): { ok: true } | { ok: false; message: string } {
  const username = input.username.trim().toLowerCase();
  if (!USERNAME_REGEX.test(username)) {
    return {
      ok: false,
      message:
        'El nombre de usuario debe tener entre 3 y 24 caracteres (solo minúsculas, números, puntos o guiones bajos).',
    };
  }
  const displayName = input.displayName.trim();
  if (displayName.length < 1 || displayName.length > MAX_DISPLAY_NAME_LEN) {
    return {
      ok: false,
      message: `El nombre visible debe tener entre 1 y ${MAX_DISPLAY_NAME_LEN} caracteres.`,
    };
  }
  if (input.bio.trim().length > MAX_BIO_LEN) {
    return {
      ok: false,
      message: `La biografía no puede superar ${MAX_BIO_LEN} caracteres.`,
    };
  }
  if (containsProhibitedContent(input.bio) || containsProhibitedContent(displayName)) {
    return {
      ok: false,
      message: 'El texto incluye contenido no permitido por las normas de la comunidad.',
    };
  }
  return { ok: true };
}

export function validatePrivateInfoPayload(input: {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}): { ok: true } | { ok: false; message: string } {
  if (input.firstName.trim().length > MAX_NAME_PART_LEN) {
    return { ok: false, message: `Los nombres no pueden superar ${MAX_NAME_PART_LEN} caracteres.` };
  }
  if (input.lastName.trim().length > MAX_NAME_PART_LEN) {
    return { ok: false, message: `Los apellidos no pueden superar ${MAX_NAME_PART_LEN} caracteres.` };
  }
  if (input.phone.trim().length > MAX_PHONE_LEN) {
    return { ok: false, message: `El teléfono no puede superar ${MAX_PHONE_LEN} caracteres.` };
  }
  const email = input.email.trim();
  if (email.length > MAX_EMAIL_LEN || (email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return { ok: false, message: 'Introduce un correo electrónico válido.' };
  }
  return { ok: true };
}

export function validateCommentText(text: string): { ok: true; value: string } | { ok: false; message: string } {
  const trimmed = text.trim();
  if (trimmed.length < 1 || trimmed.length > MAX_COMMENT_LEN) {
    return {
      ok: false,
      message: `El comentario debe tener entre 1 y ${MAX_COMMENT_LEN} caracteres.`,
    };
  }
  if (containsProhibitedContent(trimmed)) {
    return {
      ok: false,
      message: 'Tu mensaje fue bloqueado por el filtro de moderación de Viroklipz.',
    };
  }
  return { ok: true, value: trimmed };
}

export function validateStatusNote(text: string): { ok: true; value: string } | { ok: false; message: string } {
  const trimmed = text.trim();
  if (trimmed.length > MAX_NOTE_LEN) {
    return {
      ok: false,
      message: `La nota no puede superar ${MAX_NOTE_LEN} caracteres.`,
    };
  }
  if (trimmed.length > 0 && containsProhibitedContent(trimmed)) {
    return {
      ok: false,
      message: 'La nota contiene términos no permitidos por las normas de Viroklipz.',
    };
  }
  return { ok: true, value: trimmed };
}

export function createSafeId(prefix: string): string {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16) || 'id';
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${cleanPrefix}_${ts}_${rand}`.slice(0, MAX_ID_LEN);
}

export function formatCompactCount(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(value);
}
