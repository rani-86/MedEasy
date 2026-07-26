export type UserRole = 'patient' | 'doctor' | 'admin';

export interface AccessTokenPayload {
  sub: string; // user id
  role: UserRole;
  patientProfileId?: string;
  doctorId?: string;
  hospitalId?: string;
  scopes?: string[];
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // access token TTL in seconds, for client convenience
}
