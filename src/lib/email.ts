import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.trim();

  if (!user || !pass) {
    throw new Error(
      'Email configuration missing: GMAIL_USER and GMAIL_APP_PASSWORD environment variables must be configured to send emails.'
    );
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
    });
  }

  return transporter;
}

export async function sendOtpEmail(
  to: string,
  otp: string,
  name?: string
): Promise<{ sent: boolean; messageId?: string }> {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.trim();

  if (!user || !pass) {
    throw new Error(
      'Email service not configured: GMAIL_USER and GMAIL_APP_PASSWORD must be set in environment variables.'
    );
  }

  const mailTransporter = getTransporter();

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fcfbf9; margin: 0; padding: 24px; color: #292524; }
          .card { max-width: 480px; margin: 0 auto; background: #ffffff; border: 1px solid #e7e5e4; border-radius: 16px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
          .header { text-align: center; margin-bottom: 24px; }
          .logo { display: inline-block; font-size: 28px; line-height: 1; margin-bottom: 8px; }
          .title { font-size: 20px; font-weight: 700; color: #1c1917; margin: 0; }
          .subtitle { font-size: 13px; color: #78716c; margin-top: 4px; }
          .body-text { font-size: 14px; line-height: 1.6; color: #44403c; margin: 16px 0; }
          .otp-container { background: #fdf8f4; border: 1px solid #fed7aa; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
          .otp-code { font-family: monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #9a3412; margin: 0; }
          .otp-expiry { font-size: 12px; color: #c2410c; margin-top: 8px; font-weight: 600; }
          .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #f5f5f4; font-size: 12px; color: #a8a29e; text-align: center; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="logo">⛪</div>
            <h1 class="title">Password Reset Code</h1>
            <div class="subtitle">St. Mark Church Instrument Reservation</div>
          </div>
          <p class="body-text">
            ${name ? `Hello ${name},<br><br>` : ''}We received a request to reset your password. Use the 6-digit verification code below to verify your identity:
          </p>
          <div class="otp-container">
            <div class="otp-code">${otp}</div>
            <div class="otp-expiry">⏱️ Valid for 10 minutes</div>
          </div>
          <p class="body-text">
            If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
          </p>
          <div class="footer">
            St. Mark Church Instrument Reservation System<br>
            Secure Church Member Portal
          </div>
        </div>
      </body>
    </html>
  `;

  const textContent = `St. Mark Church Instrument Reservation\n\nYour Password Reset Code: ${otp}\n\nThis code is valid for 10 minutes. If you did not request a password reset, please ignore this email.`;

  try {
    const info = await mailTransporter.sendMail({
      from: `"St. Mark Church" <${user}>`,
      to,
      subject: `${otp} is your Password Reset Code - St. Mark Church`,
      text: textContent,
      html: htmlContent,
    });

    return { sent: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('Error sending email via Gmail SMTP:', error);
    throw new Error(error.message || 'Failed to send email via Gmail SMTP');
  }
}
