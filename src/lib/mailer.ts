import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user, pass },
    });
  }

  return transporter;
}

function buildOtpEmailHtml(otpCode: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f1eb; margin: 0; padding: 24px; color: #2d2a24; }
          .card { max-width: 480px; margin: 0 auto; background: #ffffff; border: 1px solid #e0dccf; border-radius: 16px; padding: 32px; box-shadow: 0 4px 14px rgba(0,0,0,0.05); }
          .header { text-align: center; margin-bottom: 24px; }
          .logo { display: inline-block; font-size: 30px; line-height: 1; margin-bottom: 10px; }
          .title { font-size: 19px; font-weight: 700; color: #4a3b2a; margin: 0; }
          .subtitle { font-size: 13px; color: #8a7d68; margin-top: 4px; }
          .body-text { font-size: 14px; line-height: 1.6; color: #4a4438; margin: 16px 0; }
          .otp-container { background: #fbf6ec; border: 1px solid #d8c9a3; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
          .otp-code { font-family: monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #7a5c2e; margin: 0; }
          .otp-expiry { font-size: 12px; color: #9c7a2e; margin-top: 8px; font-weight: 600; }
          .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #efeae0; font-size: 12px; color: #a39a87; text-align: center; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="logo">🎵⛪</div>
            <h1 class="title">St. Mark Musicians</h1>
            <div class="subtitle">Instrument Reservation</div>
          </div>
          <p class="body-text">
            We received a request to reset your password. Use the 6-digit verification code below to verify your identity:
          </p>
          <div class="otp-container">
            <div class="otp-code">${otpCode}</div>
            <div class="otp-expiry">⏱️ Valid for 10 minutes</div>
          </div>
          <p class="body-text">
            If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
          </p>
          <div class="footer">
            St. Mark Church<br>
            St. Mark Musicians Instrument Reservation
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function sendOtpEmail(
  email: string,
  otpCode: string,
): Promise<{ sent: boolean; error?: string }> {
  const transport = getTransporter();
  if (!transport) {
    return { sent: false, error: "Gmail SMTP not configured" };
  }

  try {
    await transport.sendMail({
      from: `St. Mark Musicians <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `${otpCode} is your Password Reset Code - St. Mark Musicians`,
      html: buildOtpEmailHtml(otpCode),
    });
    return { sent: true };
  } catch (err: any) {
    console.error("Error sending OTP email via Gmail SMTP:", err);
    return { sent: false, error: err.message };
  }
}
