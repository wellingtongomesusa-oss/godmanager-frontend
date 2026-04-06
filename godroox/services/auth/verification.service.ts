/**
 * Verification Service
 * Handles email and SMS verification codes
 * 
 * TODO: In production, integrate with:
 * - Email: SendGrid, AWS SES, Resend
 * - SMS: Twilio, AWS SNS, MessageBird
 */

export interface VerificationCode {
  code: string;
  email?: string;
  phone?: string;
  expiresAt: Date;
  verified: boolean;
}

export class VerificationService {
  /**
   * Generate 6-digit verification code
   */
  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send verification code via email
   * TODO: Integrate with email service provider
   */
  async sendEmailCode(email: string): Promise<string> {
    const code = this.generateCode();
    
    // TODO: Replace with actual email service
    // Example with SendGrid:
    // await sgMail.send({
    //   to: email,
    //   from: 'noreply@godroox.com',
    //   subject: 'Godroox - Verification Code',
    //   text: `Your verification code is: ${code}`,
    //   html: `<p>Your verification code is: <strong>${code}</strong></p>`,
    // });

    // Store code (in production, use Redis with expiration)
    if (typeof window !== 'undefined') {
      const verification: VerificationCode = {
        code,
        email,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        verified: false,
      };
      localStorage.setItem(`verification_${email}`, JSON.stringify(verification));
    } else {
      // Server-side: store in Redis or database
      // await redis.setex(`verification:${email}`, 600, code);
    }

    console.log(`[DEV] Verification code for ${email}: ${code}`);
    return code;
  }

  /**
   * Send verification code via SMS
   * TODO: Integrate with SMS service provider
   */
  async sendSMSCode(phone: string): Promise<string> {
    const code = this.generateCode();
    
    // TODO: Replace with actual SMS service
    // Example with Twilio:
    // await twilioClient.messages.create({
    //   body: `Your Godroox verification code is: ${code}`,
    //   from: '+1234567890',
    //   to: phone,
    // });

    // Store code
    if (typeof window !== 'undefined') {
      const verification: VerificationCode = {
        code,
        phone,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        verified: false,
      };
      localStorage.setItem(`verification_${phone}`, JSON.stringify(verification));
    } else {
      // Server-side: store in Redis
      // await redis.setex(`verification:${phone}`, 600, code);
    }

    console.log(`[DEV] Verification code for ${phone}: ${code}`);
    return code;
  }

  /**
   * Verify code
   * For testing: accepts "123456" as a valid code
   */
  async verifyCode(emailOrPhone: string, code: string): Promise<boolean> {
    // Test code - always accept "123456"
    if (code === '123456') {
      if (typeof window !== 'undefined') {
        const verification: VerificationCode = {
          code: '123456',
          email: emailOrPhone.includes('@') ? emailOrPhone : undefined,
          phone: !emailOrPhone.includes('@') ? emailOrPhone : undefined,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          verified: true,
        };
        localStorage.setItem(`verification_${emailOrPhone}`, JSON.stringify(verification));
      }
      return true;
    }

    // Get stored verification
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`verification_${emailOrPhone}`);
      if (!stored) return false;

      const verification: VerificationCode = JSON.parse(stored);
      
      // Check if expired
      if (new Date(verification.expiresAt) < new Date()) {
        localStorage.removeItem(`verification_${emailOrPhone}`);
        return false;
      }

      // Check if code matches
      if (verification.code === code) {
        verification.verified = true;
        localStorage.setItem(`verification_${emailOrPhone}`, JSON.stringify(verification));
        return true;
      }
    } else {
      // Server-side: check Redis
      // const storedCode = await redis.get(`verification:${emailOrPhone}`);
      // return storedCode === code || code === '123456';
    }

    return false;
  }

  /**
   * Check if email/phone is verified
   */
  async isVerified(emailOrPhone: string): Promise<boolean> {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`verification_${emailOrPhone}`);
      if (!stored) return false;

      const verification: VerificationCode = JSON.parse(stored);
      return verification.verified;
    }
    return false;
  }
}

export const verificationService = new VerificationService();
