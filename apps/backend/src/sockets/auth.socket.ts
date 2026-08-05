import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AccessTokenPayload } from '../modules/auth/auth.types';

export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void): void {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    return next(new Error('Missing auth token'));
  }
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    socket.data.user = payload;
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
}