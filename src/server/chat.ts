import { Router, Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";
import { db } from "../db/index.js";
import { instruments, reservations } from "../db/schema.js";
import { eq, and, sql, or } from "drizzle-orm";
import { validateSession } from "./session-manager.js";
import { getHardLimits } from "../services/reservation-logic.js";
import { getCairoDateString } from "../lib/date-utils.js";

const router = Router();

// Lazy initialization of GoogleGenAI client with required User-Agent header
let genAiClient: GoogleGenAI | null = null;
function getGenAiClient(): GoogleGenAI {
  if (!genAiClient) {
    genAiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return genAiClient;
}

interface ChatIncomingMessage {
  role: "user" | "assistant" | "model";
  content: string;
}

/**
 * Sanitize conversation history to strictly comply with Gemini multi-turn requirements:
 * 1. Must start with a 'user' turn.
 * 2. Must alternate between 'user' and 'model' (merge consecutive same-role turns).
 * 3. Must END with a 'user' turn (crucial for generateContent).
 * 4. Must not have empty parts.
 */
function sanitizeConversation(
  messages: ChatIncomingMessage[],
): Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> {
  const validTurns: Array<{ role: "user" | "model"; text: string }> = [];

  for (const msg of messages) {
    const text = msg.content?.trim();
    if (!text) continue;
    const role =
      msg.role === "assistant" || msg.role === "model" ? "model" : "user";

    // Merge consecutive turns of the same role
    if (
      validTurns.length > 0 &&
      validTurns[validTurns.length - 1].role === role
    ) {
      validTurns[validTurns.length - 1].text += `\n\n${text}`;
    } else {
      validTurns.push({ role, text });
    }
  }

  // Ensure first turn is from user
  if (validTurns.length === 0 || validTurns[0].role !== "user") {
    validTurns.unshift({
      role: "user",
      text: "Hello! Can you help me with instrument reservations?",
    });
  }

  // Ensure LAST turn is from user (Gemini API requires the prompt turn to be from the user)
  while (
    validTurns.length > 0 &&
    validTurns[validTurns.length - 1].role !== "user"
  ) {
    validTurns.pop();
  }

  if (validTurns.length === 0) {
    validTurns.push({
      role: "user",
      text: "How do I book an instrument in the church app?",
    });
  }

  return validTurns.map((turn) => ({
    role: turn.role,
    parts: [{ text: turn.text }],
  }));
}

/**
 * Intelligent contextual domain fallback if all cloud models are unreachable
 */
function generateContextualFallback(
  lastUserQuery: string,
  language: string,
  catalogSummary: string,
): string {
  const q = (lastUserQuery || "").toLowerCase();
  const isArabic =
    language === "ar" || /[\u0600-\u06FF]/.test(lastUserQuery || "");

  if (isArabic) {
    if (q.includes("كيف") || q.includes("حجز") || q.includes("طريقة")) {
      return `أهلاً بك! إليك خطوات حجز الآلات الموسيقية بكنيسة مارمرقس بكل سهولة:

1. **تسجيل الدخول**: تأكد من تسجيل دخولك بحسابك في الكنيسة.
2. **جدول المواعيد (Calendar)**: افتح صفحة الجدول لعرض الآلات والمواعيد المتاحة باللون الأخضر.
3. **مواعيد العمل الرسمية**: الحجز متاح يومياً من **9:00 صباحاً وحتى 10:00 مساءً**.
4. **تحديد نوع الحجز**:
   - **داخل الكنيسة (In-Church)**: مجاني تماماً (100%) لخدمات القداسات، التسبحة، بروفات الكورال، واجتماعات الشباب.
   - **خارج الكنيسة (Outside-Church)**: برسم يومي محدد لكل آلة، مع إرفاق إيصال تحويل InstaPay.
5. **تأكيد الحجز**: الآلات ذات الموافقة الفورية (Instant) تتأكد مباشرة إذا لم يكن هناك تعارض، أما اليدوية (Manual) فتُرسل للخدام للمراجعة.`;
    }

    if (q.includes("مواعيد") || q.includes("وقت") || q.includes("ساعات")) {
      return `مواعيد العمل وقواعد الوقت في الكنيسة:
- الحجز متاح حصرياً بين **9:00 صباحاً و 10:00 مساءً** بتوقيت القاهرة.
- أقصى مدة للحجز الفردي هي **5 ساعات**.
- لا يمكن لأي حجز أن يبدأ قبل 9 صباحاً أو ينتهي بعد 10 مساءً.`;
    }

    if (q.includes("خارج") || q.includes("رسوم") || q.includes("فلوس") || q.includes("instapay")) {
      return `الحجز خارج الكنيسة:
- الاستخدام خارج الكنيسة يكون برسم يومي محدد لكل آلة.
- يتم تثبيت الرسوم وقت تقديم الطلب ولا تتغير بعد ذلك.
- يلزم تأكيد الموافقة على الرسوم وإرفاق إيصال التحويل عبر **InstaPay**.
- الاستخدام داخل الكنيسة لخدمات الكنيسة مجاني 100%.`;
    }

    if (q.includes("دوري") || q.includes("متكرر") || q.includes("series")) {
      return `الحجز الدوري (Recurring Series):
- يمكنك حجز موعد متكرر (مثلاً كل أحد للقداس أو كل أربعاء لبروفة الكورال) من خلال زر "Recurring Series" في أعلى الجدول.
- الحد الأقصى للمواعيد في السلسلة الواحدة هو **8 مواعيد**.
- يتم فحص كل موعد في السلسلة للتأكد من عدم وجود تعارض مع حجز معتمد آخر.`;
    }

    return `أهلاً بك! أنا ديفيد، مساعدك لحجز الآلات الموسيقية بكنيسة مارمرقس.
يمكنك الاستفادة من الخيارات التالية:
- **جدول المواعيد**: تصفح الآلات واختيار موعد بين 9 صباحاً و 10 مساءً.
- **حجوزاتي**: متابعة حالة طلباتك (معتمد / قيد المراجعة / ملغي).
- **محضر الاستلام والفحص**: فحص حالة الآلة وملحقاتها عند الاستلام والتسليم.
الآلات المتاحة حالياً:\n${catalogSummary}`;
  } else {
    // English
    if (q.includes("how") || q.includes("book") || q.includes("reserve") || q.includes("steps")) {
      return `Hello! Here is how to easily book an instrument at St. Mark Church:

1. **Sign In**: Ensure you are logged into your account.
2. **Calendar View**: Go to the Calendar to see available instruments and open time slots.
3. **Working Hours**: Bookings are available strictly between **9:00 AM and 10:00 PM**.
4. **Choose Usage Type**:
   - **In-Church**: 100% Free for liturgies, choir rehearsals, and prayer meetings.
   - **Outside-Church**: Paid per-day fee with InstaPay payment receipt.
5. **Confirm**: Instant-mode instruments confirm immediately; Manual-mode instruments are submitted for admin review.`;
    }

    if (q.includes("hour") || q.includes("time") || q.includes("rules")) {
      return `Church Working Hours & Slot Limits:
- Hours are strictly **9:00 AM – 10:00 PM** (Cairo time).
- Maximum duration per single slot is **5 hours**.
- Up to **5 active reservations** allowed at a time per member.`;
    }

    if (q.includes("fee") || q.includes("outside") || q.includes("cost") || q.includes("pay")) {
      return `Outside Church Bookings & Fees:
- In-Church use is always **100% Free** for all church services.
- Outside-Church use requires a daily fee set per instrument (locked upon submission).
- An InstaPay transfer confirmation receipt must be attached upon submitting an outside booking.`;
    }

    if (q.includes("series") || q.includes("repeat") || q.includes("recurring")) {
      return `Recurring Series Builder:
- Use the **Recurring Series** button at the top of the Calendar to book repeating services (e.g. weekly choir or liturgies).
- Capped at **8 dates** per series.
- Every date is automatically checked for scheduling conflicts against existing approved bookings.`;
    }

    return `Hello! I am David, your AI Reservation Assistant for St. Mark Church.
I can help guide you through:
- **Calendar**: Browse available instruments and slots (9 AM - 10 PM).
- **My Reservations**: View, edit, or check approval status on your bookings.
- **Condition Check**: Inspect instrument condition and accessories upon handover.

Currently Available Instruments:\n${catalogSummary}`;
  }
}

/**
 * POST /api/chat
 * Multi-turn AI Assistant for St. Mark Church Instrument Reservation System
 */
router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const { messages, userLanguage = "en", clientContext } = req.body as {
      messages?: ChatIncomingMessage[];
      userLanguage?: string;
      clientContext?: {
        activeTab?: string;
        selectedInstrumentName?: string;
      };
    };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({
        success: false,
        error: "Missing or invalid 'messages' array in request body.",
      });
      return;
    }

    // 1. Session & User Identification (Safe extraction)
    let userContextStr = "User is browsing as Guest / Member.";
    let currentUser: any = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      if (token && token !== "undefined" && token !== "null") {
        try {
          const sessionResult = await validateSession(token);
          if (sessionResult.valid && sessionResult.session) {
            currentUser = sessionResult.session.user;
            const role = sessionResult.session.role;
            const isTrusted = currentUser?.isTrusted
              ? "YES (Trusted Member - auto-approved bookings)"
              : "No";
            userContextStr = `Current logged-in user:
- Name: ${currentUser?.name || "User"}
- Phone: ${currentUser?.phoneNumber || "N/A"}
- Role: ${role}
- Trusted Privilege: ${isTrusted}`;
          }
        } catch (sessionErr) {
          // Non-fatal; continue as guest
          console.warn("[Chat] Session check notice:", sessionErr);
        }
      }
    }

    // 2. Fetch live data from PostgreSQL for domain accuracy
    let catalogSummary = "• Grand Piano (Sanctuary) - Manual mode\n• Acoustic Guitar #1 - Instant mode";
    let limitsSummary = "";
    let userActiveReservationsCount = 0;

    try {
      const allInstruments = await db
        .select({
          id: instruments.id,
          name: instruments.name,
          type: instruments.type,
          bookingMode: instruments.bookingMode,
          outsideFeePerDay: instruments.outsideFeePerDay,
          description: instruments.description,
        })
        .from(instruments)
        .where(eq(instruments.isRemoved, false));

      if (allInstruments.length > 0) {
        catalogSummary = allInstruments
          .map(
            (inst) =>
              `• ${inst.name} [Type: ${inst.type}] - Mode: ${inst.bookingMode.toUpperCase()} - Outside Church Fee: ${inst.outsideFeePerDay || 0} EGP/day`,
          )
          .join("\n");
      }

      const limits = await getHardLimits();
      limitsSummary = `Current System Hard Limits:
- Max Active Reservations per user: ${limits.max_active_reservations} (Pending + Approved)
- Max Reservations Per Day: ${limits.max_reservations_per_day}
- Max Duration Per Slot: ${limits.max_duration_hours} hours
- Max Concurrent per same instrument type: ${limits.max_concurrent_per_type}
- Max Occurrences in a Recurring Series: ${limits.max_series_occurrences} dates
- Max Submissions Per Hour: ${limits.max_submissions_per_hour}`;

      if (currentUser?.id) {
        const activeRes = await db
          .select({ id: reservations.id })
          .from(reservations)
          .where(
            and(
              eq(reservations.userId, currentUser.id),
              or(
                eq(reservations.status, "pending"),
                eq(reservations.status, "approved"),
              ),
            ),
          );
        userActiveReservationsCount = activeRes.length;
      }
    } catch (dbErr) {
      console.warn("[Chat] Notice fetching DB context for assistant:", dbErr);
    }

    // 3. Build comprehensive System Instruction giving specific role & domain rules
    const systemInstruction = `You are "David", the intelligent, friendly, and knowledgeable AI Assistant for the St. Mark Church Musical Instrument Reservation System (المساعد الذكي لكنيسة مارمرقس لحجز الآلات الموسيقية).

### YOUR ROLE & MISSION
Your mission is to guide musicians, deacons, choir members, ministry leaders, and admins through their instrument reservation journey, help them use all features of the app effortlessly, explain church policies and rules, and troubleshoot any booking questions.

### SYSTEM POLICIES & ESSENTIAL RULES
1. **Working Hours**: Reservations are strictly limited to **9:00 AM – 10:00 PM** (Cairo time). No reservation can start before 9:00 AM or end after 10:00 PM.
2. **Usage Types**:
   - **In-Church (داخل الكنيسة)**: 100% Free. For church liturgies, prayer meetings, choir rehearsals, and youth meetings.
   - **Outside-Church (خارج الكنيسة)**: Paid per day. The fee is specified per instrument in Egyptian Pounds (EGP). When booking outside church, users must agree to the fee and provide an InstaPay transaction receipt proof. The fee is locked at submission time.
3. **Approval Modes**:
   - **Instant (فوري)**: If the user is under the soft limits and there is no conflicting approved slot, the reservation is auto-approved immediately.
   - **Manual (يدوي)**: Sent to admins as "Pending" until an admin reviews and approves/rejects it.
   - **Trusted Users & Admins**: Users granted "Trusted User" status by the Super Admin or church admins always get Instant Auto-Approval on all instruments (both Instant and Manual) and bypass soft limits, provided there is no conflicting approved booking.
4. **Recurring Series Builder (حجز دوري)**:
   - Users can book a recurring slot (e.g. every Sunday liturgy or choir rehearsal on Wednesdays).
   - Occurrences are capped at 8 dates per series.
   - If even one date in the series conflicts with an already-approved booking, that slot will be flagged or rejected.
5. **Conflict Rule (قاعدة التعارض)**:
   - No two approved reservations can ever occupy the same instrument at an overlapping time.
6. **Condition Check & Handover Sheet (محضر استلام وفحص الآلة)**:
   - Before taking an instrument and upon returning it, users and admins can record condition checks (body, strings/keys, accessories, power supply/cables, cases) to keep the church instruments well-maintained.
7. **Musician Ministry Profile (الملف الموسيقي والخدمة)**:
   - Musicians can register their experience, primary instruments, and church ministries in their profile.
8. **App Navigation Guide**:
   - **Calendar View**: Browse instruments, tap any available hour slot to start a reservation.
   - **My Reservations**: View your Pending, Approved, Completed, or Rejected bookings, edit details, or cancel.
   - **Series Builder**: Click the "Recurring Series" button at the top of the calendar to book multi-date schedules.
   - **Notifications (Bell icon)**: Instant alerts when an admin approves, rejects, or comments on your booking.

### CURRENT LIVE CONTEXT
- Today's date: ${getCairoDateString()}
- ${userContextStr}
- User's currently active bookings: ${userActiveReservationsCount}
${limitsSummary ? `\n- ${limitsSummary}` : ""}

### AVAILABLE INSTRUMENT CATALOG
${catalogSummary}

### LANGUAGE & TONE INSTRUCTIONS
- You are fluently bilingual (Arabic and English).
- Detect the user's language: If the user writes in Arabic, respond in clear, warm, polite Arabic (Egyptian church community tone or standard Arabic). If they write in English, respond in English.
- Always be encouraging, warm, respectful, concise, and structured. Use bullet points and bold text where helpful.
- If a user wants to book, tell them the exact steps (e.g. Go to the Calendar, pick the instrument, tap the time slot, choose In-Church or Outside-Church, and tap Confirm).
- Never invent instruments that are not in the catalog; refer to the real instruments listed above.`;

    // 4. Sanitize and format multi-turn contents
    const contents = sanitizeConversation(messages);
    const lastUserMessage =
      messages.filter((m) => m.role === "user").pop()?.content || "";

    // 5. Multi-model resilience: Primary gemini-3.8-flash, with automatic fallback
    // to gemini-3.5-flash and gemini-3.1-flash-lite if temporary 503 high demand occurs
    const ai = getGenAiClient();
    const candidateModels = [
      "gemini-3.8-flash",
      "gemini-3.5-flash",
      "gemini-3.1-flash-lite",
    ];

    let replyText = "";
    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction,
            temperature: 0.7,
            topP: 0.9,
          },
        });

        if (response.text && response.text.trim()) {
          replyText = response.text.trim();
          break; // Succeeded!
        }
      } catch (modelErr: any) {
        console.warn(
          `[Chat Assistant] Notice with model ${modelName}:`,
          modelErr.message || modelErr,
        );
        lastError = modelErr;
        // Continue to fallback model
      }
    }

    // 6. If all cloud models failed (e.g. total cloud outage), use smart domain fallback
    if (!replyText) {
      console.warn(
        "[Chat Assistant] All models failed, providing intelligent domain fallback. Last error:",
        lastError?.message || lastError,
      );
      replyText = generateContextualFallback(
        lastUserMessage,
        userLanguage,
        catalogSummary,
      );
    }

    res.json({
      success: true,
      message: {
        role: "assistant",
        content: replyText,
      },
    });
  } catch (error: any) {
    console.error("[Chat Assistant Fatal Catch]:", error);
    // Never send an empty dead-end; always provide a helpful guidance reply
    const fallbackText = generateContextualFallback(
      "",
      req.body?.userLanguage || "en",
      "• Grand Piano (Sanctuary)\n• Acoustic Guitar #1",
    );

    res.json({
      success: true,
      message: {
        role: "assistant",
        content: fallbackText,
      },
      notice: "Generated from offline domain knowledge engine",
    });
  }
});

export default router;
