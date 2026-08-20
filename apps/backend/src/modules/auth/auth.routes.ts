import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authenticate } from '../../middleware/authenticate';
import { validateRequest } from '../../middleware/validateRequest';
import {
  otpRequestRateLimiter,
  otpVerifyRateLimiter,
  loginRateLimiter,
} from '../../middleware/rateLimiter';
import {
  requestOtpSchema,
  verifyOtpSchema,
  doctorLoginSchema,
  adminLoginSchema,
  adminMfaSetupRequestSchema,
  adminMfaSetupConfirmSchema,
  changePasswordSchema,
} from './auth.validation';

const router = Router();

// ---------------------------------------------------------------------------
// Public routes
// ---------------------------------------------------------------------------

router.post(
  '/otp/request',
  otpRequestRateLimiter,
  validateRequest(requestOtpSchema),
  AuthController.requestOtp,
);

router.post(
  '/otp/verify',
  otpVerifyRateLimiter,
  validateRequest(verifyOtpSchema),
  AuthController.verifyOtp,
);

router.post(
  '/login/doctor',
  loginRateLimiter,
  validateRequest(doctorLoginSchema),
  AuthController.doctorLogin,
);

router.post(
  '/login/admin',
  loginRateLimiter,
  validateRequest(adminLoginSchema),
  AuthController.adminLogin,
);

router.post(
  '/admin/mfa/setup-request',
  loginRateLimiter,
  validateRequest(adminMfaSetupRequestSchema),
  AuthController.requestAdminMfaSetup,
);

router.post(
  '/admin/mfa/setup-confirm',
  loginRateLimiter,
  validateRequest(adminMfaSetupConfirmSchema),
  AuthController.confirmAdminMfaSetup,
);

// No validateRequest here — the refresh token may arrive via the httpOnly cookie
// (browser clients) or the request body (non-cookie clients like the mobile app).
// AuthController.refresh checks both and throws UnauthorizedError if neither is present.
router.post('/refresh', AuthController.refresh);

// ---------------------------------------------------------------------------
// Authenticated routes
// ---------------------------------------------------------------------------

router.post('/logout', authenticate, AuthController.logout);
router.get('/me', authenticate, AuthController.me);
router.post(
  '/change-password',
  authenticate,
  validateRequest(changePasswordSchema),
  AuthController.changePassword,
);

export default router;
