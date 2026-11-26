# Viroklipz Admin Web (Flutter Web Desktop)

Panel de administración independiente en **Flutter Web** conectado a la misma base de datos de Firestore de Viroklipz (`ai-studio-7fa9d191-669e-450e-a908-de7aaf9be995` en el proyecto `nixi-18175`).

## Requisitos previos en Firebase

1. Habilita **Email/Password** en Firebase Authentication (Consola de Firebase -> Authentication -> Sign-in method).
2. Inicia sesión únicamente con la cuenta autorizada `Egabriel79@gmail.com` (cualquier otro correo recibe **Acceso Denegado** y se cierra su sesión automáticamente).
3. Asegúrate de desplegar `firestore.rules` para habilitar lectura de métricas, suspensión de usuarios (`isBanned: true`) y moderación de `reports`/`clips`.

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
