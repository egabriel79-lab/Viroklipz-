import type {
  AudienceFavorite,
  FanClubPerk,
  FanLevelThreshold,
  GiftCategoryTab,
  RechargePackage,
} from '../types/viroklipz';

export type GiftIconKind =
  | 'rose'
  | 'bolt'
  | 'star'
  | 'heart'
  | 'rocket'
  | 'confetti'
  | 'leopard'
  | 'shield'
  | 'boxing'
  | 'car'
  | 'dragon'
  | 'pulse'
  | 'crown'
  | 'aurora'
  | 'spaceship'
  | 'jet'
  | 'phoenix'
  | 'pegasus';

export interface LiveGiftCatalogItem {
  id: string;
  name: string;
  coins: number;
  category: GiftCategoryTab;
  accent: string;
  iconKind: GiftIconKind;
  imageUrl?: string;
  requiredFanLevel?: number;
  interactiveEffect?: string;
}

export const GIFT_CATEGORY_TABS: readonly {
  id: GiftCategoryTab;
  label: string;
  subtitle: string;
}[] = [
  { id: 'populares', label: 'Populares', subtitle: 'Favoritos del Live' },
  { id: 'club_fans', label: 'Club de Fans', subtitle: 'Exclusivos por nivel' },
  { id: 'viroarena', label: 'ViroArena', subtitle: 'Batallas PK 1 vs 1' },
  { id: 'nivel_donador', label: 'Nivel de Donador', subtitle: 'Regalos masivos' },
];

export const FULLSCREEN_GIFT_THRESHOLD_COINS = 500;

