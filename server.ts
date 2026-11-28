import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import crypto from 'crypto';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const VEXPAY_SIGNING_SECRET =
  String(process.env.VEXPAY_WEBHOOK_SECRET || '').trim() ||
  crypto.randomBytes(32).toString('hex');

interface ServerRechargePackage {
  id: string;
  baseCoins: number;
  bonusCoins: number;
  totalCoins: number;
  priceUsd: number;
  priceLabel: string;
}

const VEXPAY_PACKAGES: Record<string, ServerRechargePackage> = {
  pack_starter: {
    id: 'pack_starter',
    baseCoins: 5,
    bonusCoins: 37,
    totalCoins: 42,
    priceUsd: 0.08,
    priceLabel: 'USD 0.08',
  },
  pack_plus: {
    id: 'pack_plus',
    baseCoins: 70,
    bonusCoins: 47,
    totalCoins: 117,
    priceUsd: 1.0,
    priceLabel: 'USD 1.00',
  },
  pack_pro: {
    id: 'pack_pro',
    baseCoins: 350,
    bonusCoins: 60,
    totalCoins: 410,
    priceUsd: 5.0,
    priceLabel: 'USD 5.00',
  },
  pack_vip: {
    id: 'pack_vip',
    baseCoins: 1400,
    bonusCoins: 235,
    totalCoins: 1635,
    priceUsd: 20.0,
    priceLabel: 'USD 20.00',
  },
};

function signVexPaySession(transactionId: string, packageId: string, isFirstRecharge: boolean): string {
  return crypto
    .createHmac('sha256', VEXPAY_SIGNING_SECRET)
    .update(`${transactionId}:${packageId}:${isFirstRecharge ? '1' : '0'}`)
    .digest('hex');
}

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

