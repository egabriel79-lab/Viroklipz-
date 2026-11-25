import type { AudienceFavorite, FanClubPerk, FanLevelThreshold } from '../types/viroklipz';

export interface LiveGiftCatalogItem {
  id: string;
  name: string;
  coins: number;
  accent: string;
}

export const LIVE_GIFTS_CATALOG: readonly LiveGiftCatalogItem[] = [
  {
    id: 'rosa',
    name: 'Rosa',
    coins: 10,
    accent: 'from-[#E84393] to-[#9B5DE5]',
  },
  {
    id: 'rayo_azul',
    name: 'Rayo Azul',
    coins: 25,
    accent: 'from-[#00B4D8] to-[#2563EB]',
  },
  {
    id: 'estrella_magenta',
    name: 'Estrella Magenta',
    coins: 50,
    accent: 'from-[#E84393] to-[#6C5CE7]',
  },
  {
    id: 'corazon',
    name: 'Corazón',
    coins: 100,
    accent: 'from-[#6C5CE7] to-[#E84393]',
  },
  {
    id: 'cohete',
    name: 'Cohete Viroklipz',
    coins: 250,
    accent: 'from-[#00B4D8] via-[#6C5CE7] to-[#E84393]',
  },
];

export const DEFAULT_FAN_PERKS: FanClubPerk[] = [
  { id: 'perk_badge', title: 'Insignia brillante en el chat del Live', minLevel: 1 },
  { id: 'perk_mod', title: 'Moderador de Live', minLevel: 10 },
  { id: 'perk_emotes', title: 'Emoticonos personalizados', minLevel: 20 },
];

export const DEFAULT_AUDIENCE_FAVORITES: AudienceFavorite[] = [
  {
    id: 'fav_saludo',
    action: 'Saludar en voz alta',
    giftId: 'rosa',
    giftName: 'Rosa',
    coins: 10,
  },
  {
    id: 'fav_corazon',
    action: 'Hacer un gesto de corazón',
    giftId: 'corazon',
    giftName: 'Corazón',
    coins: 100,
  },
];

export function normalizeFanLevelThreshold(val: unknown): FanLevelThreshold {
  const n = Number(val);
  if (n === 10 || n === 20 || n === 30 || n === 40 || n === 50) return n;
  return 1;
}

export function resolveFanLevel(
  storedLevel?: number,
  fanPoints?: number,
  streakDays?: number,
): number {
  if (typeof storedLevel === 'number' && Number.isFinite(storedLevel) && storedLevel >= 1) {
    return Math.min(50, Math.max(1, Math.floor(storedLevel)));
  }
  const baseFromPoints =
    typeof fanPoints === 'number' && Number.isFinite(fanPoints)
      ? Math.floor(fanPoints / 50)
      : 0;
  const baseFromStreak =
    typeof streakDays === 'number' && Number.isFinite(streakDays)
      ? Math.floor(streakDays)
      : 0;
  return Math.min(50, Math.max(1, 1 + baseFromPoints + baseFromStreak));
}

export const DEFAULT_FAN_CLUB_NAME = 'Club de Fans Viroklipz';
export const DEFAULT_FAN_POINTS_PER_COIN = 1;

export const DEFAULT_VIP_ALERT_CONFIG = {
  vipAlertEnabled: true,
  vipAlertTitle: 'Favorito del Público',
  vipAlertStyle: 'crystal_magenta' as const,
  vipAlertDurationSec: 5,
  vipAlertSound: true,
};

export const VIP_ALERT_STYLES = [
  {
    id: 'crystal_magenta' as const,
    label: 'Cristal Magenta',
    description: 'Borde de cristal oscuro con destello Magenta y Azul Eléctrico.',
    wrapperGradient: 'from-[#00B4D8] via-[#E84393] to-[#00B4D8]',
    glowShadow: 'shadow-[0_0_50px_rgba(232,67,147,0.65),0_0_28px_rgba(0,180,216,0.5)]',
  },
  {
    id: 'electric_pulse' as const,
    label: 'Pulso Eléctrico',
    description: 'Resplandor Azul Eléctrico de alto contraste para alertas rápidas.',
    wrapperGradient: 'from-[#00B4D8] via-[#38BDF8] to-[#2563EB]',
    glowShadow: 'shadow-[0_0_50px_rgba(0,180,216,0.75),0_0_28px_rgba(37,99,235,0.5)]',
  },
  {
    id: 'aurora_vip' as const,
    label: 'Aurora VIP',
    description: 'Degradado completo Azul Eléctrico, Morado y Magenta.',
    wrapperGradient: 'from-[#00B4D8] via-[#6C5CE7] to-[#E84393]',
    glowShadow: 'shadow-[0_0_50px_rgba(108,92,231,0.65),0_0_28px_rgba(232,67,147,0.5)]',
  },
];

export function getFanLevelProgress(
  storedLevel?: number,
  fanPoints?: number,
): {
  level: number;
  currentXp: number;
  xpInLevel: number;
  xpForNextLevel: number;
  percent: number;
} {
  const safeXp = Math.max(0, Math.floor(fanPoints || 0));
  const level = resolveFanLevel(storedLevel, safeXp);
  const xpInLevel = safeXp % 50;
  const xpForNextLevel = 50;
  const percent = level >= 50 ? 100 : Math.min(100, Math.round((xpInLevel / xpForNextLevel) * 100));
  return {
    level,
    currentXp: safeXp,
    xpInLevel,
    xpForNextLevel,
    percent,
  };
}

