import fs from 'fs';
import crypto from 'crypto';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

// Server-side secret for signing authentication tokens
const SERVER_AUTH_SECRET = process.env.SESSION_SECRET || 'be_ca_aquarium_ocean_secret_key_2026';
const COMMENTS_FILE = path.join(process.cwd(), 'public', 'storage', 'data', 'comments.json');

function signUserToken(payload: { userId: string; role: 'admin' | 'member'; email?: string; name?: string; avatarUrl?: string }): string {
  const data = {
    ...payload,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  };
  const encodedData = Buffer.from(JSON.stringify(data)).toString('base64url');
  const hmac = crypto.createHmac('sha256', SERVER_AUTH_SECRET).update(encodedData).digest('base64url');
  return `${encodedData}.${hmac}`;
}

function verifyUserToken(token: string): { userId: string; role: 'admin' | 'member'; email?: string; name?: string; avatarUrl?: string } | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedData, signature] = parts;
  try {
    const expectedSig = crypto.createHmac('sha256', SERVER_AUTH_SECRET).update(encodedData).digest('base64url');
    if (signature.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(encodedData, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function readCommentsDb(): Record<string, any[]> {
  try {
    if (!fs.existsSync(COMMENTS_FILE)) {
      return {};
    }
    const raw = fs.readFileSync(COMMENTS_FILE, 'utf-8');
    return JSON.parse(raw) || {};
  } catch (err) {
    console.error('[API] Error reading comments database:', err);
    return {};
  }
}

function writeCommentsDb(data: Record<string, any[]>): void {
  try {
    const dir = path.dirname(COMMENTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmpFile = `${COMMENTS_FILE}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpFile, COMMENTS_FILE);
  } catch (err) {
    console.error('[API] Error writing comments database:', err);
  }
}

function parseJsonBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: any) => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function storageDevPlugin(): Plugin {
  return {
    name: 'storage-dev-server-plugin',
    configureServer(server) {
      // 1. Rewrite /storage/v1/object/public/:bucket/:file to /storage/:bucket/:file
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/storage/v1/object/public/')) {
          req.url = req.url.replace('/storage/v1/object/public/', '/storage/');
        }
        next();
      });

      // 2. Serve files from public/storage with HTTP Range streaming and prevent HTML fallback on 404
      server.middlewares.use((req, res, next) => {
        if (req.url && (req.method === 'GET' || req.method === 'HEAD') && req.url.startsWith('/storage/')) {
          const rawUrl = req.url.split('?')[0];
          const relativePath = decodeURIComponent(rawUrl.replace(/^\/storage\//, ''));
          const targetPath = path.join(process.cwd(), 'public', 'storage', relativePath);

          let filePathToServe: string | null = null;
          let contentType = 'application/octet-stream';

          if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
            filePathToServe = targetPath;
          } else if (relativePath.startsWith('characters/')) {
            // Check flat file in characters directory in case path was structured differently
            const baseFile = path.basename(relativePath);
            const flatCharPath = path.join(process.cwd(), 'public', 'storage', 'characters', baseFile);
            if (fs.existsSync(flatCharPath) && fs.statSync(flatCharPath).isFile()) {
              filePathToServe = flatCharPath;
            }
          } else if (relativePath.startsWith('music/') && (relativePath.endsWith('.mp3') || relativePath.endsWith('.wav') || relativePath.endsWith('.ogg') || relativePath.endsWith('.m4a'))) {
            // Audio fallback if file was lost due to container restart
            const fallbackPath = path.join(process.cwd(), 'public', 'storage', 'music', 'test_ocean.mp3');
            if (fs.existsSync(fallbackPath) && fs.statSync(fallbackPath).isFile()) {
              filePathToServe = fallbackPath;
            }
          }

          if (filePathToServe) {
            const ext = path.extname(filePathToServe).toLowerCase();
            if (ext === '.mp3') contentType = 'audio/mpeg';
            else if (ext === '.wav') contentType = 'audio/wav';
            else if (ext === '.ogg') contentType = 'audio/ogg';
            else if (ext === '.m4a') contentType = 'audio/mp4';
            else if (ext === '.aac') contentType = 'audio/aac';
            else if (ext === '.flac') contentType = 'audio/flac';
            else if (['.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
            else if (ext === '.png') contentType = 'image/png';
            else if (ext === '.webp') contentType = 'image/webp';
            else if (ext === '.svg') contentType = 'image/svg+xml';
            else if (ext === '.gif') contentType = 'image/gif';

            const stat = fs.statSync(filePathToServe);
            const range = req.headers.range;

            if (range) {
              const parts = range.replace(/bytes=/, '').split('-');
              const start = parseInt(parts[0], 10);
              const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;

              if (isNaN(start) || start >= stat.size || (parts[1] && (isNaN(end) || end >= stat.size || start > end))) {
                res.statusCode = 416;
                res.setHeader('Content-Range', `bytes */${stat.size}`);
                res.end();
                return;
              }

              const chunkSize = end - start + 1;
              res.statusCode = 206;
              res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
              res.setHeader('Accept-Ranges', 'bytes');
              res.setHeader('Content-Length', chunkSize);
              res.setHeader('Content-Type', contentType);
              res.setHeader('Cache-Control', 'no-cache');

              if (req.method === 'HEAD') {
                res.end();
                return;
              }

              const stream = fs.createReadStream(filePathToServe, { start, end });
              stream.pipe(res);
              return;
            }

            res.statusCode = 200;
            res.setHeader('Content-Length', stat.size);
            res.setHeader('Content-Type', contentType);
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Cache-Control', 'no-cache');

            if (req.method === 'HEAD') {
              res.end();
              return;
            }

            const stream = fs.createReadStream(filePathToServe);
            stream.pipe(res);
            return;
          }

          // File not found in storage: return 404, DO NOT fall through to Vite's index.html
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'File not found in storage', path: relativePath }));
          return;
        }
        next();
      });

      // 3. Handle upload endpoint: POST /api/storage/upload
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.startsWith('/api/storage/upload') && req.method === 'POST') {
          const bucket = (req.headers['x-storage-bucket'] as string) || 'music';
          const rawFileName = (req.headers['x-file-name'] as string) || `file-${Date.now()}`;
          const cleanFileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
          const targetDir = path.join(process.cwd(), 'public', 'storage', bucket);
          
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }

          const filePath = path.join(targetDir, cleanFileName);
          const writeStream = fs.createWriteStream(filePath);

          req.pipe(writeStream);

          writeStream.on('finish', () => {
            const publicUrl = `/storage/${bucket}/${cleanFileName}`;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: true,
              url: publicUrl,
              path: `${bucket}/${cleanFileName}`,
              storageBucket: bucket,
            }));
          });

          writeStream.on('error', (err) => {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message }));
          });
          return;
        }
        next();
      });

      // 4. Handle Auth Token generation: POST /api/auth/token
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/auth/token') && req.method === 'POST') {
          try {
            const body = await parseJsonBody(req);
            const userId = (body.userId || '').trim();
            let email = (body.email || '').trim();
            let name = (body.name || '').trim();
            let avatarUrl = (body.avatarUrl || '').trim();
            let role: 'admin' | 'member' = 'member';

            // Authoritative server-side identity & role resolution
            if (userId === 'owner-quynhchinga1229' || email.toLowerCase() === 'quynhchinga1229@gmail.com') {
              role = 'admin';
              email = 'quynhchinga1229@gmail.com';
              name = name || 'Chủ Bể Cá (Admin)';
            } else if (userId === 'user-demo-1') {
              role = 'member';
              email = 'lanbien1@beca.ocean';
              name = name || 'Người Lặn Biển #1';
            } else if (userId === 'user-demo-2') {
              role = 'member';
              email = 'lanbien2@beca.ocean';
              name = name || 'Người Lặn Biển #2';
            } else {
              role = 'member';
            }

            const token = signUserToken({ userId, role, email, name, avatarUrl });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: true,
              token,
              user: { userId, role, email, name, avatarUrl },
            }));
          } catch (err: any) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
          return;
        }
        next();
      });

      // 5. Handle Comments API endpoints: GET, POST, DELETE /api/comments
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/comments')) {
          next();
          return;
        }

        const urlObj = new URL(req.url, 'http://localhost:3000');
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        // pathParts: ['api', 'comments'] or ['api', 'comments', ':commentId']
        const commentIdFromPath = pathParts.length > 2 ? pathParts[2] : null;

        // GET: Fetch comments for character (or all)
        if (req.method === 'GET') {
          const characterId = urlObj.searchParams.get('characterId');
          const db = readCommentsDb();
          let comments: any[] = [];
          if (characterId) {
            comments = db[characterId] || [];
          } else {
            comments = Object.values(db).flat();
          }
          comments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, comments }));
          return;
        }

        // POST: Add new comment (requires valid Bearer token)
        if (req.method === 'POST') {
          const authHeader = req.headers['authorization'];
          const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
          const authUser = token ? verifyUserToken(token) : null;

          if (!authUser) {
            res.statusCode = 401;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Yêu cầu đăng nhập hợp lệ để bình luận.' }));
            return;
          }

          try {
            const body = await parseJsonBody(req);
            const characterId = (body.characterId || '').trim();
            const content = (body.content || '').trim();

            if (!characterId) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'ID nhân vật không hợp lệ.' }));
              return;
            }
            if (!content) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'Nội dung bình luận không được để trống.' }));
              return;
            }

            const newComment = {
              id: 'cmt-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
              characterId,
              userId: authUser.userId,
              authorName: authUser.name || (authUser.role === 'admin' ? 'Chủ Bể Cá' : 'Người Lặn Biển'),
              authorEmail: authUser.email || '',
              authorRole: authUser.role,
              authorAvatar: authUser.avatarUrl || '',
              content,
              createdAt: new Date().toISOString(),
            };

            const db = readCommentsDb();
            if (!db[characterId]) db[characterId] = [];
            db[characterId].push(newComment);
            writeCommentsDb(db);

            res.statusCode = 201;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, comment: newComment }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
          return;
        }

        // DELETE: Delete comment with strict backend/database authorization
        if (req.method === 'DELETE') {
          const authHeader = req.headers['authorization'];
          const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
          const authUser = token ? verifyUserToken(token) : null;

          if (!authUser) {
            res.statusCode = 401;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Phiên xác thực không hợp lệ hoặc đã hết hạn.' }));
            return;
          }

          const targetCommentId = commentIdFromPath || urlObj.searchParams.get('id');
          const characterIdCascade = urlObj.searchParams.get('characterId');
          const db = readCommentsDb();

          // Cascade delete for an entire character (Admin only)
          if (characterIdCascade && !targetCommentId) {
            if (authUser.role !== 'admin') {
              res.statusCode = 403;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'Bạn không có quyền quản trị để xóa toàn bộ bình luận.' }));
              return;
            }
            delete db[characterIdCascade];
            writeCommentsDb(db);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, message: 'Đã xóa toàn bộ bình luận của nhân vật.' }));
            return;
          }

          if (!targetCommentId) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Thiếu ID bình luận cần xóa.' }));
            return;
          }

          // Locate comment in database
          let targetCharId: string | null = null;
          let targetComment: any = null;

          for (const [cId, list] of Object.entries(db)) {
            const found = (list as any[]).find((c) => c.id === targetCommentId);
            if (found) {
              targetCharId = cId;
              targetComment = found;
              break;
            }
          }

          if (!targetComment || !targetCharId) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Bình luận không tồn tại hoặc đã bị xóa.' }));
            return;
          }

          // Strict Backend/Database Authorization:
          // CAN_DELETE_COMMENT = authUser.role === 'admin' OR targetComment.userId === authUser.userId
          const isAuthor = authUser.userId === targetComment.userId;
          const isAdmin = authUser.role === 'admin';
          const canDelete = isAuthor || isAdmin;

          if (!canDelete) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: false,
              error: 'Bạn không có quyền xóa bình luận này.',
            }));
            return;
          }

          // Perform real deletion from database
          db[targetCharId] = (db[targetCharId] as any[]).filter((c) => c.id !== targetCommentId);
          writeCommentsDb(db);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            success: true,
            message: 'Đã xóa bình luận.',
            deletedCommentId: targetCommentId,
          }));
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';

  return {
    plugins: [react(), tailwindcss(), storageDevPlugin()],
    envPrefix: ['VITE_', 'SUPABASE_'],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
      'import.meta.env.SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
