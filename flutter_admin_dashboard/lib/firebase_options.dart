import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart' show kIsWeb;

/// Configuración de Firebase Web compartida con la base de datos Firestore de Viroklipz.
/// Puedes regenerar este archivo con `flutterfire configure` si creas un nuevo appId.
class DefaultFirebaseOptions {
  static const String firestoreDatabaseId =
      'ai-studio-7fa9d191-669e-450e-a908-de7aaf9be995';

  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    throw UnsupportedError(
      'Este proyecto está diseñado exclusivamente para Flutter Web (Desktop Admin).',
    );
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyDcg6DhxS0YF6aPsniGGGN4rYKFsQDwg2w',
    appId: '1:29678232559:web:b385c3491e30609ca74c1a',
    messagingSenderId: '29678232559',
    projectId: 'nixi-18175',
    authDomain: 'nixi-18175.firebaseapp.com',
    storageBucket: 'nixi-18175.firebasestorage.app',
  );
}
