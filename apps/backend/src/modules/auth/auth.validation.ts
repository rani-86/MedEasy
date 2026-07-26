import { z } from 'zod';

const indianPhoneRegex = /^\+91[6-9]\d{9}$/;

export const requestOtpSchema = z.object({
  body: z.object({
    phone: z.string().regex(indianPhoneRegex, 'Must be a valid Indian phone number in +91XXXXXXXXXX format'),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    phone: z.string().regex(indianPhoneRegex, 'Must be a valid Indian phone number in +91XXXXXXXXXX format'),
    otp: z.string().length(6, 'OTP must be exactly 6 digits').regex(/^\d+$/, 'OTP must be numeric'),
    name: z.string().min(2).max(150).optional(), // used only on first-time signup
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const doctorLoginSchema = z.object({
  body: z.object({
    email: z.string().email('Must be a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const adminLoginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    totpCode: z.string().length(6, 'TOTP code must be 6 digits').regex(/^\d+$/),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(10, 'A refresh token is required'),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
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
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>['body'];
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>['body'];
export type DoctorLoginInput = z.infer<typeof doctorLoginSchema>['body'];
export type AdminLoginInput = z.infer<typeof adminLoginSchema>['body'];
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>['body'];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>['body'];
