import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Ban,
  BarChart3,
  Bookmark,
  Camera,
  Check,
  Edit3,
  Eye,
  FileText,
  Flame,
  Flag,
  Grid3X3,
  Heart,
  Lock,
  LogOut,
  Menu,
  Pencil,
  Play,
  Plus,
  Trash2,
  User,
  UserPlus,
  Users,
  Video,
  X,
} from 'lucide-react';
import {
  formatCompactCount,
  MAX_BIO_LEN,
  MAX_DISPLAY_NAME_LEN,
  MAX_EMAIL_LEN,
  MAX_NAME_PART_LEN,
  MAX_PHONE_LEN,
  MAX_USERNAME_LEN,
  validatePrivateInfoPayload,
  validateProfilePayload,
} from '../lib/validation';
import type {
  BlockedUserEntry,
  ClipItem,
  CreatorSummary,
  UserPrivateInfo,
  UserProfile,
  UserStreak,
} from '../types/viroklipz';
import { AvatarImg } from './AvatarImg';
import { LegalModal } from './LegalModal';

interface ProfileViewProps {
  currentUser: UserProfile | null;
  privateInfo: UserPrivateInfo | null;
  viewedCreator: CreatorSummary | null;
  streak: UserStreak | null;
  allClips: ClipItem[];
  likedIds: Set<string>;
  bookmarkedIds: Set<string>;
  followingIds: Set<string>;
  creatorsDirectory: CreatorSummary[];
  onSignIn: () => void;
  onSignOut: () => void;
  onUpdateProfile: (updates: {
    username: string;
    displayName: string;
    bio: string;
  }) => Promise<void>;
  onUpdatePrivateInfo: (updates: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
  }) => Promise<void>;
  onUpdateAvatar: (file: File) => Promise<void>;
  onSelectClip: (clipId: string) => void;
  onDeleteClip: (clipId: string) => Promise<void>;
  onToggleFollow: (targetId: string, targetUsername: string) => void;
  onOpenCreate: () => void;
  onBackToOwnProfile: () => void;
  blockedUsers?: BlockedUserEntry[];
  onUnblockUser?: (targetId: string) => Promise<void>;
  onReportCreator?: (creator: CreatorSummary) => void;
}

type DrawerSection = 'menu' | 'perfil' | 'studio' | 'descripcion' | 'bloqueados';

