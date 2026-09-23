import nodemailer from "nodemailer";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { admins } from "../db/schema.js";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.trim();

  if (!user || !pass) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }

  return transporter;
}

function getPortalUrl(): string {
  return process.env.APP_BASE_URL || "#";
}

function formatSlotDateTime(
  start?: Date | string | null,
  end?: Date | string | null,
): string {
  if (!start) return "Scheduled Slot";
  try {
    const startDate = typeof start === "string" ? new Date(start) : start;
    const datePart = startDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "Africa/Cairo", // add this
    });
    const startTimePart = startDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Africa/Cairo", // add this
    });
    if (end) {
      const endDate = typeof end === "string" ? new Date(end) : end;
      const endTimePart = endDate.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Africa/Cairo", // add this
      });
      return `${datePart} • ${startTimePart} - ${endTimePart}`;
    }
    return `${datePart} at ${startTimePart}`;
  } catch {
    return String(start);
  }
}

// ---------------------------------------------------------------------------
// 1. Password Reset OTP Email
// ---------------------------------------------------------------------------

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
            <strong>Password Reset:</strong> You requested a password reset for your account. Enter this code to continue:
          </p>
          <div class="otp-container">
            <div class="otp-code">${otpCode}</div>
            <div class="otp-expiry">⏱️ Expires in 10 minutes</div>
          </div>
          <div class="footer">
            St. Mark Musicians • Church Instrument Reservation System
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
    console.warn(
      "Gmail SMTP not configured: GMAIL_USER or GMAIL_APP_PASSWORD missing.",
    );
    return { sent: false, error: "Gmail SMTP not configured" };
  }

  try {
    await transport.sendMail({
      from: `"St. Mark Musicians" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: `${otpCode} is your Password Reset Code - St. Mark Church`,
      html: buildOtpEmailHtml(otpCode),
    });
    return { sent: true };
  } catch (err: any) {
    console.error("Error sending OTP email via Gmail SMTP:", err);
    return { sent: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// 2. Account Approved Email
// ---------------------------------------------------------------------------

export interface AccountApprovedEmailData {
  email: string;
  name: string;
}

function buildAccountApprovedEmailHtml(data: AccountApprovedEmailData): string {
  const portalUrl = getPortalUrl();
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f1eb; margin: 0; padding: 24px; color: #2d2a24; }
          .card { max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e0dccf; border-radius: 16px; padding: 32px; box-shadow: 0 4px 14px rgba(0,0,0,0.05); }
          .header { text-align: center; margin-bottom: 24px; }
          .logo { font-size: 32px; line-height: 1; margin-bottom: 8px; }
          .brand { font-size: 15px; font-weight: 700; color: #4a3b2a; }
          .badge-approved { display: inline-block; background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 20px; margin-top: 8px; }
          .title { font-size: 20px; font-weight: 700; color: #2d2a24; margin: 16px 0 8px; text-align: center; }
          .body-text { font-size: 14px; line-height: 1.6; color: #4a4438; margin: 12px 0; }
          .details-card { background: #fbf6ec; border: 1px solid #e0dccf; border-radius: 12px; padding: 16px; margin: 20px 0; }
          .details-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px dashed #e8e2d4; }
          .details-row:last-child { border-bottom: none; }
          .details-label { color: #8a7d68; font-weight: 600; }
          .details-value { color: #2d2a24; font-weight: 700; }
          .cta-btn { display: inline-block; background-color: #7a5c2e; color: #ffffff !important; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 10px; text-decoration: none; margin: 16px 0; text-align: center; }
          .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #efeae0; font-size: 12px; color: #a39a87; text-align: center; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="logo">🎵⛪</div>
            <div class="brand">St. Mark Church • Instrument Reservation</div>
            <div class="badge-approved">✓ Account Approved</div>
          </div>

          <h2 class="title">Welcome, ${data.name}!</h2>

          <p class="body-text">
            Your registration for the <strong>St. Mark Church Instrument Reservation Portal</strong> has been reviewed and approved by church administration.
          </p>

          <div class="details-card">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #8a7d68; font-size: 13px; font-weight: 600;">Member Name:</td>
                <td style="padding: 6px 0; color: #2d2a24; font-size: 13px; font-weight: 700; text-align: right;">${data.name}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #8a7d68; font-size: 13px; font-weight: 600;">Registered Email:</td>
                <td style="padding: 6px 0; color: #2d2a24; font-size: 13px; font-weight: 700; text-align: right;">${data.email}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #8a7d68; font-size: 13px; font-weight: 600;">Status:</td>
                <td style="padding: 6px 0; color: #047857; font-size: 13px; font-weight: 700; text-align: right;">Active &amp; Ready</td>
              </tr>
            </table>
          </div>

          <p class="body-text">
            You can now log in using your email and password to view church instrument schedules, book practice and service slots, and manage your reservations.
          </p>

          <div style="text-align: center;">
            <a href="${portalUrl}" class="cta-btn">Log In to Reservation Portal →</a>
          </div>

          <div class="footer">
            St. Mark Church • Music &amp; Liturgy Ministry<br>
            If you have any questions, please contact the church administration.
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function sendAccountApprovedEmail(
  data: AccountApprovedEmailData,
): Promise<{ sent: boolean; error?: string }> {
  const transport = getTransporter();
  if (!transport) {
    console.warn(
      "Gmail SMTP not configured: GMAIL_USER or GMAIL_APP_PASSWORD missing. Skipping account approval email.",
    );
    return { sent: false, error: "Gmail SMTP not configured" };
  }

  if (!data.email) {
    return { sent: false, error: "No recipient email provided" };
  }

  try {
    await transport.sendMail({
      from: `"St. Mark Church Instrument Reservation" <${process.env.GMAIL_USER}>`,
      to: data.email,
      subject: `Account Approved - Welcome to St. Mark Church Instrument Reservation`,
      html: buildAccountApprovedEmailHtml(data),
      text: `Hello ${data.name},\n\nYour account registration for the St. Mark Church Instrument Reservation System has been approved by church administration. Your account is now active!\n\nYou can log in at: ${getPortalUrl()}\n\nBlessings,\nSt. Mark Church Administration`,
    });
    return { sent: true };
  } catch (err: any) {
    console.error("Error sending account approval email via Gmail SMTP:", err);
    return { sent: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// 3. Reservation Approved Email
// ---------------------------------------------------------------------------

export interface ReservationApprovedEmailData {
  email: string;
  name: string;
  instrumentName: string;
  musicianName?: string;
  serviceName?: string;
  reservationType?: string; // 'in_church' | 'outside_church'
  startTime?: Date | string | null;
  endTime?: Date | string | null;
  isSeries?: boolean;
  seriesOccurrencesCount?: number;
  feeSnapshot?: string | number | null;
}

function buildReservationApprovedEmailHtml(
  data: ReservationApprovedEmailData,
): string {
  const portalUrl = getPortalUrl();
  const formattedSlot = formatSlotDateTime(data.startTime, data.endTime);
  const isOutside = data.reservationType === "outside_church";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f1eb; margin: 0; padding: 24px; color: #2d2a24; }
          .card { max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e0dccf; border-radius: 16px; padding: 32px; box-shadow: 0 4px 14px rgba(0,0,0,0.05); }
          .header { text-align: center; margin-bottom: 20px; }
          .logo { font-size: 32px; line-height: 1; margin-bottom: 8px; }
          .brand { font-size: 15px; font-weight: 700; color: #4a3b2a; }
          .badge-approved { display: inline-block; background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 20px; margin-top: 8px; }
          .title { font-size: 20px; font-weight: 700; color: #2d2a24; margin: 16px 0 8px; text-align: center; }
          .body-text { font-size: 14px; line-height: 1.6; color: #4a4438; margin: 12px 0; }
          .details-card { background: #fbf6ec; border: 1px solid #e0dccf; border-radius: 12px; padding: 16px; margin: 20px 0; }
          .table-row td { padding: 6px 0; font-size: 13px; }
          .info-note { background: ${isOutside ? "#eff6ff" : "#fefce8"}; border: 1px solid ${isOutside ? "#bfdbfe" : "#fef08a"}; border-radius: 10px; padding: 12px; font-size: 12.5px; line-height: 1.5; color: ${isOutside ? "#1e40af" : "#854d0e"}; margin: 16px 0; }
          .cta-btn { display: inline-block; background-color: #7a5c2e; color: #ffffff !important; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 10px; text-decoration: none; margin: 16px 0; text-align: center; }
          .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #efeae0; font-size: 12px; color: #a39a87; text-align: center; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="logo">🎵⛪</div>
            <div class="brand">St. Mark Church • Instrument Reservation</div>
            <div class="badge-approved">✓ Reservation Approved</div>
          </div>

          <h2 class="title">Reservation Confirmed</h2>

          <p class="body-text">
            Hello <strong>${data.name}</strong>,<br>
            ${
              data.isSeries
                ? `Great news! Your recurring reservation series (<strong>${data.seriesOccurrencesCount || "all"} occurrences</strong>) for the <strong>${data.instrumentName}</strong> has been approved by church administration.`
                : `Great news! Your reservation request for the <strong>${data.instrumentName}</strong> has been approved by church administration.`
            }
          </p>

          <div class="details-card">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #8a7d68; font-weight: 600;">Instrument:</td>
                <td style="color: #2d2a24; font-weight: 700; text-align: right;">${data.instrumentName}</td>
              </tr>
              ${
                data.musicianName
                  ? `<tr>
                <td style="color: #8a7d68; font-weight: 600;">Musician:</td>
                <td style="color: #2d2a24; font-weight: 700; text-align: right;">${data.musicianName}</td>
              </tr>`
                  : ""
              }
              ${
                data.serviceName
                  ? `<tr>
                <td style="color: #8a7d68; font-weight: 600;">Service / Purpose:</td>
                <td style="color: #2d2a24; font-weight: 600; text-align: right;">${data.serviceName}</td>
              </tr>`
                  : ""
              }
              <tr>
                <td style="color: #8a7d68; font-weight: 600;">Classification:</td>
                <td style="color: #2d2a24; font-weight: 600; text-align: right;">${isOutside ? "Outside Church Service" : "In-Church Service / Practice"}</td>
              </tr>
              <tr>
                <td style="color: #8a7d68; font-weight: 600;">${data.isSeries ? "First Slot:" : "Date & Time:"}</td>
                <td style="color: #2d2a24; font-weight: 700; text-align: right;">${formattedSlot}</td>
              </tr>
              ${
                data.isSeries
                  ? `<tr>
                <td style="color: #8a7d68; font-weight: 600;">Recurring Series:</td>
                <td style="color: #047857; font-weight: 700; text-align: right;">${data.seriesOccurrencesCount || "All"} Occurrences Approved</td>
              </tr>`
                  : ""
              }
            </table>
          </div>

          ${
            isOutside
              ? `<div class="info-note">
                  <strong>💳 Outside Church Usage Notice:</strong><br>
                  Please ensure any required Instapay fee deposit or payment receipt is coordinated with church administration. The instrument must be returned immediately following your reserved event.
                </div>`
              : `<div class="info-note">
                  <strong>⛪ In-Church Guideline:</strong><br>
                  Please arrive 10-15 minutes prior to your reserved slot. If your schedule changes, please cancel your slot promptly so fellow musicians can utilize the instrument.
                </div>`
          }

          <div style="text-align: center;">
            <a href="${portalUrl}" class="cta-btn">View My Reservations →</a>
          </div>

          <div class="footer">
            St. Mark Church • Instrument Reservation System<br>
            Have a blessed service!
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function sendReservationApprovedEmail(
  data: ReservationApprovedEmailData,
): Promise<{ sent: boolean; error?: string }> {
  const transport = getTransporter();
  if (!transport) {
    console.warn(
      "Gmail SMTP not configured: GMAIL_USER or GMAIL_APP_PASSWORD missing. Skipping reservation approved email.",
    );
    return { sent: false, error: "Gmail SMTP not configured" };
  }

  if (!data.email) {
    return { sent: false, error: "No recipient email provided" };
  }

  const subject = data.isSeries
    ? `Recurring Series Approved (${data.seriesOccurrencesCount || "All"} Slots): ${data.instrumentName} - St. Mark Church`
    : `Reservation Approved: ${data.instrumentName} - St. Mark Church`;

  try {
    await transport.sendMail({
      from: `"St. Mark Church Instrument Reservation" <${process.env.GMAIL_USER}>`,
      to: data.email,
      subject,
      html: buildReservationApprovedEmailHtml(data),
      text: `Hello ${data.name},\n\nYour reservation request for ${data.instrumentName} has been approved by church administration.\n\nDate/Time: ${formatSlotDateTime(data.startTime, data.endTime)}\n\nView details: ${getPortalUrl()}\n\nSt. Mark Church Administration`,
    });
    return { sent: true };
  } catch (err: any) {
    console.error(
      "Error sending reservation approval email via Gmail SMTP:",
      err,
    );
    return { sent: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// 4. Reservation Rejected Email
// ---------------------------------------------------------------------------

export interface ReservationRejectedEmailData {
  email: string;
  name: string;
  instrumentName: string;
  musicianName?: string;
  serviceName?: string;
  reservationType?: string;
  startTime?: Date | string | null;
  endTime?: Date | string | null;
  rejectionReason: string;
  isSeries?: boolean;
  seriesOccurrencesCount?: number;
}

function buildReservationRejectedEmailHtml(
  data: ReservationRejectedEmailData,
): string {
  const portalUrl = getPortalUrl();
  const formattedSlot = formatSlotDateTime(data.startTime, data.endTime);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f1eb; margin: 0; padding: 24px; color: #2d2a24; }
          .card { max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e0dccf; border-radius: 16px; padding: 32px; box-shadow: 0 4px 14px rgba(0,0,0,0.05); }
          .header { text-align: center; margin-bottom: 20px; }
          .logo { font-size: 32px; line-height: 1; margin-bottom: 8px; }
          .brand { font-size: 15px; font-weight: 700; color: #4a3b2a; }
          .badge-rejected { display: inline-block; background-color: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 20px; margin-top: 8px; }
          .title { font-size: 20px; font-weight: 700; color: #2d2a24; margin: 16px 0 8px; text-align: center; }
          .body-text { font-size: 14px; line-height: 1.6; color: #4a4438; margin: 12px 0; }
          .reason-card { background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin: 20px 0; }
          .reason-label { font-size: 11px; font-weight: 700; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
          .reason-content { font-size: 14px; font-weight: 600; color: #7f1d1d; line-height: 1.5; }
          .details-card { background: #fbf6ec; border: 1px solid #e0dccf; border-radius: 12px; padding: 16px; margin: 20px 0; }
          .table-row td { padding: 6px 0; font-size: 13px; }
          .cta-btn { display: inline-block; background-color: #7a5c2e; color: #ffffff !important; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 10px; text-decoration: none; margin: 16px 0; text-align: center; }
          .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #efeae0; font-size: 12px; color: #a39a87; text-align: center; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="logo">🎵⛪</div>
            <div class="brand">St. Mark Church • Instrument Reservation</div>
            <div class="badge-rejected">Reservation Request Update</div>
          </div>

          <h2 class="title">Request Not Approved</h2>

          <p class="body-text">
            Hello <strong>${data.name}</strong>,<br>
            ${
              data.isSeries
                ? `Your recurring reservation request (${data.seriesOccurrencesCount || "all"} occurrences) for the <strong>${data.instrumentName}</strong> could not be accommodated at this time.`
                : `Your reservation request for the <strong>${data.instrumentName}</strong> could not be accommodated at this time.`
            }
          </p>

          <div class="reason-card">
            <div class="reason-label">Reason from Administration:</div>
            <div class="reason-content">"${data.rejectionReason}"</div>
          </div>

          <div class="details-card">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #8a7d68; font-weight: 600; padding: 6px 0;">Instrument:</td>
                <td style="color: #2d2a24; font-weight: 700; text-align: right; padding: 6px 0;">${data.instrumentName}</td>
              </tr>
              ${
                data.musicianName
                  ? `<tr>
                <td style="color: #8a7d68; font-weight: 600; padding: 6px 0;">Musician:</td>
                <td style="color: #2d2a24; font-weight: 700; text-align: right; padding: 6px 0;">${data.musicianName}</td>
              </tr>`
                  : ""
              }
              ${
                data.serviceName
                  ? `<tr>
                <td style="color: #8a7d68; font-weight: 600; padding: 6px 0;">Service / Purpose:</td>
                <td style="color: #2d2a24; font-weight: 600; text-align: right; padding: 6px 0;">${data.serviceName}</td>
              </tr>`
                  : ""
              }
              <tr>
                <td style="color: #8a7d68; font-weight: 600; padding: 6px 0;">${data.isSeries ? "First Slot Requested:" : "Requested Slot:"}</td>
                <td style="color: #2d2a24; font-weight: 700; text-align: right; padding: 6px 0;">${formattedSlot}</td>
              </tr>
              ${
                data.isSeries
                  ? `<tr>
                <td style="color: #8a7d68; font-weight: 600; padding: 6px 0;">Recurring Series:</td>
                <td style="color: #991b1b; font-weight: 700; text-align: right; padding: 6px 0;">Entire Series (${data.seriesOccurrencesCount || "All"} occurrences)</td>
              </tr>`
                  : ""
              }
            </table>
          </div>

          <p class="body-text">
            You are welcome to check the reservation calendar to select an alternative available time slot, or reach out to church administration if you have questions.
          </p>

          <div style="text-align: center;">
            <a href="${portalUrl}" class="cta-btn">View Available Schedule →</a>
          </div>

          <div class="footer">
            St. Mark Church • Instrument Reservation System<br>
            Music &amp; Liturgy Ministry
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function sendReservationRejectedEmail(
  data: ReservationRejectedEmailData,
): Promise<{ sent: boolean; error?: string }> {
  const transport = getTransporter();
  if (!transport) {
    console.warn(
      "Gmail SMTP not configured: GMAIL_USER or GMAIL_APP_PASSWORD missing. Skipping reservation rejection email.",
    );
    return { sent: false, error: "Gmail SMTP not configured" };
  }

  if (!data.email) {
    return { sent: false, error: "No recipient email provided" };
  }

  const subject = data.isSeries
    ? `Update on your recurring series request for ${data.instrumentName} - St. Mark Church`
    : `Update on your reservation request for ${data.instrumentName} - St. Mark Church`;

  try {
    await transport.sendMail({
      from: `"St. Mark Church Instrument Reservation" <${process.env.GMAIL_USER}>`,
      to: data.email,
      subject,
      html: buildReservationRejectedEmailHtml(data),
      text: `Hello ${data.name},\n\nYour reservation request for ${data.instrumentName} could not be approved.\n\nReason: ${data.rejectionReason}\nRequested Slot: ${formatSlotDateTime(data.startTime, data.endTime)}\n\nCheck schedule: ${getPortalUrl()}\n\nSt. Mark Church Administration`,
    });
    return { sent: true };
  } catch (err: any) {
    console.error(
      "Error sending reservation rejection email via Gmail SMTP:",
      err,
    );
    return { sent: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// 5. Super Admin Notification Email
// ---------------------------------------------------------------------------

export async function sendSuperAdminNotificationEmail(
  subject: string,
  heading: string,
  intro: string,
  fields: { label: string; value: string }[],
): Promise<{ sent: boolean; error?: string }> {
  const transport = getTransporter();

  if (!transport) {
    return {
      sent: false,
      error: "Gmail SMTP not configured",
    };
  }

  try {
    const superAdminRows = await db
      .select({ email: admins.email })
      .from(admins)
      .where(eq(admins.isSuperAdmin, true));
    const superAdminEmails = [
      ...new Set(
        superAdminRows
          .map(({ email }) => email.trim())
          .filter((email) => email.length > 0),
      ),
    ];

    if (superAdminEmails.length === 0) {
      return {
        sent: false,
        error: "No super-admin email addresses configured",
      };
    }

    await Promise.all(
      superAdminEmails.map((email) =>
        transport.sendMail({
          from: `"St. Mark Musicians" <${process.env.GMAIL_USER}>`,
          to: email,
          subject,
          html: buildAdminNotificationHtml(heading, intro, fields),
        }),
      ),
    );
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
          <p style="font-size: 13px; margin-top: 12px;">
            <a href="${getPortalUrl()}" style="color: #7a5c2e; font-weight: 600;">Open St. Mark Musicians Instrument Reservation Portal →</a>
          </p>
        </div>
      </body>
    </html>
  `;
}

// ---------------------------------------------------------------------------
// 6. Reservation Paid Email (sent to all approved admins when a member
//    marks an outside-church payment as paid)
// ---------------------------------------------------------------------------

export interface ReservationPaidEmailData {
  reservationId: string;
  instrumentName: string;
  serviceName?: string;
  musicianName?: string;
  memberName: string;
  memberEmail?: string;
  memberPhone?: string;
  reservationType?: string;
  startTime?: Date | string | null;
  endTime?: Date | string | null;
  feeSnapshot?: string | number | null;
}

function buildReservationPaidEmailHtml(data: ReservationPaidEmailData): string {
  const portalUrl = getPortalUrl();
  const formattedSlot = formatSlotDateTime(data.startTime, data.endTime);
  const feeAmount = data.feeSnapshot ?? "—";

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f1eb; margin: 0; padding: 24px; color: #2d2a24; }
          .card { max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e0dccf; border-radius: 16px; padding: 32px; box-shadow: 0 4px 14px rgba(0,0,0,0.05); }
          .header { text-align: center; margin-bottom: 20px; }
          .logo { font-size: 32px; line-height: 1; margin-bottom: 8px; }
          .brand { font-size: 15px; font-weight: 700; color: #4a3b2a; }
          .badge-paid { display: inline-block; background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 20px; margin-top: 8px; }
          .title { font-size: 20px; font-weight: 700; color: #2d2a24; margin: 16px 0 8px; text-align: center; }
          .body-text { font-size: 14px; line-height: 1.6; color: #4a4438; margin: 12px 0; }
          .details-card { background: #fbf6ec; border: 1px solid #e0dccf; border-radius: 12px; padding: 16px; margin: 20px 0; }
          .fee-banner { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 16px; text-align: center; margin: 20px 0; }
          .fee-label { font-size: 11px; font-weight: 700; color: #065f46; text-transform: uppercase; letter-spacing: 0.5px; }
          .fee-amount { font-size: 26px; font-weight: 800; color: #047857; margin-top: 4px; }
          .info-note { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 12px; font-size: 12.5px; line-height: 1.5; color: #1e40af; margin: 16px 0; }
          .cta-btn { display: inline-block; background-color: #7a5c2e; color: #ffffff !important; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 10px; text-decoration: none; margin: 16px 0; text-align: center; }
          .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #efeae0; font-size: 12px; color: #a39a87; text-align: center; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="logo">🎵⛪</div>
            <div class="brand">St. Mark Church • Instrument Reservation</div>
            <div class="badge-paid">✓ Payment Marked as PAID</div>
          </div>

          <h2 class="title">Reservation Payment Confirmed</h2>

          <p class="body-text">
            <strong>${data.memberName}</strong> has marked the outside-church payment as <strong>PAID</strong>.
            Please verify the receipt in the admin portal.
          </p>

          <div class="fee-banner">
            <div class="fee-label">Amount Paid</div>
            <div class="fee-amount">EGP ${feeAmount}</div>
          </div>

          <div class="details-card">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #8a7d68; font-weight: 600; padding: 6px 0;">Member:</td>
                <td style="color: #2d2a24; font-weight: 700; text-align: right; padding: 6px 0;">${data.memberName}</td>
              </tr>
              ${
                data.memberPhone
                  ? `<tr>
                <td style="color: #8a7d68; font-weight: 600; padding: 6px 0;">Phone:</td>
                <td style="color: #2d2a24; font-weight: 600; text-align: right; padding: 6px 0;">${data.memberPhone}</td>
              </tr>`
                  : ""
              }
              ${
                data.memberEmail
                  ? `<tr>
                <td style="color: #8a7d68; font-weight: 600; padding: 6px 0;">Email:</td>
                <td style="color: #2d2a24; font-weight: 600; text-align: right; padding: 6px 0;">${data.memberEmail}</td>
              </tr>`
                  : ""
              }
              <tr>
                <td style="color: #8a7d68; font-weight: 600; padding: 6px 0;">Instrument:</td>
                <td style="color: #2d2a24; font-weight: 700; text-align: right; padding: 6px 0;">${data.instrumentName}</td>
              </tr>
              ${
                data.serviceName
                  ? `<tr>
                <td style="color: #8a7d68; font-weight: 600; padding: 6px 0;">Service / Purpose:</td>
                <td style="color: #2d2a24; font-weight: 600; text-align: right; padding: 6px 0;">${data.serviceName}</td>
              </tr>`
                  : ""
              }
              ${
                data.musicianName
                  ? `<tr>
                <td style="color: #8a7d68; font-weight: 600; padding: 6px 0;">Musician:</td>
                <td style="color: #2d2a24; font-weight: 600; text-align: right; padding: 6px 0;">${data.musicianName}</td>
              </tr>`
                  : ""
              }
              <tr>
                <td style="color: #8a7d68; font-weight: 600; padding: 6px 0;">Slot:</td>
                <td style="color: #2d2a24; font-weight: 700; text-align: right; padding: 6px 0;">${formattedSlot}</td>
              </tr>
              <tr>
                <td style="color: #8a7d68; font-weight: 600; padding: 6px 0;">Reservation ID:</td>
                <td style="color: #2d2a24; font-weight: 600; text-align: right; padding: 6px 0; font-family: monospace;">#${String(data.reservationId).substring(0, 8)}</td>
              </tr>
            </table>
          </div>

          <div class="info-note">
            <strong>🔍 Action Required:</strong><br>
            Log in to the admin portal to review the uploaded payment receipt and confirm the transaction.
          </div>

          <div style="text-align: center;">
            <a href="${portalUrl}" class="cta-btn">Open Admin Portal →</a>
          </div>

          <div class="footer">
            St. Mark Church • Instrument Reservation System<br>
            Automated payment confirmation notice
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Sends a "reservation marked as paid" email to all approved admins.
 * Recipients: every admin where `approval_status = 'approved'` AND email is set.
 */
export async function sendReservationPaidEmail(
  data: ReservationPaidEmailData,
): Promise<{ sent: boolean; error?: string; recipientCount?: number }> {
  const transport = getTransporter();
  if (!transport) {
    console.warn(
      "Gmail SMTP not configured: GMAIL_USER or GMAIL_APP_PASSWORD missing. Skipping reservation paid email.",
    );
    return { sent: false, error: "Gmail SMTP not configured" };
  }

  try {
    const adminRows = await db
      .select({ email: admins.email })
      .from(admins)
      .where(eq(admins.approvalStatus, "approved"));
    const adminEmails = [
      ...new Set(
        adminRows
          .map((r) => (r.email || "").trim())
          .filter((e) => e.length > 0),
      ),
    ];

    if (adminEmails.length === 0) {
      return {
        sent: false,
        error: "No approved admin email addresses configured",
        recipientCount: 0,
      };
    }

    const subject = `Payment Received — ${data.instrumentName} (${data.memberName})`;
    const html = buildReservationPaidEmailHtml(data);
    const text = `Payment Confirmed\n\n${data.memberName} marked the outside-church payment as PAID.\n\nInstrument: ${data.instrumentName}\nService: ${data.serviceName || "—"}\nSlot: ${formatSlotDateTime(data.startTime, data.endTime)}\nAmount: EGP ${data.feeSnapshot ?? "—"}\nMember Phone: ${data.memberPhone || "—"}\nMember Email: ${data.memberEmail || "—"}\n\nReview in the admin portal: ${getPortalUrl()}\n\nSt. Mark Church Administration`;

    await Promise.all(
      adminEmails.map((email) =>
        transport.sendMail({
          from: `"St. Mark Church Instrument Reservation" <${process.env.GMAIL_USER}>`,
          to: email,
          subject,
          html,
          text,
        }),
      ),
    );

    return { sent: true, recipientCount: adminEmails.length };
  } catch (err: any) {
    console.error("Error sending reservation paid email via Gmail SMTP:", err);
    return { sent: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// 7. New Admin Message → Email to Member
// ---------------------------------------------------------------------------

export interface NewMessageToMemberEmailData {
  email: string;
  memberName: string;
  adminName: string;
  instrumentName: string;
  serviceName?: string;
  startTime?: Date | string | null;
  endTime?: Date | string | null;
  reservationId: string;
  messageContent: string;
}

function buildNewMessageToMemberHtml(
  data: NewMessageToMemberEmailData,
): string {
  const portalUrl = getPortalUrl();
  const formattedSlot = formatSlotDateTime(data.startTime, data.endTime);
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f1eb; margin: 0; padding: 24px; color: #2d2a24; }
          .card { max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e0dccf; border-radius: 16px; padding: 32px; box-shadow: 0 4px 14px rgba(0,0,0,0.05); }
          .header { text-align: center; margin-bottom: 20px; }
          .logo { font-size: 32px; line-height: 1; margin-bottom: 8px; }
          .brand { font-size: 15px; font-weight: 700; color: #4a3b2a; }
          .badge-msg { display: inline-block; background-color: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 20px; margin-top: 8px; }
          .title { font-size: 20px; font-weight: 700; color: #2d2a24; margin: 16px 0 8px; text-align: center; }
          .body-text { font-size: 14px; line-height: 1.6; color: #4a4438; margin: 12px 0; }
          .message-card { background: #fbf6ec; border-left: 4px solid #7a5c2e; border-radius: 8px; padding: 16px; margin: 20px 0; }
          .message-label { font-size: 11px; font-weight: 700; color: #8a7d68; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
          .message-content { font-size: 14px; line-height: 1.6; color: #2d2a24; white-space: pre-wrap; }
          .details-card { background: #fbf6ec; border: 1px solid #e0dccf; border-radius: 12px; padding: 16px; margin: 20px 0; }
          .cta-btn { display: inline-block; background-color: #7a5c2e; color: #ffffff !important; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 10px; text-decoration: none; margin: 16px 0; text-align: center; }
          .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #efeae0; font-size: 12px; color: #a39a87; text-align: center; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="logo">🎵⛪</div>
            <div class="brand">St. Mark Church • Instrument Reservation</div>
            <div class="badge-msg">💬 New Message from Administration</div>
          </div>
          <h2 class="title">You Have a New Message</h2>
          <p class="body-text">
            Hello <strong>${data.memberName}</strong>,<br>
            Church administration (<strong>${data.adminName}</strong>) sent you a message regarding your reservation:
          </p>
          <div class="message-card">
            <div class="message-label">Message:</div>
            <div class="message-content">${data.messageContent}</div>
          </div>
          <div class="details-card">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #8a7d68; font-weight: 600; padding: 6px 0;">Instrument:</td>
                <td style="color: #2d2a24; font-weight: 700; text-align: right; padding: 6px 0;">${data.instrumentName}</td>
              </tr>
              ${
                data.serviceName
                  ? `<tr><td style="color: #8a7d68; font-weight: 600; padding: 6px 0;">Service / Purpose:</td><td style="color: #2d2a24; font-weight: 600; text-align: right; padding: 6px 0;">${data.serviceName}</td></tr>`
                  : ""
              }
              <tr>
                <td style="color: #8a7d68; font-weight: 600; padding: 6px 0;">Slot:</td>
                <td style="color: #2d2a24; font-weight: 700; text-align: right; padding: 6px 0;">${formattedSlot}</td>
              </tr>
            </table>
          </div>
          <p class="body-text">
            Open the reservation detail in your portal to read and reply to this message.
          </p>
          <div style="text-align: center;">
            <a href="${portalUrl}" class="cta-btn">View Reservation →</a>
          </div>
          <div class="footer">
            St. Mark Church • Instrument Reservation System<br>
            Please do not reply to this email — use the in-app chat.
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function sendNewMessageToMemberEmail(
  data: NewMessageToMemberEmailData,
): Promise<{ sent: boolean; error?: string }> {
  const transport = getTransporter();
  if (!transport) {
    console.warn(
      "Gmail SMTP not configured: GMAIL_USER or GMAIL_APP_PASSWORD missing. Skipping new-message email.",
    );
    return { sent: false, error: "Gmail SMTP not configured" };
  }
  if (!data.email) {
    return { sent: false, error: "No recipient email provided" };
  }
  try {
    await transport.sendMail({
      from: `"St. Mark Church Instrument Reservation" <${process.env.GMAIL_USER}>`,
      to: data.email,
      subject: `New message from church administration — ${data.instrumentName}`,
      html: buildNewMessageToMemberHtml(data),
      text: `Hello ${data.memberName},\n\n${data.adminName} sent you a message regarding your reservation for ${data.instrumentName}:\n\n"${data.messageContent}"\n\nOpen the portal to reply: ${getPortalUrl()}`,
    });
    return { sent: true };
  } catch (err: any) {
    console.error("Error sending new-message-to-member email:", err);
    return { sent: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// 8. Member Reply → Email to All Approved Admins
// ---------------------------------------------------------------------------

export interface NewMessageToAdminsEmailData {
  memberName: string;
  instrumentName: string;
  serviceName?: string;
  startTime?: Date | string | null;
  endTime?: Date | string | null;
  reservationId: string;
  messageContent: string;
}

function buildNewMessageToAdminsHtml(
  data: NewMessageToAdminsEmailData,
): string {
  const portalUrl = getPortalUrl();
  const formattedSlot = formatSlotDateTime(data.startTime, data.endTime);
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f1eb; margin: 0; padding: 24px; color: #2d2a24; }
          .card { max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e0dccf; border-radius: 16px; padding: 32px; box-shadow: 0 4px 14px rgba(0,0,0,0.05); }
          .header { text-align: center; margin-bottom: 20px; }
          .logo { font-size: 32px; line-height: 1; margin-bottom: 8px; }
          .brand { font-size: 15px; font-weight: 700; color: #4a3b2a; }
          .badge-msg { display: inline-block; background-color: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 20px; margin-top: 8px; }
          .title { font-size: 20px; font-weight: 700; color: #2d2a24; margin: 16px 0 8px; text-align: center; }
          .body-text { font-size: 14px; line-height: 1.6; color: #4a4438; margin: 12px 0; }
          .message-card { background: #fbf6ec; border-left: 4px solid #7a5c2e; border-radius: 8px; padding: 16px; margin: 20px 0; }
          .message-label { font-size: 11px; font-weight: 700; color: #8a7d68; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
          .message-content { font-size: 14px; line-height: 1.6; color: #2d2a24; white-space: pre-wrap; }
          .details-card { background: #fbf6ec; border: 1px solid #e0dccf; border-radius: 12px; padding: 16px; margin: 20px 0; }
          .cta-btn { display: inline-block; background-color: #7a5c2e; color: #ffffff !important; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 10px; text-decoration: none; margin: 16px 0; text-align: center; }
          .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #efeae0; font-size: 12px; color: #a39a87; text-align: center; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="logo">🎵⛪</div>
            <div class="brand">St. Mark Church • Instrument Reservation</div>
            <div class="badge-msg">💬 New Reply from Member</div>
          </div>
          <h2 class="title">Member Replied to a Reservation</h2>
          <p class="body-text">
            <strong>${data.memberName}</strong> replied on reservation for <strong>${data.instrumentName}</strong>:
          </p>
          <div class="message-card">
            <div class="message-label">Message:</div>
            <div class="message-content">${data.messageContent}</div>
          </div>
          <div class="details-card">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #8a7d68; font-weight: 600; padding: 6px 0;">Instrument:</td>
                <td style="color: #2d2a24; font-weight: 700; text-align: right; padding: 6px 0;">${data.instrumentName}</td>
              </tr>
              ${
                data.serviceName
                  ? `<tr><td style="color: #8a7d68; font-weight: 600; padding: 6px 0;">Service / Purpose:</td><td style="color: #2d2a24; font-weight: 600; text-align: right; padding: 6px 0;">${data.serviceName}</td></tr>`
                  : ""
              }
              <tr>
                <td style="color: #8a7d68; font-weight: 600; padding: 6px 0;">Slot:</td>
                <td style="color: #2d2a24; font-weight: 700; text-align: right; padding: 6px 0;">${formattedSlot}</td>
              </tr>
            </table>
          </div>
          <div style="text-align: center;">
            <a href="${portalUrl}" class="cta-btn">Open Admin Portal →</a>
          </div>
          <div class="footer">
            St. Mark Church • Instrument Reservation System<br>
            Automated member reply notification
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function sendNewMessageToAdminsEmail(
  data: NewMessageToAdminsEmailData,
): Promise<{ sent: boolean; error?: string; recipientCount?: number }> {
  const transport = getTransporter();
  if (!transport) {
    console.warn(
      "Gmail SMTP not configured: GMAIL_USER or GMAIL_APP_PASSWORD missing. Skipping new-message-to-admins email.",
    );
    return { sent: false, error: "Gmail SMTP not configured" };
  }
  try {
    const adminRows = await db
      .select({ email: admins.email })
      .from(admins)
      .where(eq(admins.approvalStatus, "approved"));
    const adminEmails = [
      ...new Set(
        adminRows
          .map((r) => (r.email || "").trim())
          .filter((e) => e.length > 0),
      ),
    ];
    if (adminEmails.length === 0) {
      return {
        sent: false,
        error: "No approved admin email addresses configured",
        recipientCount: 0,
      };
    }
    const subject = `New reply from ${data.memberName} — ${data.instrumentName}`;
    const html = buildNewMessageToAdminsHtml(data);
    const text = `${data.memberName} replied on a reservation:\n\n"${data.messageContent}"\n\nInstrument: ${data.instrumentName}\nSlot: ${formatSlotDateTime(data.startTime, data.endTime)}\n\nOpen admin portal: ${getPortalUrl()}`;
    await Promise.all(
      adminEmails.map((email) =>
        transport.sendMail({
          from: `"St. Mark Church Instrument Reservation" <${process.env.GMAIL_USER}>`,
          to: email,
          subject,
          html,
          text,
        }),
      ),
    );
    return { sent: true, recipientCount: adminEmails.length };
  } catch (err: any) {
    console.error("Error sending new-message-to-admins email:", err);
    return { sent: false, error: err.message };
  }
}
