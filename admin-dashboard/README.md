# Viroklipz Owner Admin Dashboard (Independiente)

Panel de administración aislado fuera de la app pública de Viroklipz, conectado directamente a la misma base de datos Firestore (`ai-studio-7fa9d191-669e-450e-a908-de7aaf9be995` en el proyecto `nixi-18175`).

## Ejecutar por separado en tu máquina o servidor privado

```bash
cd admin-dashboard
npm install
npm run dev
```

Se abrirá en `http://localhost:4100` totalmente separado de la app de usuarios (`port 3000`).

## Despliegue independiente recomendado

Puedes subir únicamente la carpeta `admin-dashboard` como un proyecto separado en **Firebase Hosting (segundo site)**, **Vercel** o **Cloudflare Pages** con un subdominio privado (por ejemplo `admin.viroklipz.com`). Solo la cuenta dueña verificada (`Egabriel79@gmail.com`) o cuentas registradas en la colección `/admins/{uid}` pueden listar usuarios/reportes y eliminar videos reportados según `firestore.rules`.
