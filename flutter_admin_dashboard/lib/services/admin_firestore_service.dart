import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';

import '../firebase_options.dart';
import '../models/admin_models.dart';

class AdminAccessDeniedException implements Exception {
  final String message;
  const AdminAccessDeniedException(this.message);

  @override
  String toString() => message;
}

class AdminFirestoreService {
  AdminFirestoreService._();

  static final AdminFirestoreService instance = AdminFirestoreService._();

  /// Correo exclusivo autorizado para administrar Viroklipz.
  static const String allowedAdminEmail = 'Egabriel79@gmail.com';

  FirebaseAuth get auth => FirebaseAuth.instance;

  FirebaseFirestore get db => FirebaseFirestore.instanceFor(
        app: Firebase.app(),
        databaseId: DefaultFirebaseOptions.firestoreDatabaseId,
      );

  static bool isAuthorizedAdminEmail(String? email) {
    return (email ?? '').trim().toLowerCase() ==
        allowedAdminEmail.toLowerCase();
  }

  /// Verifica que la sesión pertenezca exactamente a `Egabriel79@gmail.com`.
  /// Si no coincide, cierra la sesión en FirebaseAuth y lanza Acceso Denegado.
  Future<AdminUserModel> verifyUserIsAdmin(User firebaseUser) async {
    if (!isAuthorizedAdminEmail(firebaseUser.email)) {
      await auth.signOut();
      throw const AdminAccessDeniedException(
        'Acceso Denegado: Solo la cuenta autorizada Egabriel79@gmail.com puede ingresar.',
      );
    }

    try {
      final userDoc = await db.collection('users').doc(firebaseUser.uid).get();
      if (userDoc.exists) {
        return AdminUserModel.fromDoc(userDoc);
      }
    } catch (_) {
      // Si el perfil aún no existe en Firestore, construimos la sesión del dueño verificado.
    }

    final displayName = (firebaseUser.displayName ?? '').trim().isNotEmpty
        ? firebaseUser.displayName!.trim()
        : 'Admin Viroklipz';

    return AdminUserModel(
      uid: firebaseUser.uid,
      username: 'admin.viroklipz',
      displayName: displayName,
      email: firebaseUser.email ?? allowedAdminEmail,
      avatarUrl: firebaseUser.photoURL ?? '',
      country: 'Global',
      coins: 0,
      followersCount: 0,
      fanLevel: 50,
      isAdmin: true,
      isBanned: false,
      isPublic: true,
      createdAt: DateTime.now(),
    );
  }

  /// Inicia sesión con correo y contraseña y valida `Egabriel79@gmail.com`.
  Future<AdminUserModel> signInAdmin({
    required String email,
    required String password,
  }) async {
    final credential = await auth.signInWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );

    final user = credential.user;
    if (user == null) {
      throw const AdminAccessDeniedException(
        'Acceso Denegado: No se pudo validar la sesión.',
      );
    }

    return verifyUserIsAdmin(user);
  }

  Future<void> signOut() => auth.signOut();

  Stream<List<AdminUserModel>> watchUsers() {
    return db.collection('users').snapshots().map((snapshot) {
      final list = snapshot.docs.map(AdminUserModel.fromDoc).toList();
      list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      return list;
    });
  }

  Stream<List<AdminClipModel>> watchClips() {
    return db.collection('clips').snapshots().map((snapshot) {
      final list = snapshot.docs.map(AdminClipModel.fromDoc).toList();
      list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      return list;
    });
  }

  Stream<List<AdminReportModel>> watchReports() {
    return db.collection('reports').snapshots().map((snapshot) {
      final list = snapshot.docs.map(AdminReportModel.fromDoc).toList();
      list.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      return list;
    });
  }

  Stream<List<AdminLiveModel>> watchActiveLives() {
    return db
        .collection('liveStreams')
        .where('status', isEqualTo: 'live')
        .snapshots()
        .map((snapshot) => snapshot.docs.map(AdminLiveModel.fromDoc).toList());
  }

  /// Actualiza `isBanned` (y `banned` para compatibilidad) en `/users/{uid}`.
  Future<void> setUserBanned({
    required String uid,
    required bool isBanned,
  }) async {
    await db.collection('users').doc(uid).update({
      'isBanned': isBanned,
      'banned': isBanned,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  /// Ignorar reporte: elimina el documento del reporte en `reports/{reportId}`.
  Future<void> ignoreReport(String reportId) async {
    await db.collection('reports').doc(reportId).delete();
  }

  /// Eliminar video reportado: borra el documento en `clips/{videoId}` y el reporte.
  Future<void> deleteReportedVideoAndReport(AdminReportModel report) async {
    final batch = db.batch();
    final clipId = report.effectiveVideoId;
    if (clipId.isNotEmpty) {
      batch.delete(db.collection('clips').doc(clipId));
    }
    batch.delete(db.collection('reports').doc(report.id));
    await batch.commit();
  }
}
