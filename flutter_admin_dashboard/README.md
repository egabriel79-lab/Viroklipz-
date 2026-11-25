# Viroklipz Admin Web (Flutter Web Desktop)

Panel de administración independiente en **Flutter Web** conectado a la misma base de datos de Firestore de Viroklipz (`ai-studio-7fa9d191-669e-450e-a908-de7aaf9be995` en el proyecto `nixi-18175`).

## Requisitos previos en Firebase

1. Habilita **Email/Password** en Firebase Authentication (Consola de Firebase -> Authentication -> Sign-in method).
2. En Firestore (`users/{tu_uid}`), agrega el campo booleano `isAdmin: true` al documento del administrador (además de mantener `firestore.rules` actualizado).

## Ejecutar como proyecto independiente

```bash
cd flutter_admin_dashboard
flutter pub get
flutter run -d chrome --web-port 4200
```

## Compilar para producción Web

```bash
flutter build web --release
```