export const LIVE_GIFTS_CATALOG: readonly LiveGiftCatalogItem[] = [
  // Populares
  {
    id: 'rosa',
    name: 'Rosa',
    coins: 10,
    category: 'populares',
    accent: 'from-[#E84393] to-[#9B5DE5]',
    iconKind: 'rose',
    imageUrl: '/src/assets/images/gift_rose_3d_1795698439241.jpg',
  },
  {
    id: 'rayo_azul',
    name: 'Rayo Azul',
    coins: 25,
    category: 'populares',
    accent: 'from-[#00B4D8] to-[#2563EB]',
    iconKind: 'bolt',
  },
  {
    id: 'estrella_magenta',
    name: 'Estrella Magenta',
    coins: 50,
    category: 'populares',
    accent: 'from-[#E84393] to-[#6C5CE7]',
    iconKind: 'star',
  },
  {
    id: 'corazon',
    name: 'Corazón',
    coins: 100,
    category: 'populares',
    accent: 'from-[#6C5CE7] to-[#E84393]',
    iconKind: 'heart',
    imageUrl: '/src/assets/images/gift_heart_3d_1795698440834.jpg',
  },
  {
    id: 'cohete',
    name: 'Cohete Viroklipz',
    coins: 250,
    category: 'populares',
    accent: 'from-[#00B4D8] via-[#6C5CE7] to-[#E84393]',
    iconKind: 'rocket',
  },
  {
    id: 'confeti',
    name: 'Confeti',
    coins: 550,
    category: 'populares',
    accent: 'from-[#E84393] via-[#8B5CF6] to-[#00B4D8]',
    iconKind: 'confetti',
    interactiveEffect: 'Explosión de confeti neón en pantalla completa',
  },

  // Club de Fans (con bloqueo por nivel)
  {
    id: 'pulso_neon',
    name: 'Pulso Neón',
    coins: 150,
    category: 'club_fans',
    accent: 'from-[#00B4D8] to-[#6C5CE7]',
    iconKind: 'pulse',
    requiredFanLevel: 3,
    interactiveEffect: 'Destello eléctrico exclusivo del Club',
  },
  {
    id: 'insignia_estelar',
    name: 'Insignia Estelar',
    coins: 350,
    category: 'club_fans',
    accent: 'from-[#6C5CE7] to-[#00B4D8]',
    iconKind: 'star',
    requiredFanLevel: 5,
    interactiveEffect: 'Emblema brillante del Club de Fans',
  },
  {
    id: 'corona_vip',
    name: 'Corona VIP',
    coins: 600,
    category: 'club_fans',
    accent: 'from-[#E84393] to-[#6C5CE7]',
    iconKind: 'crown',
    requiredFanLevel: 10,
    interactiveEffect: 'Corona luminosa a pantalla completa',
  },
  {
    id: 'aurora_magenta',
    name: 'Aurora Magenta',
    coins: 1200,
    category: 'club_fans',
    accent: 'from-[#E84393] via-[#9B5DE5] to-[#00B4D8]',
    iconKind: 'aurora',
    requiredFanLevel: 15,
    interactiveEffect: 'Cascada de energía Magenta y Azul Eléctrico',
  },

  // ViroArena (Batallas PK)
  {
    id: 'leopardo',
    name: 'Leopardo',
    coins: 99,
    category: 'viroarena',
    accent: 'from-[#6C5CE7] to-[#00B4D8]',
    iconKind: 'leopard',
    imageUrl: '/src/assets/images/gift_leopard_3d_1795698440774.jpg',
  },
  {
    id: 'escudo_morado',
    name: 'Escudo Morado',
    coins: 300,
    category: 'viroarena',
    accent: 'from-[#6C5CE7] to-[#4C1D95]',
    iconKind: 'shield',
  },
  {
    id: 'guante_boxeo',
    name: 'Guante de Boxeo',
    coins: 750,
    category: 'viroarena',
    accent: 'from-[#E84393] to-[#00B4D8]',
    iconKind: 'boxing',
    imageUrl: '/src/assets/images/gift_boxing_glove_3d_1795699569285.jpg',
    interactiveEffect: 'Impacto PK con ondas eléctricas a pantalla completa',
  },
  {
    id: 'coche',
    name: 'Coche',
    coins: 7000,
    category: 'viroarena',
    accent: 'from-[#00B4D8] via-[#6C5CE7] to-[#E84393]',
    iconKind: 'car',
    imageUrl: '/src/assets/images/gift_supercar_3d_1795698441817.jpg',
    interactiveEffect: 'Entrada supersónica en la arena PK',
  },

  // Nivel de Donador (Regalos Masivos + nivel requerido)
  {
    id: 'nave_espacial',
    name: 'Nave Espacial',
    coins: 1500,
    category: 'nivel_donador',
    accent: 'from-[#00B4D8] via-[#6C5CE7] to-[#E84393]',
    iconKind: 'spaceship',
    imageUrl: '/src/assets/images/gift_spaceship_3d_1795699562082.jpg',
    requiredFanLevel: 5,
    interactiveEffect: 'Despegue orbital Viroklipz a pantalla completa',
  },
  {
    id: 'jet',
    name: 'Jet',
    coins: 4888,
    category: 'nivel_donador',
    accent: 'from-[#00B4D8] to-[#1D4ED8]',
    iconKind: 'jet',
    imageUrl: '/src/assets/images/gift_jet_3d_1795699563338.jpg',
    requiredFanLevel: 10,
    interactiveEffect: 'Vuelo supersónico sobre el Live',
  },
  {
    id: 'dragon',
    name: 'Dragón',
    coins: 15000,
    category: 'nivel_donador',
    accent: 'from-[#E84393] via-[#6C5CE7] to-[#00B4D8]',
    iconKind: 'dragon',
    imageUrl: '/src/assets/images/gift_dragon_3d_1795698442942.jpg',
    requiredFanLevel: 15,
    interactiveEffect: 'Rugido prismático de Dragón',
  },
  {
    id: 'fenix',
    name: 'Fénix',
    coins: 41999,
    category: 'nivel_donador',
    accent: 'from-[#E84393] via-[#9B5DE5] to-[#00B4D8]',
    iconKind: 'phoenix',
    imageUrl: '/src/assets/images/gift_phoenix_3d_1795699564287.jpg',
    requiredFanLevel: 20,
    interactiveEffect: 'Renacimiento del Fénix a pantalla completa',
  },
  {
    id: 'pegaso',
    name: 'Pegaso',
    coins: 42999,
    category: 'nivel_donador',
    accent: 'from-[#00B4D8] via-[#6C5CE7] to-[#E84393]',
    iconKind: 'pegasus',
    imageUrl: '/src/assets/images/gift_pegasus_3d_1795699564266.jpg',
    requiredFanLevel: 30,
    interactiveEffect: 'Vuelo legendario de Pegaso a pantalla completa',
  },
];

export const RECHARGE_PACKAGES: readonly RechargePackage[] = [
  {
    id: 'pack_starter',
    baseCoins: 5,
    bonusCoins: 37,
    totalCoins: 42,
    priceUsd: 0.08,
    priceLabel: 'USD 0.08',
    badge: 'Más popular',
  },
  {
    id: 'pack_plus',
    baseCoins: 70,
    bonusCoins: 47,
    totalCoins: 117,
    priceUsd: 1.0,
    priceLabel: 'USD 1.00',
  },
  {
    id: 'pack_pro',
    baseCoins: 350,
    bonusCoins: 60,
    totalCoins: 410,
    priceUsd: 5.0,
    priceLabel: 'USD 5.00',
  },
  {
    id: 'pack_vip',
    baseCoins: 1400,
    bonusCoins: 235,
    totalCoins: 1635,
    priceUsd: 20.0,
    priceLabel: 'USD 20.00',
    badge: 'Mejor valor',
  },
];

export const WELCOME_BONUS_ROSES = 3;

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
