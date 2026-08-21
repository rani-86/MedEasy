import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { authenticator } from 'otplib';
import { prisma } from '../../config/db';
import { redisClient } from '../../config/redis';
import { env } from '../../config/env';
import { UnauthorizedError, ForbiddenError } from '../../common/errors';
import { OtpService } from './otp.service';
import { AccessTokenPayload, RefreshTokenPayload, TokenPair, UserRole } from './auth.types';

authenticator.options = { window: 2 };
const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_REDIS_KEY = (userId: string) => `refresh:${userId}`;
const ADMIN_TOTP_SECRET_KEY = (userId: string) => `admin:totp_secret:${userId}`;
const ADMIN_TOTP_PENDING_KEY = (userId: string) => `admin:totp_pending:${userId}`;
const MFA_SETUP_TTL_SECONDS = 10 * 60;

export class AuthService {
  private readonly otpService = new OtpService();

  // ---------------------------------------------------------------------
  // Patient flow: OTP-based, passwordless
  // ---------------------------------------------------------------------

  async requestOtp(phone: string): Promise<{ message: string; expiresInSeconds: number; demoOtp?: string }> {
    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser && !existingUser.isActive) {
      throw new ForbiddenError('This account has been deactivated. Please contact support.');
    }

    const { demoOtp } = await this.otpService.generateAndSend(phone);
    return { message: 'OTP sent successfully', expiresInSeconds: env.OTP_EXPIRY_SECONDS, demoOtp };
  }

  async verifyOtpAndLogin(phone: string, otp: string, name?: string): Promise<TokenPair> {
    const isValid = await this.otpService.verify(phone, otp);
    if (!isValid) {
      throw new UnauthorizedError('Invalid or expired OTP');
    }

    let user = await prisma.user.findUnique({
      where: { phone },
      include: { patientProfile: true },
    });

    if (!user) {
      // First-time login — create the user + patient profile together.
      user = await prisma.user.create({
        data: {
          role: 'patient',
          phone,
          name: name?.trim() || 'New Patient',
          verifiedAt: new Date(),
          patientProfile: { create: {} },
        },
        include: { patientProfile: true },
      });
    } else if (!user.isActive) {
      throw new ForbiddenError('This account has been deactivated. Please contact support.');
    } else if (!user.verifiedAt) {
      await prisma.user.update({ where: { id: user.id }, data: { verifiedAt: new Date() } });
    }

    return this.issueTokenPair(user.id, 'patient', {
      patientProfileId: user.patientProfile!.id,
    });
  }

  // ---------------------------------------------------------------------
  // Doctor flow: credential-based, license-gated scopes
  // ---------------------------------------------------------------------

  async doctorLogin(email: string, password: string): Promise<TokenPair> {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { doctor: true },
    });

    if (!user || user.role !== 'doctor' || !user.doctor) {
      throw new UnauthorizedError('Invalid credentials');
    }
    if (!user.isActive) {
      throw new ForbiddenError('This account has been deactivated. Please contact your hospital admin.');
    }
    if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // A doctor whose license hasn't been verified yet gets a valid but restricted-scope
    // token — they can view onboarding status but cannot touch patient/appointment data.
    const scopes = user.doctor.licenseVerified
      ? ['appointments:read', 'appointments:write', 'prescriptions:write', 'patients:read']
      : ['onboarding:read'];

    return this.issueTokenPair(user.id, 'doctor', {
      doctorId: user.doctor.id,
      hospitalId: user.doctor.hospitalId,
      scopes,
    });
  }

  // ---------------------------------------------------------------------
  // Admin flow: credential + mandatory TOTP MFA
  // ---------------------------------------------------------------------

  async adminLogin(email: string, password: string, totpCode: string): Promise<TokenPair> {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.role !== 'admin') {
      throw new UnauthorizedError('Invalid credentials');
    }
    if (!user.isActive) {
      throw new ForbiddenError('This account has been deactivated.');
    }
    if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const totpSecret = await redisClient.get(ADMIN_TOTP_SECRET_KEY(user.id));
    if (!totpSecret || !authenticator.verify({ token: totpCode, secret: totpSecret })) {
      throw new UnauthorizedError('Invalid MFA code');
    }

    // Same restricted-scope pattern as an unverified doctor: a token is still issued so the
    // admin can see their onboarding/verification status, but they can't touch bed or
    // doctor data at a hospital nobody has verified yet.
    const hospital = user.hospitalId ? await prisma.hospital.findUnique({ where: { id: user.hospitalId } }) : null;
    const scopes = hospital?.verified
      ? ['admin:beds', 'admin:inventory', 'admin:doctors', 'admin:analytics']
      : ['onboarding:read'];

    return this.issueTokenPair(user.id, 'admin', {
      hospitalId: user.hospitalId ?? undefined,
      scopes,
    });
  }

  // Two-step enrollment: generate a secret first (held "pending" with a TTL, not yet
  // active), then only promote it to the real key once the admin proves they can
  // actually produce a valid code from it. Without this split, a typo while scanning
  // the QR code would silently lock the account out of its own login.
  async requestAdminMfaSetup(email: string, password: string): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await this.verifyAdminPassword(email, password);

    const secret = authenticator.generateSecret();
    await redisClient.set(ADMIN_TOTP_PENDING_KEY(user.id), secret, 'EX', MFA_SETUP_TTL_SECONDS);

    return { secret, otpauthUrl: authenticator.keyuri(user.email!, 'Medeasy', secret) };
  }

  async confirmAdminMfaSetup(email: string, password: string, totpCode: string): Promise<void> {
    const user = await this.verifyAdminPassword(email, password);

    const pendingSecret = await redisClient.get(ADMIN_TOTP_PENDING_KEY(user.id));
    if (!pendingSecret || !authenticator.verify({ token: totpCode, secret: pendingSecret })) {
      throw new UnauthorizedError('Invalid or expired MFA setup code — request a new one and try again.');
    }

    // No TTL on the real key — this is the credential adminLogin checks against indefinitely.
    await redisClient.set(ADMIN_TOTP_SECRET_KEY(user.id), pendingSecret);
    await redisClient.del(ADMIN_TOTP_PENDING_KEY(user.id));
  }

  private async verifyAdminPassword(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== 'admin') {
      throw new UnauthorizedError('Invalid credentials');
    }
    if (!user.isActive) {
      throw new ForbiddenError('This account has been deactivated.');
    }
    if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedError('Invalid credentials');
    }
    return user;
  }

  // ---------------------------------------------------------------------
  // Shared: refresh, logout, password change
  // ---------------------------------------------------------------------

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: RefreshTokenPayload;
    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const storedJti = await redisClient.get(REFRESH_TOKEN_REDIS_KEY(payload.sub));
    if (!storedJti || storedJti !== payload.jti) {
      // Token reuse or an already-rotated/revoked token — treat as a potential theft signal.
      throw new UnauthorizedError('Refresh token has been revoked. Please log in again.');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { patientProfile: true, doctor: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Account no longer active');
    }

    // Rotate: invalidate the used refresh token before issuing a new pair.
    await redisClient.del(REFRESH_TOKEN_REDIS_KEY(payload.sub));

    if (user.role === 'patient' && user.patientProfile) {
      return this.issueTokenPair(user.id, 'patient', { patientProfileId: user.patientProfile.id });
    }
    if (user.role === 'doctor' && user.doctor) {
      const scopes = user.doctor.licenseVerified
        ? ['appointments:read', 'appointments:write', 'prescriptions:write', 'patients:read']
        : ['onboarding:read'];
      return this.issueTokenPair(user.id, 'doctor', {
        doctorId: user.doctor.id,
        hospitalId: user.doctor.hospitalId,
        scopes,
      });
    }
    const hospital = user.hospitalId ? await prisma.hospital.findUnique({ where: { id: user.hospitalId } }) : null;
    return this.issueTokenPair(user.id, 'admin', {
      hospitalId: user.hospitalId ?? undefined,
      scopes: hospital?.verified
        ? ['admin:beds', 'admin:inventory', 'admin:doctors', 'admin:analytics']
        : ['onboarding:read'],
    });
  }

  async logout(userId: string): Promise<void> {
    await redisClient.del(REFRESH_TOKEN_REDIS_KEY(userId));
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.passwordHash || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });

    // Invalidate any existing refresh token — force re-login on all other devices.
    await redisClient.del(REFRESH_TOKEN_REDIS_KEY(userId));
  }

  // ---------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------

  private async issueTokenPair(
    userId: string,
    role: UserRole,
    extraClaims: Partial<AccessTokenPayload>,
  ): Promise<TokenPair> {
    const signOptions: jwt.SignOptions = {
      expiresIn: env.JWT_ACCESS_EXPIRY as jwt.SignOptions['expiresIn'],
    };
    const accessToken = jwt.sign({ sub: userId, role, ...extraClaims }, env.JWT_ACCESS_SECRET, signOptions);

    const jti = randomUUID();
    const refreshTtlSeconds = env.JWT_REFRESH_EXPIRY_DAYS * 24 * 60 * 60;
    const refreshToken = jwt.sign({ sub: userId, jti }, env.JWT_REFRESH_SECRET, {
      expiresIn: refreshTtlSeconds,
    });

    await redisClient.set(REFRESH_TOKEN_REDIS_KEY(userId), jti, 'EX', refreshTtlSeconds);

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // seconds — matches the default 15m access token TTL
    };
  }
}

// Helper used by AuthController for signup-time password hashing (e.g. doctor/admin onboarding,
// which is normally driven by the Hospital Admin Portal rather than self-serve signup).
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}
