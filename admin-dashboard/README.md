# Viroklipz Owner Admin Dashboard (Listo para GitHub)

Panel de administración independiente del propietario de Viroklipz (`Egabriel79@gmail.com`), aislado de la app pública y conectado a Firestore (`ai-studio-7fa9d191-669e-450e-a908-de7aaf9be995` en `nixi-18175`).

## Subir este dashboard a GitHub

Ejecuta estos comandos dentro de la carpeta `admin-dashboard/`:

```bash
cd admin-dashboard
git init
git branch -M main
git add .
git commit -m "feat: Viroklipz Owner Admin Dashboard"
git remote add origin https://github.com/TU_USUARIO/viroklipz-admin-dashboard.git
git push -u origin main
```

## Ejecutar en local

```bash
cd admin-dashboard
cp .env.example .env
npm install
npm run dev
```

Se abrirá en `http://localhost:4100` totalmente separado de la app de usuarios (`port 3000`).

## Despliegue recomendado

Conecta el repositorio de GitHub a **Vercel**, **Cloudflare Pages** o **Firebase Hosting** con un dominio privado (por ejemplo `admin.viroklipz.com`). El repositorio ya incluye `vercel.json`, `public/_headers` y `.gitignore` con encabezados de seguridad (HSTS, CSP, `X-Frame-Options: DENY` y `Referrer-Policy: no-referrer`).

> Asegúrate de agregar el dominio de despliegue en **Firebase Console → Authentication → Settings → Authorized domains** para habilitar el inicio de sesión de Google del dueño.
