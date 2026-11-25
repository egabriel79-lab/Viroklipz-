import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function isBlockedPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.startsWith('fe80:') ||
    host.startsWith('fc') ||
    host.startsWith('fd')
  ) {
    return true;
  }
  if (/^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) {
    return true;
  }
  const match172 = host.match(/^172\.(\d+)\./);
  if (match172) {
    const second = Number(match172[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

function validateSafeHttpsUrl(raw: string): URL | null {
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== 'https:') return null;
    if (isBlockedPrivateHost(parsed.hostname)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: 'viroklipz-backend',
      timestamp: Date.now(),
    });
  });

  app.get('/api/live/config', (_req: Request, res: Response) => {
    const serverWhip = validateSafeHttpsUrl(process.env.WHIP_TOKEN_ENDPOINT || '');
    const clientWhip = validateSafeHttpsUrl(process.env.VITE_WHIP_TOKEN_ENDPOINT || '');
    const r2Url = validateSafeHttpsUrl(
      process.env.R2_UPLOAD_ENDPOINT || process.env.VITE_R2_UPLOAD_ENDPOINT || '',
    );
    res.json({
      whipConfigured: Boolean(serverWhip || clientWhip),
      r2Configured: Boolean(r2Url),
      iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
    });
  });

  app.post('/api/live/whip-session', async (req: Request, res: Response) => {
    const authHeader = String(req.headers.authorization || '');
    if (!authHeader.startsWith('Bearer ') || authHeader.slice(7).trim().length < 20) {
      res.status(401).json({ error: 'Se requiere autenticación válida para iniciar transmisión.' });
      return;
    }

    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 80) : '';
    const username = typeof body.username === 'string' ? body.username.trim().slice(0, 24) : '';
    if (!title || !username) {
      res.status(400).json({ error: 'Faltan datos válidos de título o usuario.' });
      return;
    }

    const endpoint = validateSafeHttpsUrl(process.env.WHIP_TOKEN_ENDPOINT || '');
    if (!endpoint) {
      res.status(503).json({
        error: 'El servidor de ingestión WHIP no está configurado en el entorno.',
      });
      return;
    }

    try {
      const apiKey = String(process.env.WHIP_API_KEY || '').trim();
      const upstream = await fetch(endpoint.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
          ...(apiKey ? { 'X-Api-Key': apiKey } : {}),
        },
        body: JSON.stringify({ title, username }),
      });

      if (!upstream.ok) {
        res.status(502).json({ error: 'No se pudo inicializar la sesión WHIP.' });
        return;
      }

      const data = (await upstream.json()) as { whipUrl?: unknown; playbackUrl?: unknown };
      const whipUrl = typeof data.whipUrl === 'string' ? validateSafeHttpsUrl(data.whipUrl) : null;
      const playbackUrl =
        typeof data.playbackUrl === 'string' ? validateSafeHttpsUrl(data.playbackUrl) : null;
      if (!whipUrl) {
        res.status(502).json({ error: 'El proveedor devolvió una URL WHIP no válida.' });
        return;
      }

      res.json({
        whipUrl: whipUrl.toString(),
        playbackUrl: playbackUrl ? playbackUrl.toString() : '',
      });
    } catch {
      res.status(502).json({ error: 'Error conectando con el servidor de transmisión.' });
    }
  });

  app.post('/api/live/generate-bio', async (req: Request, res: Response) => {
    const authHeader = String(req.headers.authorization || '');
    if (!authHeader.startsWith('Bearer ') || authHeader.slice(7).trim().length < 20) {
      res.status(401).json({ error: 'Inicia sesión para generar tu descripción con IA.' });
      return;
    }

    const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(503).json({
        error: 'El servicio de IA no está configurado con una clave de Gemini en el entorno.',
      });
      return;
    }

    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 80) : '';
    const category = typeof body.category === 'string' ? body.category.trim().slice(0, 32) : 'general';
    const displayName =
      typeof body.displayName === 'string' ? body.displayName.trim().slice(0, 40) : 'Creador';

    if (!displayName) {
      res.status(400).json({ error: 'Falta el nombre del creador para generar la descripción.' });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const prompt = [
        'Redacta en español una descripción breve, atractiva y auténtica para el apartado "Acerca de mí" de una transmisión en vivo en Viroklipz.',
        `Creador: ${displayName}`,
        `Categoría: ${category}`,
        title ? `Título del Live: ${title}` : 'Título del Live: Charla en directo con la comunidad',
        'Reglas estrictas: máximo 200 caracteres, sin comillas externas, sin hashtags excesivos (máximo 1), tono cercano y profesional en primera persona.',
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
      });

      const rawText = typeof response.text === 'string' ? response.text.trim() : '';
      const cleanAbout = rawText.replace(/^["']|["']$/g, '').trim().slice(0, 220);

      if (!cleanAbout) {
        res.status(502).json({ error: 'Gemini no devolvió contenido para la descripción del Live.' });
        return;
      }

      res.json({ about: cleanAbout });
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? `No se pudo generar la descripción con IA: ${err.message}`
          : 'No se pudo generar la descripción con IA en este momento.';
      res.status(502).json({ error: message });
    }
  });

  app.get('/api/oembed', (req: Request, res: Response) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    let parsed: URL | null = null;
    try {
      const candidate = new URL(rawUrl);
      if (candidate.protocol === 'https:' || candidate.protocol === 'http:') {
        parsed = candidate;
      }
    } catch {
      parsed = null;
    }

    if (!parsed) {
      res.status(400).json({ error: 'Parámetro url inválido.' });
      return;
    }

    const pathName = parsed.pathname.replace(/\/+$/, '');
    let title = 'Viroklipz — Klips verticales';
    if (pathName.startsWith('/@')) {
      const handle = pathName.slice(2).replace(/[^a-zA-Z0-9._]/g, '').slice(0, 24);
      if (handle) title = `@${handle} en Viroklipz`;
    } else if (pathName.startsWith('/klip/')) {
      title = 'Klip vertical en Viroklipz';
    }

    res.json({
      version: '1.0',
      type: 'video',
      provider_name: 'Viroklipz',
      provider_url: parsed.origin,
      title,
      width: 540,
      height: 960,
    });
  });

  const resolvePublicOrigin = (req: Request): string => {
    const envUrl = validateSafeHttpsUrl(process.env.APP_URL || '');
    if (envUrl) return envUrl.origin;
    const rawHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    if (/^[a-zA-Z0-9.-]+(:\d{1,5})?$/.test(rawHost)) {
      const protoHeader = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
      const proto =
        protoHeader === 'http' || protoHeader === 'https'
          ? protoHeader
          : rawHost.startsWith('localhost') || rawHost.startsWith('127.0.0.1')
            ? 'http'
            : 'https';
      return `${proto}://${rawHost}`;
    }
    return `http://localhost:${PORT}`;
  };

  app.get('/robots.txt', (req: Request, res: Response) => {
    const origin = resolvePublicOrigin(req);
    res.type('text/plain; charset=utf-8').send(
      [
        'User-agent: *',
        'Allow: /',
        'Disallow: /api/',
        '',
        'User-agent: Googlebot',
        'Allow: /',
        '',
        'User-agent: Google-Extended',
        'Allow: /',
        '',
        'User-agent: OAI-SearchBot',
        'Allow: /',
        '',
        'User-agent: ChatGPT-User',
        'Allow: /',
        '',
        'User-agent: GPTBot',
        'Allow: /',
        '',
        'User-agent: ClaudeBot',
        'Allow: /',
        '',
        'User-agent: PerplexityBot',
        'Allow: /',
        '',
        `Sitemap: ${origin}/sitemap.xml`,
      ].join('\n'),
    );
  });

  app.get('/sitemap.xml', (req: Request, res: Response) => {
    const origin = resolvePublicOrigin(req);
    const escapedOrigin = origin.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const lastmod = new Date().toISOString().split('T')[0];
    res.type('application/xml; charset=utf-8').send(
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${escapedOrigin}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`,
    );
  });

  app.get('/llms.txt', (_req: Request, res: Response) => {
    const llmsPath = path.resolve(__dirname, 'public', 'llms.txt');
    if (fs.existsSync(llmsPath)) {
      res.type('text/plain; charset=utf-8').send(fs.readFileSync(llmsPath, 'utf-8'));
      return;
    }
    res.type('text/plain; charset=utf-8').send('# Viroklipz\nRed social PWA de videos cortos verticales 9:16 y transmisiones en vivo.');
  });

  const httpServer = http.createServer(app);

  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    const indexHtml = path.resolve(distDir, 'index.html');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir, { maxAge: '1d' }));
    }
    app.get('*', (_req: Request, res: Response) => {
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build not found. Run npm run build.');
      }
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Viroklipz backend listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
