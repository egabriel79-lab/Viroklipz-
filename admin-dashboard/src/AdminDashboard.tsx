import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Film,
  LogOut,
  Radio,
  Search,
  ShieldAlert,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import { auth, db, googleProvider, OWNER_EMAILS } from './firebase';

type ReportStatus = 'pending' | 'resolved' | 'dismissed';

interface AdminUserRow {
  uid: string;
  username: string;
  displayName: string;
  isPublic: boolean;
  isVerified: boolean;
  isBanned: boolean;
  followersCount: number;
  realFollowersCount: number;
  seededFollowersCount: number;
  createdAtMs: number;
}

interface AdminClipRow {
  id: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  caption: string;
  category: string;
  visibility: string;
  videoUrl: string;
  visualPreset: string;
  likesCount: number;
  viewsCount: number;
  createdAtMs: number;
}

interface AdminReportRow {
  id: string;
  reporterId: string;
  targetType: 'clip' | 'chat_message' | 'user';
  targetId: string;
  videoId?: string;
  targetAuthorId: string;
  reason: string;
  details: string;
  status: ReportStatus;
  createdAtMs: number;
}

interface AdminLiveRow {
  id: string;
  hostUsername: string;
  hostDisplayName: string;
  title: string;
  viewerCount: number;
  status: string;
}

function toMs(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number') return val;
  return Date.now();
}