function buildContentSecurityPolicy(isProduction: boolean): string {
  const scriptSrc = isProduction
    ? "script-src 'self' 'unsafe-inline' https://www.gstatic.com https://apis.google.com https://www.googletagmanager.com"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://apis.google.com https://www.googletagmanager.com";
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob: https:",
    "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://*.cloudfunctions.net https://*.run.app https://firebasestorage.googleapis.com https://fcmregistrations.googleapis.com https://firebaseinstallations.googleapis.com https://*.cloudflarestorage.com https://*.cloudflarestream.com wss://*.firebaseio.com wss: ws:",
    "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://*.google.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ].join('; ');
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);

  app.use((req: Request, res: Response, next) => {
    const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
      .split(',')[0]
      .trim()
      .toLowerCase();
    const isHttps = req.secure || forwardedProto === 'https';

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader(
      'Permissions-Policy',
      'camera=(self), microphone=(self), geolocation=(), payment=(self), usb=(), interest-cohort=()',
    );
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Origin-Agent-Cluster', '?1');
    res.setHeader('Content-Security-Policy', buildContentSecurityPolicy(IS_PRODUCTION));
    if (isHttps) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload',
      );
    }
    next();
  });

  app.use(express.json({ limit: '1mb' }));

  app.get('/.well-known/security.txt', (_req: Request, res: Response) => {
    const secPath = path.resolve(__dirname, 'public', '.well-known', 'security.txt');
    if (fs.existsSync(secPath)) {
      res.type('text/plain; charset=utf-8').send(fs.readFileSync(secPath, 'utf-8'));
      return;
    }
    res
      .type('text/plain; charset=utf-8')
      .send(
        [
          'Contact: mailto:egabriel79@gmail.com',
          'Expires: 2027-12-31T23:59:59.000Z',
          'Preferred-Languages: es, en',
        ].join('\n'),
      );
  });

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

  app.get('/api/vexpay/packages', (_req: Request, res: Response) => {
    const gatewayUrl = validateSafeHttpsUrl(process.env.VEXPAY_API_URL || '');
    const apiKey = String(process.env.VEXPAY_API_KEY || '').trim();
    res.json({
      provider: 'VexPay',
      externalGatewayActive: Boolean(gatewayUrl && apiKey),
      welcomeBonusRoses: 3,
      packages: Object.values(VEXPAY_PACKAGES),
    });
  });

  app.post('/api/vexpay/create-checkout', async (req: Request, res: Response) => {
    const authHeader = String(req.headers.authorization || '');
    if (!authHeader.startsWith('Bearer ') || authHeader.slice(7).trim().length < 20) {
      res.status(401).json({ error: 'Inicia sesión para recargar monedas con VexPay.' });
      return;
    }

    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const packageId = typeof body.packageId === 'string' ? body.packageId.trim() : '';
    const isFirstRecharge = Boolean(body.isFirstRecharge);
    const pkg = VEXPAY_PACKAGES[packageId];

    if (!pkg) {
      res.status(400).json({ error: 'Paquete de monedas no válido.' });
      return;
    }

    const transactionId = `vxp_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
    const gatewayUrl = validateSafeHttpsUrl(process.env.VEXPAY_API_URL || '');
    const apiKey = String(process.env.VEXPAY_API_KEY || '').trim();
    const merchantId = String(process.env.VEXPAY_MERCHANT_ID || '').trim();

    if (gatewayUrl && apiKey) {
      try {
        const upstream = await fetch(gatewayUrl.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            ...(merchantId ? { 'X-Merchant-Id': merchantId } : {}),
          },
          body: JSON.stringify({
            referenceId: transactionId,
            packageId: pkg.id,
            amountUsd: pkg.priceUsd,
            currency: 'USD',
            coins: pkg.totalCoins,
            welcomeBonusRoses: isFirstRecharge ? 3 : 0,
            description: `Recarga Viroklipz ${pkg.totalCoins} Monedas (${pkg.priceLabel})`,
          }),
        });

        if (!upstream.ok) {
          res.status(502).json({ error: 'VexPay no pudo crear la orden de pago.' });
          return;
        }

        const data = (await upstream.json()) as {
          checkoutUrl?: unknown;
          sessionId?: unknown;
          status?: unknown;
        };
        const safeCheckoutUrl =
          typeof data.checkoutUrl === 'string' ? validateSafeHttpsUrl(data.checkoutUrl) : null;
        const signature = signVexPaySession(transactionId, pkg.id, isFirstRecharge);
        res.json({
          provider: 'VexPay',
          mode: safeCheckoutUrl ? 'external' : 'sandbox',
          transactionId,
          signature,
          checkoutUrl: safeCheckoutUrl ? safeCheckoutUrl.toString() : undefined,
          package: pkg,
          bonusRoses: isFirstRecharge ? 3 : 0,
        });
        return;
      } catch {
        res.status(502).json({ error: 'Error conectando con la pasarela VexPay.' });
        return;
      }
    }

    const signature = signVexPaySession(transactionId, pkg.id, isFirstRecharge);
    res.json({
      provider: 'VexPay',
      mode: 'sandbox',
      transactionId,
      signature,
      package: pkg,
      bonusRoses: isFirstRecharge ? 3 : 0,
    });
  });

  app.post('/api/vexpay/confirm-checkout', (req: Request, res: Response) => {
    const authHeader = String(req.headers.authorization || '');
    if (!authHeader.startsWith('Bearer ') || authHeader.slice(7).trim().length < 20) {
      res.status(401).json({ error: 'Inicia sesión para confirmar el pago con VexPay.' });
      return;
    }

    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const transactionId =
      typeof body.transactionId === 'string' ? body.transactionId.trim() : '';
    const packageId = typeof body.packageId === 'string' ? body.packageId.trim() : '';
    const signature = typeof body.signature === 'string' ? body.signature.trim() : '';
    const isFirstRecharge = Boolean(body.isFirstRecharge);

    const pkg = VEXPAY_PACKAGES[packageId];
    if (!pkg || !/^vxp_[a-zA-Z0-9]{10,40}$/.test(transactionId) || !/^[a-f0-9]{64}$/.test(signature)) {
      res.status(400).json({ error: 'Datos de comprobante VexPay inválidos.' });
      return;
    }

    const expectedSig = signVexPaySession(transactionId, pkg.id, isFirstRecharge);
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expectedSig, 'hex');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      res.status(403).json({ error: 'Firma de verificación VexPay rechazada.' });
      return;
    }

    res.json({
      verified: true,
      provider: 'VexPay',
      transactionId,
      packageId: pkg.id,
      coinsCredited: pkg.totalCoins,
      bonusRoses: isFirstRecharge ? 3 : 0,
      priceUsd: pkg.priceUsd,
      priceLabel: pkg.priceLabel,
    });
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