export function ProfileView({
  currentUser,
  privateInfo,
  viewedCreator,
  streak,
  allClips,
  likedIds,
  bookmarkedIds,
  followingIds,
  creatorsDirectory,
  onSignIn,
  onSignOut,
  onUpdateProfile,
  onUpdatePrivateInfo,
  onUpdateAvatar,
  onSelectClip,
  onDeleteClip,
  onToggleFollow,
  onOpenCreate,
  onBackToOwnProfile,
  blockedUsers = [],
  onUnblockUser,
  onReportCreator,
}: ProfileViewProps) {
  const [tab, setTab] = useState<'klips' | 'private' | 'saved' | 'likes' | 'following'>('klips');

  // Hamburger drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerSection, setDrawerSection] = useState<DrawerSection>('menu');
  const [legalOpen, setLegalOpen] = useState(false);

  // Public profile / descripción form
  const [usernameDraft, setUsernameDraft] = useState('');
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [bioDraft, setBioDraft] = useState('');
  const [savingBio, setSavingBio] = useState(false);
  const [bioError, setBioError] = useState<string | null>(null);
  const [bioSavedNotice, setBioSavedNotice] = useState(false);

  // Private PII form (Nombres, Apellidos, Teléfono, Correo electrónico)
  const [firstNameDraft, setFirstNameDraft] = useState('');
  const [lastNameDraft, setLastNameDraft] = useState('');
  const [phoneDraft, setPhoneDraft] = useState('');
  const [emailDraft, setEmailDraft] = useState('');
  const [savingPrivate, setSavingPrivate] = useState(false);
  const [privateError, setPrivateError] = useState<string | null>(null);
  const [privateSavedNotice, setPrivateSavedNotice] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarSavedNotice, setAvatarSavedNotice] = useState(false);

  const isViewingExternalCreator = Boolean(
    viewedCreator && (!currentUser || viewedCreator.uid !== currentUser.uid),
  );

  useEffect(() => {
    if (!currentUser) return;
    setUsernameDraft(currentUser.username);
    setDisplayNameDraft(currentUser.displayName);
    setBioDraft(currentUser.bio);
  }, [currentUser]);

  useEffect(() => {
    if (!privateInfo) return;
    setFirstNameDraft(privateInfo.firstName);
    setLastNameDraft(privateInfo.lastName);
    setPhoneDraft(privateInfo.phone);
    setEmailDraft(privateInfo.email);
  }, [privateInfo]);

  const openDrawerAt = (target: DrawerSection) => {
    setBioError(null);
    setPrivateError(null);
    setBioSavedNotice(false);
    setPrivateSavedNotice(false);
    if (currentUser) {
      setUsernameDraft(currentUser.username);
      setDisplayNameDraft(currentUser.displayName);
      setBioDraft(currentUser.bio);
    }
    if (privateInfo) {
      setFirstNameDraft(privateInfo.firstName);
      setLastNameDraft(privateInfo.lastName);
      setPhoneDraft(privateInfo.phone);
      setEmailDraft(privateInfo.email);
    }
    setDrawerSection(target);
    setDrawerOpen(true);
  };

  if (!isViewingExternalCreator && !currentUser) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 py-16 pb-28 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-[#121216] border border-white/10 flex items-center justify-center mx-auto">
          <Video className="w-8 h-8 text-[#FF3B5C]" />
        </div>
        <div className="space-y-2">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
            Tu estudio en Viroklipz
          </h1>
          <p className="text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
            Inicia sesión con Google para configurar tu perfil, acceder a Viroklipz Studio, ver tus métricas y publicar klips.
          </p>
        </div>
        <button
          type="button"
          onClick={onSignIn}
          className="min-h-[44px] px-6 py-3 rounded-xl bg-[#FF3B5C] hover:bg-[#ff264b] text-white text-sm font-semibold transition-colors cursor-pointer"
        >
          Continuar con Google
        </button>
      </div>
    );
  }

  const profileData = isViewingExternalCreator && viewedCreator
    ? {
        uid: viewedCreator.uid,
        username: viewedCreator.username,
        displayName: viewedCreator.displayName,
        bio: viewedCreator.bio,
        avatarUrl: viewedCreator.avatarUrl,
        followersLabel: viewedCreator.followersLabel,
      }
    : {
        uid: currentUser!.uid,
        username: currentUser!.username,
        displayName: currentUser!.displayName,
        bio: currentUser!.bio || 'Sin descripción todavía. Toca "Editar descripción" para contar sobre ti.',
        avatarUrl: currentUser!.avatarUrl,
        followersLabel: null,
      };

  const createdClips = allClips.filter((c) => c.authorId === profileData.uid);
  const publicCreatedClips = createdClips.filter((c) => c.visibility === 'public');
  const privateCreatedClips = createdClips.filter((c) => c.visibility === 'private');
  const likedClips = allClips.filter((c) => likedIds.has(c.id));
  const savedClips = allClips.filter((c) => bookmarkedIds.has(c.id));
  const followedCreators = creatorsDirectory.filter((cr) => followingIds.has(cr.uid));

  // Viroklipz Studio aggregate metrics for the current user's clips
  const totalViews = createdClips.reduce((acc, c) => acc + (c.viewsCount || 0), 0);
  const totalLikes = createdClips.reduce((acc, c) => acc + (c.likesCount || 0), 0);
  const totalSaves = createdClips.reduce((acc, c) => acc + (c.bookmarksCount || 0), 0);

  const handleSaveDescription = async (e: FormEvent) => {
    e.preventDefault();
    const check = validateProfilePayload({
      username: usernameDraft,
      displayName: displayNameDraft,
      bio: bioDraft,
    });
    if (!check.ok) {
      setBioError(check.message);
      return;
    }
    setSavingBio(true);
    setBioError(null);
    setBioSavedNotice(false);
    try {
      await onUpdateProfile({
        username: usernameDraft.trim().toLowerCase(),
        displayName: displayNameDraft.trim(),
        bio: bioDraft.trim(),
      });
      setBioSavedNotice(true);
    } catch {
      setBioError('No pudimos guardar tu descripción.');
    } finally {
      setSavingBio(false);
    }
  };

  const handleSavePrivate = async (e: FormEvent) => {
    e.preventDefault();
    const check = validatePrivateInfoPayload({
      firstName: firstNameDraft,
      lastName: lastNameDraft,
      phone: phoneDraft,
      email: emailDraft,
    });
    if (!check.ok) {
      setPrivateError(check.message);
      return;
    }
    setSavingPrivate(true);
    setPrivateError(null);
    setPrivateSavedNotice(false);
    try {
      await onUpdatePrivateInfo({
        firstName: firstNameDraft.trim(),
        lastName: lastNameDraft.trim(),
        phone: phoneDraft.trim(),
        email: emailDraft.trim(),
      });
      setPrivateSavedNotice(true);
    } catch {
      setPrivateError('No pudimos guardar tus datos personales.');
    } finally {
      setSavingPrivate(false);
    }
  };

  const handleAvatarFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPrivateError('Selecciona una imagen válida desde tu galería.');
      return;
    }
    setPrivateError(null);
    setAvatarSavedNotice(false);
    setUploadingAvatar(true);
    try {
      await onUpdateAvatar(file);
      setAvatarSavedNotice(true);
    } catch {
      setPrivateError('No se pudo actualizar tu foto de perfil.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const activeClipsGrid =
    tab === 'klips'
      ? publicCreatedClips
      : tab === 'private'
        ? privateCreatedClips
        : tab === 'likes'
          ? likedClips
          : savedClips;

  const isFollowingExternal = isViewingExternalCreator
    ? followingIds.has(profileData.uid)
    : false;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-24 lg:pb-10 space-y-5">
      {/* Top Profile Action Bar with Hamburger Menu */}
      <div className="flex items-center justify-between gap-4">
        {isViewingExternalCreator && currentUser ? (
          <button
            type="button"
            onClick={onBackToOwnProfile}
            className="min-h-[44px] px-2 text-xs font-semibold text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            ← Volver a mi perfil
          </button>
        ) : (
          <button
            type="button"
            onClick={() => openDrawerAt('descripcion')}
            aria-label="Editar descripción"
            className="min-h-[44px] min-w-[44px] rounded-xl border border-white/10 bg-[#121216] hover:bg-white/5 flex items-center justify-center text-zinc-200 transition-colors cursor-pointer"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center gap-2">
          {!isViewingExternalCreator && (
            <button
              type="button"
              onClick={() => openDrawerAt('menu')}
              aria-label="Abrir menú de perfil"
              className="min-h-[44px] min-w-[44px] rounded-xl border border-white/10 bg-[#121216] hover:bg-white/5 flex items-center justify-center text-white transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Cover Banner */}
      <div className="relative h-28 sm:h-36 rounded-2xl bg-[#121216] border border-white/10 overflow-hidden flex items-center justify-center">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#FF3B5C]/15 via-[#121216] to-zinc-900"
        />
        <div className="relative flex items-center gap-3 px-4">
          <div className="w-11 h-11 rounded-xl bg-[#09090B] border border-white/15 flex items-center justify-center">
            <Play className="w-5 h-5 text-[#FF3B5C] fill-[#FF3B5C] translate-x-0.5" />
          </div>
          <span className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Viro<span className="text-[#FF3B5C]">klipz</span>
          </span>
        </div>
      </div>

      {/* Profile Identity Section */}
      <section className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white truncate">
              {profileData.displayName}
            </h1>
            <p className="font-mono text-xs text-zinc-400">@{profileData.username}</p>

            {/* Stats Row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-2.5 text-xs text-zinc-400">
              {profileData.followersLabel ? (
                <span>
                  <strong className="font-mono text-sm tabular-nums text-white block sm:inline sm:mr-1">
                    {profileData.followersLabel}
                  </strong>
                  Seguidores
                </span>
              ) : (
                <span>
                  <strong className="font-mono text-sm tabular-nums text-white block sm:inline sm:mr-1">
                    {followingIds.size}
                  </strong>
                  Siguiendo
                </span>
              )}
              <span>
                <strong className="font-mono text-sm tabular-nums text-white block sm:inline sm:mr-1">
                  {createdClips.length}
                </strong>
                Klips
              </span>
              <span>
                <strong className="font-mono text-sm tabular-nums text-white block sm:inline sm:mr-1">
                  {formatCompactCount(totalLikes)}
                </strong>
                Me gusta
              </span>
              {!isViewingExternalCreator && (
                <span className="inline-flex items-center gap-1 text-zinc-300">
                  <Flame className="w-3.5 h-3.5 text-[#FF3B5C]" />
                  <strong className="font-mono text-sm tabular-nums text-white">
                    {streak?.currentStreak ?? 0}
                  </strong>
                  <span>días</span>
                </span>
              )}
            </div>
          </div>

          {isViewingExternalCreator ? (
            <AvatarImg
              src={profileData.avatarUrl}
              alt={profileData.displayName}
              fallbackText={profileData.displayName}
              sizeClass="w-20 h-20 sm:w-24 sm:h-24"
            />
          ) : (
            <button
              type="button"
              onClick={() => openDrawerAt('perfil')}
              aria-label="Abrir perfil personal"
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3B5C] cursor-pointer hover:opacity-90 transition-opacity shrink-0"
            >
              <AvatarImg
                src={profileData.avatarUrl}
                alt={profileData.displayName}
                fallbackText={profileData.displayName}
                sizeClass="w-20 h-20 sm:w-24 sm:h-24"
              />
            </button>
          )}
        </div>

        {/* Bio / Descripción */}
        <p className="text-sm text-zinc-200 max-w-xl leading-relaxed">
          {profileData.bio}
        </p>

        {/* Action Buttons Row (Viroklipz Studio + Editar descripción) */}
        {isViewingExternalCreator ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onToggleFollow(profileData.uid, profileData.username)}
              className={`min-h-[44px] px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                isFollowingExternal
                  ? 'bg-zinc-800 text-white hover:bg-zinc-700'
                  : 'bg-[#FF3B5C] hover:bg-[#ff264b] text-white'
              }`}
            >
              {isFollowingExternal ? (
                <>
                  <Check className="w-4 h-4" />
                  Siguiendo
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Seguir
                </>
              )}
            </button>
            {viewedCreator && onReportCreator && (
              <button
                type="button"
                onClick={() => onReportCreator(viewedCreator)}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#121216] hover:bg-white/5 border border-white/15 text-zinc-300 hover:text-[#FF3B5C] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Flag className="w-4 h-4" />
                Reportar / Bloquear
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => openDrawerAt('studio')}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#121216] hover:bg-white/5 border border-white/15 text-white text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <BarChart3 className="w-4 h-4 text-[#FF3B5C]" />
              Viroklipz Studio
            </button>
            <button
              type="button"
              onClick={() => openDrawerAt('descripcion')}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#121216] hover:bg-white/5 border border-white/15 text-zinc-200 text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Edit3 className="w-4 h-4 text-zinc-400" />
              Editar descripción
            </button>
            <button
              type="button"
              onClick={onOpenCreate}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FF3B5C] hover:bg-[#ff264b] text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Nuevo klip
            </button>
          </div>
        )}
      </section>

      {/* Profile Content Tabs */}
      <div className="flex items-center gap-1.5 border-b border-white/10 pb-2.5 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setTab('klips')}
          className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
            tab === 'klips' ? 'bg-white text-zinc-950' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Grid3X3 className="w-3.5 h-3.5" />
          Klips ({publicCreatedClips.length})
        </button>

        {!isViewingExternalCreator && (
          <>
            <button
              type="button"
              onClick={() => setTab('private')}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                tab === 'private' ? 'bg-white text-zinc-950' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              Privados ({privateCreatedClips.length})
            </button>

            <button
              type="button"
              onClick={() => setTab('saved')}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                tab === 'saved' ? 'bg-white text-zinc-950' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              Guardados ({savedClips.length})
            </button>

            <button
              type="button"
              onClick={() => setTab('likes')}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                tab === 'likes' ? 'bg-white text-zinc-950' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              Me gusta ({likedClips.length})
            </button>

            <button
              type="button"
              onClick={() => setTab('following')}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                tab === 'following' ? 'bg-white text-zinc-950' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Siguiendo ({followingIds.size})
            </button>
          </>
        )}
      </div>

      {/* Tab Content */}
      {!isViewingExternalCreator && tab === 'following' ? (
        followedCreators.length === 0 ? (
          <div className="py-14 text-center bg-[#121216] border border-white/10 rounded-2xl space-y-2">
            <p className="text-sm font-medium text-zinc-200">Aún no sigues a ningún creador</p>
            <p className="text-xs text-zinc-500">
              Pulsa el botón + en cualquier klip del feed para seguir a su creador.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {followedCreators.map((creator) => (
              <div
                key={creator.uid}
                className="bg-[#121216] border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <AvatarImg
                    src={creator.avatarUrl}
                    alt={creator.displayName}
                    fallbackText={creator.displayName}
                    sizeClass="w-11 h-11"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {creator.displayName}
                    </p>
                    <p className="font-mono text-xs text-zinc-400 truncate">
                      @{creator.username}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleFollow(creator.uid, creator.username)}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Siguiendo
                </button>
              </div>
            ))}
          </div>
        )
      ) : activeClipsGrid.length === 0 ? (
        <div className="py-14 text-center bg-[#121216] border border-white/10 rounded-2xl space-y-3">
          <p className="text-sm font-medium text-zinc-200">
            {tab === 'klips'
              ? 'Todavía no has publicado klips públicos'
              : tab === 'private'
                ? 'No tienes klips privados'
                : tab === 'likes'
                  ? 'Aún no tienes klips con me gusta'
                  : 'Todavía no has guardado ningún klip'}
          </p>
          {(tab === 'klips' || tab === 'private') && !isViewingExternalCreator && (
            <button
              type="button"
              onClick={onOpenCreate}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#FF3B5C] hover:bg-[#ff264b] text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Crear klip
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {activeClipsGrid.map((clip) => (
            <div
              key={clip.id}
              className="group relative bg-[#121216] border border-white/10 rounded-2xl overflow-hidden"
            >
              <button
                type="button"
                onClick={() => onSelectClip(clip.id)}
                className="w-full text-left block cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3B5C]"
              >
                <div className="relative aspect-[9/14] bg-zinc-900 overflow-hidden">
                  {clip.visualPreset ? (
                    <img
                      src={clip.visualPreset}
                      alt={clip.caption}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-950" />
                  )}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"
                  />
                  <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-xs text-white">
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                      <Eye className="w-3.5 h-3.5 text-zinc-200" />
                      {formatCompactCount(clip.viewsCount || 0)}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                      <Heart className="w-3.5 h-3.5 text-[#FF3B5C]" />
                      {formatCompactCount(clip.likesCount)}
                    </span>
                  </div>
                </div>
              </button>

              {!isViewingExternalCreator &&
                (tab === 'klips' || tab === 'private') &&
                clip.authorId === currentUser?.uid && (
                  <button
                    type="button"
                    onClick={() => void onDeleteClip(clip.id)}
                    aria-label="Eliminar klip"
                    className="absolute top-2.5 right-2.5 w-9 h-9 rounded-full bg-black/60 hover:bg-[#FF3B5C] text-white flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
            </div>
          ))}
        </div>
      )}

      {/* Hamburger Menu Drawer (Perfil PII, Viroklipz Studio, Editar descripción) */}
      {drawerOpen && !isViewingExternalCreator && currentUser && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
          <div
            className="flex-1"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside
            aria-label="Menú de perfil y Viroklipz Studio"
            className="w-full max-w-md h-full bg-[#121216] border-l border-white/10 flex flex-col overflow-hidden"
          >
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {drawerSection !== 'menu' && (
                  <button
                    type="button"
                    onClick={() => setDrawerSection('menu')}
                    className="min-h-[40px] px-2.5 rounded-lg hover:bg-white/5 text-xs font-semibold text-zinc-300 hover:text-white cursor-pointer"
                  >
                    ← Menú
                  </button>
                )}
                <h2 className="font-display text-lg font-bold text-white truncate">
                  {drawerSection === 'menu'
                    ? 'Cuenta y Studio'
                    : drawerSection === 'perfil'
                      ? 'Perfil personal'
                      : drawerSection === 'studio'
                        ? 'Viroklipz Studio'
                        : drawerSection === 'bloqueados'
                          ? 'Cuentas bloqueadas'
                          : 'Editar descripción'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Cerrar menú"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {drawerSection === 'menu' && (
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => setDrawerSection('perfil')}
                    className="w-full min-h-[60px] p-4 rounded-2xl bg-[#18181D] hover:bg-white/[0.06] border border-white/10 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <User className="w-5 h-5 text-[#FF3B5C] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">Perfil</p>
                        <p className="text-xs text-zinc-400 truncate">
                          Nombres, apellidos, teléfono y correo electrónico
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-zinc-500">→</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDrawerSection('studio')}
                    className="w-full min-h-[60px] p-4 rounded-2xl bg-[#18181D] hover:bg-white/[0.06] border border-white/10 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <BarChart3 className="w-5 h-5 text-[#FF3B5C] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">Viroklipz Studio</p>
                        <p className="text-xs text-zinc-400 truncate">
                          Visualizaciones, me gusta, guardados y descripción
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-zinc-500">→</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDrawerSection('descripcion')}
                    className="w-full min-h-[60px] p-4 rounded-2xl bg-[#18181D] hover:bg-white/[0.06] border border-white/10 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Edit3 className="w-5 h-5 text-zinc-300 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">Editar descripción</p>
                        <p className="text-xs text-zinc-400 truncate">
                          Nombre visible, @usuario y biografía del perfil
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-zinc-500">→</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDrawerSection('bloqueados')}
                    className="w-full min-h-[60px] p-4 rounded-2xl bg-[#18181D] hover:bg-white/[0.06] border border-white/10 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Ban className="w-5 h-5 text-zinc-300 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">Cuentas bloqueadas</p>
                        <p className="text-xs text-zinc-400 truncate">
                          {blockedUsers.length} {blockedUsers.length === 1 ? 'cuenta bloqueada' : 'cuentas bloqueadas'}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-zinc-500">→</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLegalOpen(true)}
                    className="w-full min-h-[60px] p-4 rounded-2xl bg-[#18181D] hover:bg-white/[0.06] border border-white/10 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-5 h-5 text-zinc-300 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">Términos y Privacidad</p>
                        <p className="text-xs text-zinc-400 truncate">
                          Uso de datos, cookies y derechos de autor
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-zinc-500">→</span>
                  </button>

                  <div className="pt-4 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        setDrawerOpen(false);
                        onSignOut();
                      }}
                      className="w-full min-h-[44px] px-4 rounded-xl border border-white/10 hover:bg-white/5 text-zinc-300 hover:text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              )}

              {drawerSection === 'bloqueados' && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    No verás klips, comentarios ni mensajes de las cuentas que bloquees.
                  </p>
                  {blockedUsers.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-[#18181D] border border-white/10 text-center text-xs text-zinc-400">
                      No tienes cuentas bloqueadas.
                    </div>
                  ) : (
                    <div className="divide-y divide-white/10 bg-[#18181D] border border-white/10 rounded-2xl overflow-hidden">
                      {blockedUsers.map((entry) => (
                        <div
                          key={entry.targetId}
                          className="px-4 py-3 flex items-center justify-between gap-3"
                        >
                          <span className="font-mono text-xs text-white truncate">
                            @{entry.targetUsername}
                          </span>
                          {onUnblockUser && (
                            <button
                              type="button"
                              onClick={() => void onUnblockUser(entry.targetId)}
                              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white cursor-pointer"
                            >
                              Desbloquear
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {drawerSection === 'perfil' && (
                <form onSubmit={handleSavePrivate} className="space-y-4">
                  {/* Profile Avatar Uploader (opens phone/tablet/laptop/PC gallery) */}
                  <div className="flex flex-col items-center gap-2.5 pb-2">
                    <label
                      htmlFor="profile-avatar-picker"
                      className="relative group cursor-pointer rounded-full focus-within:ring-2 focus-within:ring-[#FF3B5C]"
                    >
                      <AvatarImg
                        src={currentUser.avatarUrl}
                        alt={currentUser.displayName}
                        fallbackText={currentUser.displayName}
                        sizeClass="w-22 h-22"
                      />
                      <span className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#FF3B5C] border-2 border-[#121216] flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                        <Camera className="w-4 h-4" />
                      </span>
                      <input
                        id="profile-avatar-picker"
                        type="file"
                        accept="image/*"
                        disabled={uploadingAvatar}
                        onChange={(e) => void handleAvatarFileChange(e)}
                        className="hidden"
                      />
                    </label>
                    <p className="text-xs text-zinc-400 text-center">
                      {uploadingAvatar
                        ? 'Actualizando foto...'
                        : 'Toca la imagen para elegir una foto de tu galería'}
                    </p>
                  </div>

                  {avatarSavedNotice && (
                    <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-300">
                      Foto de perfil actualizada.
                    </div>
                  )}

                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Tus datos personales se guardan de forma privada y solo tú puedes verlos o editarlos.
                  </p>

                  {privateError && (
                    <div className="p-3 rounded-xl bg-[#FF3B5C]/10 border border-[#FF3B5C]/40 text-xs text-[#FF8A9E]">
                      {privateError}
                    </div>
                  )}

                  {privateSavedNotice && (
                    <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-300">
                      Datos de perfil guardados correctamente.
                    </div>
                  )}

                  <div>
                    <label htmlFor="pii-first-name" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Nombres
                    </label>
                    <input
                      id="pii-first-name"
                      type="text"
                      maxLength={MAX_NAME_PART_LEN}
                      value={firstNameDraft}
                      onChange={(e) => setFirstNameDraft(e.target.value)}
                      placeholder="Ej. Eloy Gabriel"
                      className="w-full min-h-[44px] bg-zinc-900 border border-white/10 focus:border-[#FF3B5C] rounded-xl px-3.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="pii-last-name" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Apellidos
                    </label>
                    <input
                      id="pii-last-name"
                      type="text"
                      maxLength={MAX_NAME_PART_LEN}
                      value={lastNameDraft}
                      onChange={(e) => setLastNameDraft(e.target.value)}
                      placeholder="Ej. Mendoza Ríos"
                      className="w-full min-h-[44px] bg-zinc-900 border border-white/10 focus:border-[#FF3B5C] rounded-xl px-3.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="pii-phone" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Teléfono
                    </label>
                    <input
                      id="pii-phone"
                      type="tel"
                      maxLength={MAX_PHONE_LEN}
                      value={phoneDraft}
                      onChange={(e) => setPhoneDraft(e.target.value)}
                      placeholder="+34 600 000 000"
                      className="w-full min-h-[44px] bg-zinc-900 border border-white/10 focus:border-[#FF3B5C] rounded-xl px-3.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="pii-email" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Correo electrónico
                    </label>
                    <input
                      id="pii-email"
                      type="email"
                      maxLength={MAX_EMAIL_LEN}
                      value={emailDraft}
                      onChange={(e) => setEmailDraft(e.target.value)}
                      placeholder="nombre@correo.com"
                      className="w-full min-h-[44px] bg-zinc-900 border border-white/10 focus:border-[#FF3B5C] rounded-xl px-3.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingPrivate}
                    className="w-full min-h-[46px] rounded-xl bg-[#FF3B5C] hover:bg-[#ff264b] disabled:opacity-50 text-white text-sm font-semibold transition-colors cursor-pointer"
                  >
                    {savingPrivate ? 'Guardando...' : 'Guardar'}
                  </button>
                </form>
              )}

              {drawerSection === 'studio' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-zinc-400">
                      Rendimiento total de tus {createdClips.length} klips publicados
                    </p>
                    <button
                      type="button"
                      onClick={() => setDrawerSection('descripcion')}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white whitespace-nowrap cursor-pointer"
                    >
                      Editar descripción
                    </button>
                  </div>

                  {/* Studio Metrics Summary */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="p-3.5 rounded-2xl bg-[#18181D] border border-white/10 space-y-1">
                      <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                        <Eye className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                        <span className="truncate">Visualizaciones</span>
                      </div>
                      <p className="font-mono text-xl font-bold tabular-nums text-white">
                        {formatCompactCount(totalViews)}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#18181D] border border-white/10 space-y-1">
                      <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                        <Heart className="w-3.5 h-3.5 text-[#FF3B5C] shrink-0" />
                        <span className="truncate">Me gusta</span>
                      </div>
                      <p className="font-mono text-xl font-bold tabular-nums text-white">
                        {formatCompactCount(totalLikes)}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#18181D] border border-white/10 space-y-1">
                      <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
                        <Bookmark className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate">Guardados</span>
                      </div>
                      <p className="font-mono text-xl font-bold tabular-nums text-white">
                        {formatCompactCount(totalSaves)}
                      </p>
                    </div>
                  </div>

                  {/* Per-Clip Breakdown */}
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-semibold text-zinc-300">
                      Detalle por klip
                    </h3>
                    {createdClips.length === 0 ? (
                      <div className="p-6 rounded-2xl bg-[#18181D] border border-white/10 text-center space-y-3">
                        <p className="text-sm text-zinc-300">
                          Aún no tienes klips para medir
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setDrawerOpen(false);
                            onOpenCreate();
                          }}
                          className="min-h-[40px] px-4 py-2 rounded-xl bg-[#FF3B5C] hover:bg-[#ff264b] text-white text-xs font-semibold cursor-pointer"
                        >
                          Publicar primer klip
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/10 bg-[#18181D] border border-white/10 rounded-2xl overflow-hidden">
                        {createdClips.map((clip) => (
                          <div key={clip.id} className="p-3.5 flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setDrawerOpen(false);
                                onSelectClip(clip.id);
                              }}
                              className="min-w-0 flex-1 text-left cursor-pointer hover:opacity-85"
                            >
                              <p className="text-xs font-semibold text-white truncate">
                                {clip.caption}
                              </p>
                              <p className="text-[11px] text-zinc-500 mt-0.5 capitalize">
                                {clip.category} · {clip.visibility === 'private' ? 'Privado' : 'Público'}
                              </p>
                            </button>
                            <div className="flex items-center gap-3 font-mono text-xs tabular-nums text-zinc-300 shrink-0">
                              <span title="Visualizaciones" className="inline-flex items-center gap-1">
                                <Eye className="w-3.5 h-3.5 text-zinc-400" />
                                {formatCompactCount(clip.viewsCount || 0)}
                              </span>
                              <span title="Me gusta" className="inline-flex items-center gap-1">
                                <Heart className="w-3.5 h-3.5 text-[#FF3B5C]" />
                                {formatCompactCount(clip.likesCount || 0)}
                              </span>
                              <span title="Guardados" className="inline-flex items-center gap-1">
                                <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                                {formatCompactCount(clip.bookmarksCount || 0)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {drawerSection === 'descripcion' && (
                <form onSubmit={handleSaveDescription} className="space-y-4">
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Actualiza tu nombre visible, tu @usuario y la descripción pública que verán otros creadores.
                  </p>

                  {bioError && (
                    <div className="p-3 rounded-xl bg-[#FF3B5C]/10 border border-[#FF3B5C]/40 text-xs text-[#FF8A9E]">
                      {bioError}
                    </div>
                  )}

                  {bioSavedNotice && (
                    <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-300">
                      Descripción actualizada correctamente.
                    </div>
                  )}

                  <div>
                    <label htmlFor="prof-display" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Nombre visible
                    </label>
                    <input
                      id="prof-display"
                      type="text"
                      maxLength={MAX_DISPLAY_NAME_LEN}
                      value={displayNameDraft}
                      onChange={(e) => setDisplayNameDraft(e.target.value)}
                      className="w-full min-h-[44px] bg-zinc-900 border border-white/10 focus:border-[#FF3B5C] rounded-xl px-3.5 text-sm text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label htmlFor="prof-username" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Usuario (@)
                    </label>
                    <input
                      id="prof-username"
                      type="text"
                      maxLength={MAX_USERNAME_LEN}
                      value={usernameDraft}
                      onChange={(e) => setUsernameDraft(e.target.value)}
                      className="w-full min-h-[44px] bg-zinc-900 border border-white/10 focus:border-[#FF3B5C] rounded-xl px-3.5 text-sm text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1.5">
                      <label htmlFor="prof-bio" className="text-xs font-semibold text-zinc-300">
                        Descripción
                      </label>
                      <span className="font-mono text-[11px] tabular-nums text-zinc-500">
                        {bioDraft.length}/{MAX_BIO_LEN}
                      </span>
                    </div>
                    <textarea
                      id="prof-bio"
                      rows={3}
                      maxLength={MAX_BIO_LEN}
                      value={bioDraft}
                      onChange={(e) => setBioDraft(e.target.value)}
                      placeholder="Cuéntale a la comunidad qué klips creas..."
                      className="w-full bg-zinc-900 border border-white/10 focus:border-[#FF3B5C] rounded-xl p-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingBio}
                    className="w-full min-h-[46px] rounded-xl bg-[#FF3B5C] hover:bg-[#ff264b] disabled:opacity-50 text-white text-sm font-semibold transition-colors cursor-pointer"
                  >
                    {savingBio ? 'Guardando...' : 'Guardar descripción'}
                  </button>
                </form>
              )}
            </div>
          </aside>
        </div>
      )}

      <LegalModal
        isOpen={legalOpen}
        onClose={() => setLegalOpen(false)}
      />
    </div>
  );
}
