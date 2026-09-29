import { Body, CanActivate, Controller, ExecutionContext, Get, Inject, Injectable, Post, Req, Res, UnauthorizedException, ForbiddenException, HttpException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { PrismaService } from './database/prisma.service.js';

const cookieName = 'hub_session';
const lifetime = 8 * 60 * 60 * 1000;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const publicEmployee = { id: true, displayName: true, email: true, username: true, memberships: { select: { department: true } } } as const;
const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/' });

@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}

  token(req: Request) {
    const token = req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
  }

  async employee(req: Request) {
    const token = this.token(req);
    if (!token) throw new UnauthorizedException('Please sign in to continue.');
    const session = await this.db.loginSession.findUnique({ where: { tokenHash: digest(token) }, include: { employee: { select: publicEmployee } } });
    if (!session || session.expiresAt <= new Date()) throw new UnauthorizedException('Your session has expired. Please sign in again.');
    return session.employee;
  }

  async login(email: unknown, username: unknown, req: Request, res: Response) {
    if (typeof email !== 'string' || typeof username !== 'string' || email.length > 254 || username.length > 64 || !username.trim())
      throw new UnauthorizedException('Email or username is incorrect.');
    const employee = await this.db.employee.findUnique({ where: { email: email.trim().toLowerCase() } });
    // Requested demo access: matching identifiers, not proof of email ownership.
    if (!employee?.username || employee.username !== username.trim().toLowerCase())
      throw new UnauthorizedException('Email or username is incorrect.');
    const token = randomBytes(32).toString('hex');
    const old = this.token(req);
    await this.db.$transaction(async tx => {
      if (old) await tx.loginSession.deleteMany({ where: { tokenHash: digest(old) } });
      await tx.loginSession.deleteMany({ where: { expiresAt: { lte: new Date() } } });
      await tx.loginSession.create({ data: { tokenHash: digest(token), employeeId: employee!.id, expiresAt: new Date(Date.now() + lifetime) } });
    });
    res.cookie(cookieName, token, { ...cookieOptions(), maxAge: lifetime });
    return this.db.employee.findUnique({ where: { id: employee!.id }, select: publicEmployee });
  }

  async logout(req: Request, res: Response) {
    const token = this.token(req);
    if (token) await this.db.loginSession.deleteMany({ where: { tokenHash: digest(token) } });
    res.clearCookie(cookieName, cookieOptions());
    return { success: true };
  }
}

@Injectable()
export class SessionGuard implements CanActivate {
  private attempts = new Map<string, { count: number; until: number }>();
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const path = req.path;
    // Never trust the old browser-selected identity, even on public routes.
    delete req.headers['x-employee-id'];
    if (path.startsWith('/health') || path === '/') return true;
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.headers.origin) {
        try {
          const origin = new URL(req.headers.origin);
          if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== req.headers.origin) throw new Error();
          // Compare against the public URL, not a reverse proxy's internal Host.
          // Never trust client-supplied X-Forwarded-Host as an allowlist.
          const configured = process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL;
          const requestOrigin = new URL(`${req.protocol}://${req.get('host')}`);
          const allowed = configured ? [new URL(configured).origin] : [requestOrigin.origin];
          if (!configured && process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1', '[::1]'].includes(requestOrigin.hostname)) {
            allowed.push('http://localhost:5173', 'http://127.0.0.1:5173');
          }
          if (!allowed.includes(origin.origin)) throw new Error();
        } catch { throw new ForbiddenException('Cross-site requests are not allowed.'); }
      }
      if (req.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json')
        throw new ForbiddenException('Send requests as JSON.');
    }
    if (path === '/auth/login') {
      const now = Date.now();
      for (const [key, value] of this.attempts) if (value.until <= now) this.attempts.delete(key);
      const key = `${req.ip || 'unknown'}:${typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : 'unknown'}`;
      const attempt = this.attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
      if (attempt.count >= 20) throw new HttpException('Too many sign-in attempts. Try again in 15 minutes.', 429);
      attempt.count++;
      this.attempts.set(key, attempt);
      res.once('finish', () => { if (res.statusCode < 400) this.attempts.delete(key); });
      return true;
    }
    if (path === '/auth/logout') return true;
    const employee = await this.auth.employee(req);
    // Existing controllers receive only the server-resolved identity.
    req.headers['x-employee-id'] = employee.id;
    return true;
  }
}

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  @Post('login')
  login(@Body() body: any, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(body?.email, body?.username, req, res);
  }
  @Get('me')
  me(@Req() req: Request) { return this.auth.employee(req); }
  @Post('logout')
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) { return this.auth.logout(req, res); }
}
