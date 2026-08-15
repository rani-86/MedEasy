import otpGenerator from 'otp-generator';
import { redisClient } from '../../config/redis';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { UnauthorizedError } from '../../common/errors';

const OTP_KEY = (phone: string) => `otp:${phone}`;
const OTP_ATTEMPTS_KEY = (phone: string) => `otp:attempts:${phone}`;

export class OtpService {
  /**
   * Generates a numeric OTP, stores it in Redis with a TTL, and dispatches it via SMS.
   * The SMS send is stubbed here — wire up a real provider (e.g. MSG91, Twilio) in production.
   *
   * Returns the code itself only when DEMO_MODE is on, so the caller can surface it in the
   * API response — there's no SMS provider wired up, so without this a demo deployment would
   * have no way to actually deliver the OTP anywhere.
   */
  async generateAndSend(phone: string): Promise<{ demoOtp?: string }> {
    const code = otpGenerator.generate(env.OTP_LENGTH, {
      digits: true,
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });

    await redisClient.set(OTP_KEY(phone), code, 'EX', env.OTP_EXPIRY_SECONDS);
    await redisClient.del(OTP_ATTEMPTS_KEY(phone)); // reset attempt counter on a fresh OTP

    await this.sendSms(phone, code);

    return env.DEMO_MODE ? { demoOtp: code } : {};
  }

  async verify(phone: string, submittedOtp: string): Promise<boolean> {
    const attempts = await redisClient.incr(OTP_ATTEMPTS_KEY(phone));
    if (attempts === 1) {
      await redisClient.expire(OTP_ATTEMPTS_KEY(phone), env.OTP_EXPIRY_SECONDS);
    }
    if (attempts > env.OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedError('Too many incorrect attempts. Please request a new OTP.');
    }

    const storedOtp = await redisClient.get(OTP_KEY(phone));
    if (!storedOtp || storedOtp !== submittedOtp) {
      return false;
    }

    // OTP is single-use — delete immediately on successful verification
    await redisClient.del(OTP_KEY(phone));
    await redisClient.del(OTP_ATTEMPTS_KEY(phone));
    return true;
  }

  private async sendSms(phone: string, code: string): Promise<void> {
    if (env.NODE_ENV !== 'production') {
      logger.info({ phone, code }, '[DEV ONLY] OTP generated — would be sent via SMS in production');
      return;
    }

    // Production integration point. Example shape for a provider like MSG91/Twilio:
    //
    // await fetch('https://api.smsprovider.example.com/v1/send', {
    //   method: 'POST',
    //   headers: { Authorization: `Bearer ${env.SMS_PROVIDER_API_KEY}`, 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ to: phone, message: `Your Medeasy OTP is ${code}. Valid for 5 minutes.` }),
    // });
    //
    // Deliberately left as a documented integration point rather than a live network call,
    // since the actual provider/credentials are an infra decision outside this module's scope.
    logger.warn('SMS provider integration not configured — OTP was not actually sent');
  }
}
