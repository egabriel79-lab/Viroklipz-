import type { ClipItem } from '../types/viroklipz';

export type DistributionStage =
  | 'initial'
  | 'expand_20'
  | 'boost_10_suggested'
  | 'fast_track_30'
  | 'explore_page'
  | 'stopped';

export interface DistributionEvaluation {
  stage: DistributionStage;
  label: string;
  followerReachPct: 0 | 20 | 40 | 50;
  showInSuggested: boolean;
  suggestedPriority: number;
  inExplorePage: boolean;
  stopped: boolean;
  engagementRate: number;
  score: number;
}

const INITIAL_EVALUATION_MIN_VIEWS = 5;
const FOLLOW_UP_MIN_VIEWS = 10;
const EXPLORE_MIN_VIEWS = 12;

/**
 * Deterministic 0..99 bucket per (viewerUid, clipId) so follower reach cohorts
 * (20% -> +20% -> +10% / +30%) remain stable across reloads.
 */
export function computeFollowerBucket(viewerUid: string, clipId: string): number {
  const input = `${viewerUid}:${clipId}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % 100;
}

/**
 * Evaluates a clip according to the Viroklipz distribution funnel:
 * 1. Publicas el klip -> 20% seguidores + Sugeridos.
 * 2. ¿No interactúan? -> Deja de mostrarlo.
 * 3. ¿Lo guardan y repiten? -> Otro 30% (50% total) + más sugeridos -> ¿Interactúan? -> Explore Page / Deja de mostrarlo.
 * 4. ¿Se visualiza y dan like? -> Otro 20% (40% total) -> ¿Interactúan? -> Otro 10% (50%) y sugeridos -> ¿Interactúan? -> Explore Page / Deja de mostrarlo.
 */
export function evaluateClipDistribution(clip: ClipItem): DistributionEvaluation {
  const views = Math.max(0, clip.viewsCount || 0);
  const likes = Math.max(0, clip.likesCount || 0);
  const saves = Math.max(0, clip.bookmarksCount || 0);
  const replays = Math.max(0, clip.replaysCount || 0);
  const shares = Math.max(0, clip.sharesCount || 0);

  const weightedEngagement = likes + saves * 2.5 + replays * 2 + shares * 2;
  const rawInteractions = likes + saves + replays + shares;
  const denominator = Math.max(1, views);
  const engagementRate = rawInteractions / denominator;
  const likesRate = likes / denominator;
  const saveAndReplaySignal =
    (saves >= 1 && replays >= 1) ||
    (saves >= 2 && saves / denominator >= 0.05) ||
    (replays >= 2 && replays / denominator >= 0.15);

  // Fase inicial: recién publicado, aún reuniendo impresiones de prueba (20% seguidores + Sugeridos)
  if (views < INITIAL_EVALUATION_MIN_VIEWS && !saveAndReplaySignal && likes < 2) {
    return {
      stage: 'initial',
      label: '20% seguidores · Sugeridos',
      followerReachPct: 20,
      showInSuggested: true,
      suggestedPriority: 3,
      inExplorePage: false,
      stopped: false,
      engagementRate,
      score: weightedEngagement + 10,
    };
  }

  // Rama derecha: ¿Lo guardan y repiten? -> Se distribuye a otro 30% (50% total) y más sugeridos
  if (saveAndReplaySignal) {
    const continuesInteracting =
      engagementRate >= 0.12 || rawInteractions >= 4 || (saves >= 1 && replays >= 2);

    if (views >= EXPLORE_MIN_VIEWS && !continuesInteracting) {
      return {
        stage: 'stopped',
        label: 'Deja de mostrarlo',
        followerReachPct: 0,
        showInSuggested: false,
        suggestedPriority: 0,
        inExplorePage: false,
        stopped: true,
        engagementRate,
        score: weightedEngagement,
      };
    }

    if ((views >= EXPLORE_MIN_VIEWS || rawInteractions >= 5) && continuesInteracting) {
      return {
        stage: 'explore_page',
        label: 'Explore Page',
        followerReachPct: 50,
        showInSuggested: true,
        suggestedPriority: 5,
        inExplorePage: true,
        stopped: false,
        engagementRate,
        score: weightedEngagement * 1.5,
      };
    }

    return {
      stage: 'fast_track_30',
      label: '+30% seguidores · Más sugeridos',
      followerReachPct: 50,
      showInSuggested: true,
      suggestedPriority: 4,
      inExplorePage: false,
      stopped: false,
      engagementRate,
      score: weightedEngagement * 1.35,
    };
  }

  // Rama izquierda: ¿Se visualiza y dan like?
  const viewedAndLiked = likes >= 1 && likesRate >= 0.08;
  if (viewedAndLiked) {
    // Etapa intermedia: Se distribuye a otro 20% de tus seguidores (40% acumulado)
    if (views < FOLLOW_UP_MIN_VIEWS && rawInteractions < 3) {
      return {
        stage: 'expand_20',
        label: '+20% seguidores (40%)',
        followerReachPct: 40,
        showInSuggested: true,
        suggestedPriority: 2,
        inExplorePage: false,
        stopped: false,
        engagementRate,
        score: weightedEngagement,
      };
    }

    // ¿Interactúan en el segundo tramo?
    const keepsInteractingStage2 = rawInteractions >= 2 && engagementRate >= 0.1;
    if (!keepsInteractingStage2 && views >= FOLLOW_UP_MIN_VIEWS) {
      return {
        stage: 'stopped',
        label: 'Deja de mostrarlo',
        followerReachPct: 0,
        showInSuggested: false,
        suggestedPriority: 0,
        inExplorePage: false,
        stopped: true,
        engagementRate,
        score: weightedEngagement,
      };
    }

    // Se muestra a otro 10% (50% acumulado) y sugeridos
    if (views < EXPLORE_MIN_VIEWS + 4 && rawInteractions < 5) {
      return {
        stage: 'boost_10_suggested',
        label: '+10% seguidores · Sugeridos',
        followerReachPct: 50,
        showInSuggested: true,
        suggestedPriority: 3.5,
        inExplorePage: false,
        stopped: false,
        engagementRate,
        score: weightedEngagement * 1.15,
      };
    }

    // ¿Interactúan tras +10% y sugeridos? -> Pasa a Explore Page o Deja de mostrarlo
    const qualifiesForExplore = rawInteractions >= 4 && engagementRate >= 0.12;
    if (qualifiesForExplore) {
      return {
        stage: 'explore_page',
        label: 'Explore Page',
        followerReachPct: 50,
        showInSuggested: true,
        suggestedPriority: 5,
        inExplorePage: true,
        stopped: false,
        engagementRate,
        score: weightedEngagement * 1.4,
      };
    }

    return {
      stage: 'stopped',
      label: 'Deja de mostrarlo',
      followerReachPct: 0,
      showInSuggested: false,
      suggestedPriority: 0,
      inExplorePage: false,
      stopped: true,
      engagementRate,
      score: weightedEngagement,
    };
  }

  // Rama central: ¿No interactúan? -> Deja de mostrarlo
  if (views >= INITIAL_EVALUATION_MIN_VIEWS && (rawInteractions === 0 || engagementRate < 0.06)) {
    return {
      stage: 'stopped',
      label: 'Deja de mostrarlo',
      followerReachPct: 0,
      showInSuggested: false,
      suggestedPriority: 0,
      inExplorePage: false,
      stopped: true,
      engagementRate,
      score: weightedEngagement,
    };
  }

  return {
    stage: 'initial',
    label: '20% seguidores · Sugeridos',
    followerReachPct: 20,
    showInSuggested: true,
    suggestedPriority: 3,
    inExplorePage: false,
    stopped: false,
    engagementRate,
    score: weightedEngagement + 5,
  };
}

export function shouldShowClipInFollowingFeed(
  clip: ClipItem,
  viewerUid?: string | null,
): boolean {
  if (viewerUid && clip.authorId === viewerUid) return true;
  const evaluation = evaluateClipDistribution(clip);
  if (evaluation.stopped || evaluation.followerReachPct === 0) {
    return false;
  }
  if (!viewerUid) {
    return evaluation.followerReachPct >= 20;
  }
  const bucket = computeFollowerBucket(viewerUid, clip.id);
  return bucket < evaluation.followerReachPct;
}

export function shouldShowClipInSuggestedFeed(clip: ClipItem): boolean {
  const evaluation = evaluateClipDistribution(clip);
  return evaluation.showInSuggested && !evaluation.stopped;
}

export function shouldShowClipInExplorePage(clip: ClipItem): boolean {
  const evaluation = evaluateClipDistribution(clip);
  return evaluation.inExplorePage && !evaluation.stopped;
}

export function sortClipsForSuggestedFeed(clips: ClipItem[]): ClipItem[] {
  return [...clips].sort((a, b) => {
    const evalA = evaluateClipDistribution(a);
    const evalB = evaluateClipDistribution(b);

    // Prioriza los recién publicados (< 6 vistas y < 24h) para darles su prueba inicial,
    // junto con los clips que escalaron a Más Sugeridos y Explore Page
    const isFreshA = !a.isStarter && a.viewsCount < INITIAL_EVALUATION_MIN_VIEWS;
    const isFreshB = !b.isStarter && b.viewsCount < INITIAL_EVALUATION_MIN_VIEWS;
    if (isFreshA !== isFreshB) return isFreshA ? -1 : 1;

    if (evalB.suggestedPriority !== evalA.suggestedPriority) {
      return evalB.suggestedPriority - evalA.suggestedPriority;
    }
    if (b.createdAtMs !== a.createdAtMs && !a.isStarter && !b.isStarter) {
      const scoreDiff = evalB.score - evalA.score;
      if (Math.abs(scoreDiff) > 5) return scoreDiff;
      return b.createdAtMs - a.createdAtMs;
    }
    return evalB.score - evalA.score || b.createdAtMs - a.createdAtMs;
  });
}

export function sortClipsForExplorePage(clips: ClipItem[]): ClipItem[] {
  return [...clips].sort((a, b) => {
    const evalA = evaluateClipDistribution(a);
    const evalB = evaluateClipDistribution(b);
    if (evalB.score !== evalA.score) return evalB.score - evalA.score;
    return b.createdAtMs - a.createdAtMs;
  });
}
