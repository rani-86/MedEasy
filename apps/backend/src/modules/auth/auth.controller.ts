import { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { AuthService } from './auth.service';
import { UnauthorizedError } from '../../common/errors';

const authService = new AuthService();

const REFRESH_COOKIE_NAME = 'medeasy_refresh_token';
// Frontend and backend are deployed on different origins (e.g. Vercel + Render), so the
// refresh cookie needs SameSite=None to survive cross-site requests — which in turn requires
// Secure. In local dev, frontend/backend share the "localhost" site (only the port differs),
// so Strict works there and is the safer default.
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'strict') as 'none' | 'strict',
  path: '/api/v1/auth',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days, matches JWT_REFRESH_EXPIRY_DAYS default
};

export const AuthController = {
  requestOtp: asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.requestOtp(req.body.phone);
    res.status(200).json({ data: result });
  }),

  verifyOtp: asyncHandler(async (req: Request, res: Response) => {
    const { phone, otp, name } = req.body;
    const tokens = await authService.verifyOtpAndLogin(phone, otp, name);

    res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(200).json({
      data: { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn },
    });
  }),

  doctorLogin: asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const tokens = await authService.doctorLogin(email, password);

    res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(200).json({
      data: { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn },
    });
  }),

  adminLogin: asyncHandler(async (req: Request, res: Response) => {
    const { email, password, totpCode } = req.body;
    const tokens = await authService.adminLogin(email, password, totpCode);

    res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(200).json({
      data: { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn },
    });
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    // Prefer the httpOnly cookie; fall back to a body-supplied token for non-browser clients
    // (e.g. the mobile app, which may not persist cookies the same way).
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME] ?? req.body?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedError('No refresh token provided');
    }

    const tokens = await authService.refresh(refreshToken);
    res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.status(200).json({
      data: { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn },
    });
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    if (req.user) {
      await authService.logout(req.user.sub);
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/v1/auth' });
    res.status(204).send();
  }),

  changePassword: asyncHandler(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user!.sub, currentPassword, newPassword);
    res.status(204).send();
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    // req.user is populated by the `authenticate` middleware from a verified JWT —
    // this endpoint lets the frontend confirm session validity and read role/claims
    // without decoding the token client-side.
    res.status(200).json({ data: req.user });
  }),
};
