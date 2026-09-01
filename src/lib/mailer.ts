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
          .header { text-align: center; margin-bottom: 20px; }
          .logo { font-size: 30px; line-height: 1; margin-bottom: 8px; }
          .brand { font-size: 15px; font-weight: 700; color: #4a3b2a; }
          .body-text { font-size: 14px; line-height: 1.6; color: #4a4438; margin: 16px 0; }
          .otp-container { background: #fbf6ec; border: 1px solid #d8c9a3; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
          .otp-code { font-family: monospace; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #7a5c2e; margin: 0; }
          .otp-expiry { font-size: 12px; color: #9c7a2e; margin-top: 8px; font-weight: 600; }
          .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #efeae0; font-size: 12px; color: #a39a87; text-align: center; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="logo">🎵⛪</div>
            <div class="brand">St. Mark Musicians - Instrument Reservation</div>
          </div>
          <p class="body-text">
            <strong>Password Reset:</strong> you requested a password reset for your account. Enter this code to continue:
          </p>
          <div class="otp-container">
            <div class="otp-code">${otpCode}</div>
            <div class="otp-expiry">Expires in 10 minutes</div>
          </div>
          <div class="footer">
            St. Mark Musicians - Instrument Reservation System
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

export async function sendSuperAdminNotificationEmail(
  subject: string,
  heading: string,
  intro: string,
  fields: { label: string; value: string }[],
): Promise<{ sent: boolean; error?: string }> {
  const transport = getTransporter();
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;

  if (!transport || !superAdminEmail) {
    return {
      sent: false,
      error: "Gmail SMTP or SUPER_ADMIN_EMAIL not configured",
    };
  }

  try {
    await transport.sendMail({
      from: `St. Mark Musicians <${process.env.GMAIL_USER}>`,
      to: superAdminEmail,
      subject,
      html: buildAdminNotificationHtml(heading, intro, fields),
    });
    return { sent: true };
  } catch (err: any) {
    console.error("Error sending admin notification email:", err);
    return { sent: false, error: err.message };
  }
}

function buildAdminNotificationHtml(
  heading: string,
  intro: string,
  fields: { label: string; value: string }[],
): string {
  const rows = fields
    .map(
      (f) => `
        <tr>
          <td style="padding: 6px 16px 6px 0; color: #8a7d68; font-size: 13px; font-weight: 600; white-space: nowrap; vertical-align: top;">${f.label}</td>
          <td style="padding: 6px 0; color: #2d2a24; font-size: 14px;">${f.value}</td>
        </tr>`,
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f1eb; margin: 0; padding: 24px; color: #2d2a24; }
          .card { max-width: 480px; margin: 0 auto; background: #ffffff; border: 1px solid #e0dccf; border-radius: 16px; padding: 32px; box-shadow: 0 4px 14px rgba(0,0,0,0.05); }
          .header { text-align: center; margin-bottom: 20px; }
          .logo { font-size: 30px; line-height: 1; margin-bottom: 8px; }
          .brand { font-size: 15px; font-weight: 700; color: #4a3b2a; }
          .heading { font-size: 18px; font-weight: 700; color: #4a3b2a; margin: 20px 0 8px; }
          .intro { font-size: 14px; color: #4a4438; line-height: 1.5; margin-bottom: 16px; }
          .details-table { width: 100%; border-collapse: collapse; background: #fbf6ec; border: 1px solid #e0dccf; border-radius: 10px; padding: 4px 16px; }
          .footer-text { font-size: 13px; color: #4a4438; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="logo">🎵⛪</div>
            <div class="brand">St. Mark Musicians</div>
          </div>
          <div class="heading">${heading}</div>
          <p class="intro">${intro}</p>
          <table class="details-table" cellpadding="0" cellspacing="0">
            ${rows}
          </table>
          <p class="footer-text">Please log in to the admin portal to review and approve this account.</p>
        </div>
      </body>
    </html>
  `;
}
