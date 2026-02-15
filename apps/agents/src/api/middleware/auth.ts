import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { getSupabaseClient } from '../../services/SupabaseService.js';

const AUTH_EXEMPT_PATHS = ['/health', '/api/agent/process', '/api/agent/stream', '/api/connections/webhook/google'];

function isAuthExempt(req: Request): boolean {
  return (
    req.method === 'OPTIONS' ||
    AUTH_EXEMPT_PATHS.some(path => req.path.startsWith(path))
  );
}

async function resolveUserIdFromSupabase(token: string): Promise<string | null> {
  if (process.env.SKIP_SUPABASE_AUTH === 'true') {
    return null;
  }

  try {
    const client = getSupabaseClient();
    if (!client?.auth?.getUser) {
      return null;
    }

    const { data, error } = await client.auth.getUser(token);
    if (!error && data?.user?.id) {
      return data.user.id;
    }
  } catch (error) {
    console.warn('Supabase token verification failed, falling back to JWT secret:', error);
  }

  return null;
}

function resolveUserIdFromJwt(token: string): string | null {
  const jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
  if (!jwtSecret) {
    return null;
  }

  const payload = jwt.verify(token, jwtSecret) as jwt.JwtPayload & {
    sub?: string;
    user_id?: string;
    id?: string;
  };

  return payload.sub || payload.user_id || payload.id || null;
}

export async function authenticateRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (isAuthExempt(req)) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    let userId = await resolveUserIdFromSupabase(token);

    if (!userId) {
      userId = resolveUserIdFromJwt(token);
    }

    if (!userId) {
      throw new Error('Unable to resolve user id from token');
    }

    req.authUserId = userId;
    next();
  } catch (error) {
    console.error('Unauthorized request blocked:', error);
    res.status(401).json({ error: 'Unauthorized' });
  }
}