export function AdminDashboard() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthorizedAdmin, setIsAuthorizedAdmin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'reports' | 'clips' | 'users' | 'lives'>('reports');
  const [reportFilter, setReportFilter] = useState<ReportStatus | 'all'>('pending');
  const [searchTerm, setSearchTerm] = useState('');

  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [clips, setClips] = useState<AdminClipRow[]>([]);
  const [reports, setReports] = useState<AdminReportRow[]>([]);
  const [lives, setLives] = useState<AdminLiveRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthError(null);
      if (!nextUser) {
        setIsAuthorizedAdmin(false);
        setAuthReady(true);
        return;
      }

      const email = (nextUser.email || '').toLowerCase();
      if (OWNER_EMAILS.includes(email) && nextUser.emailVerified) {
        setIsAuthorizedAdmin(true);
        setAuthReady(true);
        return;
      }

      try {
        const adminSnap = await getDoc(doc(db, 'admins', nextUser.uid));
        setIsAuthorizedAdmin(adminSnap.exists());
      } catch {
        setIsAuthorizedAdmin(false);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isAuthorizedAdmin) {
      setUsers([]);
      setClips([]);
      setReports([]);
      setLives([]);
      return;
    }

    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const list: AdminUserRow[] = snap.docs.map((d) => {
        const data = d.data();
        const username = String(data.username || 'creador');
        const isOfficial = username.toLowerCase() === 'viroklipz';
        const realCount =
          typeof data.realFollowersCount === 'number'
            ? Math.max(0, Math.floor(data.realFollowersCount))
            : isOfficial
              ? 0
              : Math.max(0, Number(data.followersCount || 0));
        const seededCount =
          typeof data.seededFollowersCount === 'number'
            ? Math.max(0, Math.floor(data.seededFollowersCount))
            : isOfficial
              ? Math.max(0, 2000 - realCount)
              : 0;
        return {
          uid: String(data.uid || d.id),
          username,
          displayName: String(data.displayName || 'Creador'),
          isPublic: Boolean(data.isPublic ?? true),
          isVerified: Boolean(data.isVerified ?? false) || isOfficial,
          isBanned: Boolean(data.isBanned ?? data.banned ?? false),
          followersCount:
            typeof data.followersCount === 'number'
              ? Math.max(0, Math.floor(data.followersCount))
              : realCount + seededCount,
          realFollowersCount: realCount,
          seededFollowersCount: seededCount,
          createdAtMs: toMs(data.createdAt),
        };
      });
      list.sort((a, b) => b.createdAtMs - a.createdAtMs);
      setUsers(list);
    });

    const unsubClips = onSnapshot(collection(db, 'clips'), (snap) => {
      const list: AdminClipRow[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          authorId: String(data.authorId || ''),
          authorUsername: String(data.authorUsername || 'creador'),
          authorDisplayName: String(data.authorDisplayName || 'Creador'),
          caption: String(data.caption || ''),
          category: String(data.category || 'general'),
          visibility: String(data.visibility || 'public'),
          videoUrl: String(data.videoUrl || ''),
          visualPreset: String(data.visualPreset || ''),
          likesCount: Number(data.likesCount || 0),
          viewsCount: Number(data.viewsCount || 0),
          createdAtMs: toMs(data.createdAt),
        };
      });
      list.sort((a, b) => b.createdAtMs - a.createdAtMs);
      setClips(list);
    });

    const unsubReports = onSnapshot(collection(db, 'reports'), (snap) => {
      const list: AdminReportRow[] = snap.docs.map((d) => {
        const data = d.data();
        const rawStatus = String(data.status || 'pending');
        const status: ReportStatus =
          rawStatus === 'resolved' || rawStatus === 'dismissed' ? rawStatus : 'pending';
        return {
          id: String(data.id || d.id),
          reporterId: String(data.reporterId || ''),
          targetType: (data.targetType || 'clip') as 'clip' | 'chat_message' | 'user',
          targetId: String(data.targetId || ''),
          videoId: typeof data.videoId === 'string' ? data.videoId : undefined,
          targetAuthorId: String(data.targetAuthorId || ''),
          reason: String(data.reason || 'spam'),
          details: String(data.details || ''),
          status,
          createdAtMs: toMs(data.createdAt),
        };
      });
      list.sort((a, b) => b.createdAtMs - a.createdAtMs);
      setReports(list);
    });

    const unsubLives = onSnapshot(collection(db, 'liveStreams'), (snap) => {
      const list: AdminLiveRow[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            hostUsername: String(data.hostUsername || 'creador'),
            hostDisplayName: String(data.hostDisplayName || 'Creador'),
            title: String(data.title || 'En vivo'),
            viewerCount: Number(data.viewerCount || 1),
            status: String(data.status || 'ended'),
          };
        })
        .filter((l) => l.status === 'live');
      setLives(list);
    });

    return () => {
      unsubUsers();
      unsubClips();
      unsubReports();
      unsubLives();
    };
  }, [isAuthorizedAdmin]);

  const clipById = useMemo(() => {
    const map = new Map<string, AdminClipRow>();
    clips.forEach((c) => map.set(c.id, c));
    return map;
  }, [clips]);

  const pendingReportsCount = useMemo(
    () => reports.filter((r) => r.status === 'pending').length,
    [reports],
  );

  const filteredReports = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return reports.filter((r) => {
      if (reportFilter !== 'all' && r.status !== reportFilter) return false;
      if (!q) return true;
      return (
        r.reason.toLowerCase().includes(q) ||
        r.details.toLowerCase().includes(q) ||
        r.targetId.toLowerCase().includes(q)
      );
    });
  }, [reports, reportFilter, searchTerm]);

  const filteredClips = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return clips;
    return clips.filter(
      (c) =>
        c.caption.toLowerCase().includes(q) ||
        c.authorUsername.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q),
    );
  }, [clips, searchTerm]);

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q),
    );
  }, [users, searchTerm]);

  const showNotice = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 3200);
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch {
      setAuthError('No se pudo iniciar sesión con Google.');
    }
  };

  const handleDeleteReportedVideo = async (report: AdminReportRow) => {
    if (!user) return;
    const clipId = report.videoId || (report.targetType === 'clip' ? report.targetId : '');
    if (!clipId) return;
    setBusyId(report.id);
    try {
      await deleteDoc(doc(db, 'clips', clipId));
      await updateDoc(doc(db, 'reports', report.id), {
        status: 'resolved',
        reviewedBy: user.uid,
        reviewedAt: serverTimestamp(),
      });
      showNotice(`Video ${clipId} eliminado y reporte resuelto.`);
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Error al eliminar el video reportado.');
    } finally {
      setBusyId(null);
    }
  };

  const handleUpdateReportStatus = async (reportId: string, status: ReportStatus) => {
    if (!user) return;
    setBusyId(reportId);
    try {
      await updateDoc(doc(db, 'reports', reportId), {
        status,
        reviewedBy: user.uid,
        reviewedAt: serverTimestamp(),
      });
      showNotice(status === 'resolved' ? 'Reporte marcado como resuelto.' : 'Reporte descartado.');
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'No se pudo actualizar el reporte.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteClip = async (clipId: string) => {
    setBusyId(clipId);
    try {
      await deleteDoc(doc(db, 'clips', clipId));
      showNotice(`Klip ${clipId} eliminado.`);
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'No se pudo eliminar el klip.');
    } finally {
      setBusyId(null);
    }
  };

  const handleCloseLive = async (streamId: string) => {
    setBusyId(streamId);
    try {
      await updateDoc(doc(db, 'liveStreams', streamId), {
        status: 'ended',
        updatedAt: serverTimestamp(),
      });
      showNotice('Transmisión en vivo finalizada.');
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'No se pudo finalizar el Live.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSetUserVerified = async (targetUser: AdminUserRow, nextVerified: boolean) => {
    setBusyId(targetUser.uid);
    try {
      await updateDoc(doc(db, 'users', targetUser.uid), {
        isVerified: nextVerified,
        updatedAt: serverTimestamp(),
      });
      showNotice(
        nextVerified
          ? `Cuenta @${targetUser.username} verificada (isVerified: true).`
          : `Verificación manual removida de @${targetUser.username}.`,
      );
    } catch (err) {
      showNotice(
        err instanceof Error ? err.message : 'No se pudo actualizar la verificación del usuario.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleUserBan = async (targetUser: AdminUserRow, nextBanned: boolean) => {
    if (targetUser.username.toLowerCase() === 'viroklipz') {
      showNotice('No puedes suspender la cuenta oficial @viroklipz.');
      return;
    }
    setBusyId(targetUser.uid);
    try {
      await updateDoc(doc(db, 'users', targetUser.uid), {
        isBanned: nextBanned,
        banned: nextBanned,
        updatedAt: serverTimestamp(),
      });
      showNotice(
        nextBanned
          ? `Cuenta @${targetUser.username} suspendida.`
          : `Suspensión retirada para @${targetUser.username}.`,
      );
    } catch (err) {
      showNotice(
        err instanceof Error ? err.message : 'No se pudo actualizar el estado de la cuenta.',
      );
    } finally {
      setBusyId(null);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#090B12] flex items-center justify-center text-zinc-300 text-sm">
        Verificando credenciales de administración...
      </div>
    );
  }

  if (!user || !isAuthorizedAdmin) {
    return (
      <div className="min-h-screen bg-[#090B12] flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl bg-[#111524] border border-[#6C5CE7]/35 p-7 space-y-5 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#00B4D8] via-[#6C5CE7] to-[#E84393] flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold text-white">Viroklipz Admin Dashboard</h1>
            <p className="text-sm text-zinc-400">
              Panel independiente del propietario para moderación de contenido, reportes y métricas globales.
            </p>
          </div>

          {user && !isAuthorizedAdmin && (
            <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 space-y-2">
              <p>
                La cuenta <strong>{user.email}</strong> no tiene permisos de dueño/administrador en Viroklipz.
              </p>
              <button
                type="button"
                onClick={() => void signOut(auth)}
                className="underline font-semibold cursor-pointer"
              >
                Cerrar sesión y probar otra cuenta
              </button>
            </div>
          )}

          {authError && (
            <p className="text-xs text-rose-300">{authError}</p>
          )}

          <button
            type="button"
            onClick={() => void handleGoogleSignIn()}
            className="w-full min-h-[48px] rounded-2xl bg-gradient-to-r from-[#00B4D8] via-[#6C5CE7] to-[#E84393] text-white text-sm font-bold cursor-pointer hover:brightness-110 transition-all"
          >
            Entrar con cuenta de Dueño (Google)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090B12] text-white">
      {/* Top Admin Header */}
      <header className="border-b border-white/10 bg-[#101322]/90 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#00B4D8] via-[#6C5CE7] to-[#E84393] flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">
                Viroklipz Owner Console
              </h1>
              <p className="text-[11px] text-zinc-400">{user.email}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void signOut(auth)}
            className="px-3.5 py-2 rounded-xl bg-white/8 hover:bg-white/15 border border-white/10 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Salir
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {feedback && (
          <div className="p-3.5 rounded-2xl bg-[#00B4D8]/15 border border-[#00B4D8]/40 text-xs font-semibold text-[#BCEEFF]">
            {feedback}
          </div>
        )}

        {/* Global KPI Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="p-4 rounded-2xl bg-[#111524] border border-white/10 space-y-1">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
              <span>Usuarios totales</span>
              <Users className="w-4 h-4 text-[#00B4D8]" />
            </div>
            <p className="text-2xl font-bold tabular-nums">{users.length}</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#111524] border border-white/10 space-y-1">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
              <span>Klips en Firestore</span>
              <Film className="w-4 h-4 text-[#8B7CF6]" />
            </div>
            <p className="text-2xl font-bold tabular-nums">{clips.length}</p>
          </div>

          <div className="p-4 rounded-2xl bg-[#111524] border border-white/10 space-y-1">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
              <span>Reportes pendientes</span>
              <AlertTriangle className="w-4 h-4 text-[#E84393]" />
            </div>
            <p className="text-2xl font-bold tabular-nums text-[#E84393]">
              {pendingReportsCount}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#111524] border border-white/10 space-y-1">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold">
              <span>Lives activos</span>
              <Radio className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold tabular-nums">{lives.length}</p>
          </div>
        </section>

        {/* Navigation Tabs + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            {(
              [
                { id: 'reports', label: `Reportes (${pendingReportsCount})` },
                { id: 'clips', label: `Videos (${clips.length})` },
                { id: 'users', label: `Usuarios (${users.length})` },
                { id: 'lives', label: `En vivo (${lives.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-[#6C5CE7] to-[#E84393] text-white shadow'
                    : 'bg-[#111524] text-zinc-300 border border-white/10 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por ID, motivo o usuario..."
              className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-[#111524] border border-white/10 focus:border-[#00B4D8] text-xs text-white placeholder:text-zinc-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Reports Moderation Tab */}
        {activeTab === 'reports' && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              {(['pending', 'resolved', 'dismissed', 'all'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setReportFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    reportFilter === status
                      ? 'bg-[#00B4D8]/20 border border-[#00B4D8] text-[#9BE8FA]'
                      : 'bg-[#111524] border border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  {status === 'pending'
                    ? 'Pendientes'
                    : status === 'resolved'
                      ? 'Resueltos'
                      : status === 'dismissed'
                        ? 'Descartados'
                        : 'Todos'}
                </button>
              ))}
            </div>

            {filteredReports.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#111524] border border-white/10 text-center text-sm text-zinc-400">
                No hay reportes en esta vista.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredReports.map((report) => {
                  const targetClipId =
                    report.videoId || (report.targetType === 'clip' ? report.targetId : '');
                  const targetClip = targetClipId ? clipById.get(targetClipId) : undefined;
                  const isBusy = busyId === report.id;

                  return (
                    <article
                      key={report.id}
                      className="p-4 rounded-2xl bg-[#111524] border border-white/10 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="px-2 py-0.5 rounded-md bg-[#E84393]/20 text-[#FF8DC4] text-[10px] font-bold uppercase tracking-wider">
                            {report.reason}
                          </span>
                          <p className="text-xs text-zinc-400 mt-1">
                            Tipo: <strong className="text-white">{report.targetType}</strong> · ID:{' '}
                            <span className="font-mono">{report.targetId}</span>
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            report.status === 'pending'
                              ? 'bg-amber-500/20 text-amber-300'
                              : report.status === 'resolved'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-zinc-700 text-zinc-300'
                          }`}
                        >
                          {report.status}
                        </span>
                      </div>

                      {report.details && (
                        <p className="text-xs text-zinc-300 bg-black/30 rounded-xl p-2.5">
                          {report.details}
                        </p>
                      )}

                      {targetClip ? (
                        <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-semibold text-[#00B4D8]">
                              @{targetClip.authorUsername}
                            </span>
                            {targetClip.videoUrl && (
                              <a
                                href={targetClip.videoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[#8B7CF6] hover:underline"
                              >
                                Ver archivo
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          <p className="text-xs text-zinc-300 line-clamp-2">
                            {targetClip.caption || 'Sin descripción'}
                          </p>
                        </div>
                      ) : targetClipId ? (
                        <p className="text-[11px] text-zinc-500">
                          El video asociado ya fue eliminado de Firestore.
                        </p>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {targetClip && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleDeleteReportedVideo(report)}
                            className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Eliminar video reportado
                          </button>
                        )}

                        {report.status !== 'resolved' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleUpdateReportStatus(report.id, 'resolved')}
                            className="px-3 py-2 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Resolver
                          </button>
                        )}

                        {report.status !== 'dismissed' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleUpdateReportStatus(report.id, 'dismissed')}
                            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-50 text-zinc-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Descartar
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Clips Tab */}
        {activeTab === 'clips' && (
          <section className="overflow-x-auto rounded-2xl bg-[#111524] border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-zinc-400">
                <tr>
                  <th className="p-3.5">Autor</th>
                  <th className="p-3.5">Descripción</th>
                  <th className="p-3.5">Categoría</th>
                  <th className="p-3.5">Likes</th>
                  <th className="p-3.5 text-right">Moderación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredClips.map((clip) => (
                  <tr key={clip.id} className="hover:bg-white/5">
                    <td className="p-3.5 font-semibold text-[#00B4D8]">
                      @{clip.authorUsername}
                    </td>
                    <td className="p-3.5 text-zinc-300 max-w-xs truncate">
                      {clip.caption || clip.id}
                    </td>
                    <td className="p-3.5 uppercase text-zinc-400">{clip.category}</td>
                    <td className="p-3.5 tabular-nums">{clip.likesCount}</td>
                    <td className="p-3.5 text-right">
                      <button
                        type="button"
                        disabled={busyId === clip.id}
                        onClick={() => void handleDeleteClip(clip.id)}
                        className="px-3 py-1.5 rounded-lg bg-rose-600/85 hover:bg-rose-600 text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <section className="overflow-x-auto rounded-2xl bg-[#111524] border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-zinc-400">
                <tr>
                  <th className="p-3.5">Usuario</th>
                  <th className="p-3.5">Nombre</th>
                  <th className="p-3.5">Seguidores</th>
                  <th className="p-3.5">Verificado</th>
                  <th className="p-3.5">Estado</th>
                  <th className="p-3.5">UID</th>
                  <th className="p-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.map((u) => {
                  const isOfficial = u.username.toLowerCase() === 'viroklipz';
                  const hasBadge = u.isVerified || isOfficial || u.followersCount >= 10000;
                  return (
                    <tr key={u.uid} className="hover:bg-white/5">
                      <td className="p-3.5 font-semibold text-[#00B4D8]">
                        @{u.username}
                        {isOfficial && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-[#6C5CE7]/25 text-[#B4A7FF] text-[10px] font-bold uppercase">
                            Oficial
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-white">
                        <span className="inline-flex items-center gap-1.5">
                          <span>{u.displayName}</span>
                          {hasBadge && (
                            <CheckCircle2
                              aria-label="Cuenta verificada"
                              className="w-4 h-4 text-[#00B4D8] shrink-0"
                            />
                          )}
                        </span>
                      </td>
                      <td className="p-3.5 tabular-nums text-zinc-200">
                        <div>{u.followersCount.toLocaleString('en-US')}</div>
                        {isOfficial && (
                          <div className="text-[10px] text-zinc-400">
                            {u.realFollowersCount} reales · {u.seededFollowersCount} base
                          </div>
                        )}
                      </td>
                      <td className="p-3.5">
                        {hasBadge ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#00B4D8]/15 border border-[#00B4D8]/45 text-[#00B4D8] font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {isOfficial ? 'Oficial' : u.isVerified ? 'Verificado' : 'Auto (10K+)'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-400">
                            No verificado
                          </span>
                        )}
                      </td>
                      <td className="p-3.5">
                        {u.isBanned ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                            Suspendido
                          </span>
                        ) : (
                          <span className="text-zinc-300">
                            {u.isPublic ? 'Público' : 'Privado'}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 font-mono text-zinc-400">{u.uid}</td>
                      <td className="p-3.5 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          disabled={busyId === u.uid}
                          onClick={() => void handleSetUserVerified(u, !u.isVerified)}
                          className={`px-3 py-1.5 rounded-lg font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                            u.isVerified
                              ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                              : 'bg-[#00B4D8] hover:bg-[#009ec0] text-white'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {u.isVerified ? 'Verificado' : 'Verificar'}
                        </button>
                        {!isOfficial && (
                          <button
                            type="button"
                            disabled={busyId === u.uid}
                            onClick={() => void handleToggleUserBan(u, !u.isBanned)}
                            className={`px-3 py-1.5 rounded-lg font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                              u.isBanned
                                ? 'bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30'
                                : 'bg-rose-600/80 hover:bg-rose-600 text-white'
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            {u.isBanned ? 'Reactivar' : 'Suspender'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {/* Live Streams Tab */}
        {activeTab === 'lives' && (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lives.length === 0 ? (
              <div className="col-span-full p-8 rounded-2xl bg-[#111524] border border-white/10 text-center text-sm text-zinc-400">
                No hay transmisiones activas en este momento.
              </div>
            ) : (
              lives.map((live) => (
                <div
                  key={live.id}
                  className="p-4 rounded-2xl bg-[#111524] border border-white/10 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#00B4D8]">
                      @{live.hostUsername}
                    </span>
                    <span className="text-xs text-zinc-400 tabular-nums">
                      {live.viewerCount} espectadores
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-white">{live.title}</p>
                  <button
                    type="button"
                    disabled={busyId === live.id}
                    onClick={() => void handleCloseLive(live.id)}
                    className="w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white cursor-pointer"
                  >
                    Finalizar transmisión
                  </button>
                </div>
              ))
            )}
          </section>
        )}
      </main>
    </div>
  );
}
