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

  FirebaseAuth get auth => FirebaseAuth.instance;

  FirebaseFirestore get db => FirebaseFirestore.instanceFor(
        app: Firebase.app(),
        databaseId: DefaultFirebaseOptions.firestoreDatabaseId,
      );

  /// Verifica en Firestore que el usuario autenticado tenga `isAdmin: true`
  /// dentro de su documento `/users/{uid}`.
  Future<AdminUserModel> verifyUserIsAdmin(User firebaseUser) async {
    final userDoc = await db.collection('users').doc(firebaseUser.uid).get();
    final data = userDoc.data();
    final hasIsAdmin = userDoc.exists && data != null && data['isAdmin'] == true;

    if (!hasIsAdmin) {
      await auth.signOut();
      throw const AdminAccessDeniedException(
        'Acceso Denegado: Tu cuenta no tiene el campo isAdmin: true en Firestore.',
      );
    }

    return AdminUserModel.fromDoc(userDoc);
  }

  /// Inicia sesión con correo y contraseña y valida `isAdmin: true`.
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
      throw const AdminAccessDeniedException('No se pudo validar la sesión.');
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

  /// Actualiza `banned` en `/users/{uid}` para suspender o reactivar la cuenta.
  Future<void> setUserBanned({
    required String uid,
    required bool banned,
  }) async {
    await db.collection('users').doc(uid).update({
      'banned': banned,
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
