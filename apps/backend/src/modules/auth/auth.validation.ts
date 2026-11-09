import { z } from 'zod';
import { emptySchema, indianPhoneSchema } from '../../common/validation';

export const requestOtpSchema = z.object({
  body: z.object({
    phone: indianPhoneSchema,
  }),
  query: emptySchema,
  params: emptySchema,
});

export const verifyOtpSchema = z.object({
  body: z.object({
    phone: indianPhoneSchema,
    otp: z.string().length(6, 'OTP must be exactly 6 digits').regex(/^\d+$/, 'OTP must be numeric'),
    name: z.string().min(2).max(150).optional(), // used only on first-time signup
  }),
  query: emptySchema,
  params: emptySchema,
});

export const doctorLoginSchema = z.object({
  body: z.object({
    email: z.string().email('Must be a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  }),
  query: emptySchema,
  params: emptySchema,
});

export const adminLoginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    totpCode: z.string().length(6, 'TOTP code must be 6 digits').regex(/^\d+$/),
  }),
  query: emptySchema,
  params: emptySchema,
});

export const adminMfaSetupRequestSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
  }),
  query: emptySchema,
  params: emptySchema,
});

export const adminMfaSetupConfirmSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    totpCode: z.string().length(6, 'TOTP code must be 6 digits').regex(/^\d+$/),
  }),
  query: emptySchema,
  params: emptySchema,
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(10, 'A refresh token is required'),
  }),
  query: emptySchema,
  params: emptySchema,
});

export const changePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().min(8),
      newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    })
    .refine((data) => data.currentPassword !== data.newPassword, {
      message: 'New password must be different from the current password',
      path: ['newPassword'],
    }),
  query: emptySchema,
  params: emptySchema,
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>['body'];
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>['body'];
export type AdminMfaSetupRequestInput = z.infer<typeof adminMfaSetupRequestSchema>['body'];
export type AdminMfaSetupConfirmInput = z.infer<typeof adminMfaSetupConfirmSchema>['body'];
export type DoctorLoginInput = z.infer<typeof doctorLoginSchema>['body'];
export type AdminLoginInput = z.infer<typeof adminLoginSchema>['body'];
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>['body'];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>['body'];
