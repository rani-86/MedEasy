import { io, Socket } from 'socket.io-client';

function socketOrigin(): string {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  try {
    return new URL(apiBase).origin;
  } catch {
    return apiBase;
  }
}

export function createQueueSocket(accessToken: string): Socket {
  return io(`${socketOrigin()}/queue`, {
    auth: { token: accessToken },
    autoConnect: false,
  });
}

export function createBedsSocket(accessToken: string): Socket {
  return io(`${socketOrigin()}/beds`, {
    auth: { token: accessToken },
    autoConnect: false,
  });
}
