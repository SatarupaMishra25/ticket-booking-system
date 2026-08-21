import QRCode from "qrcode";
import nodemailer from "nodemailer";
import { Resend } from "resend";
import { APP_URL } from "@/lib/config";

/**
 * Two delivery backends, chosen by EMAIL_PROVIDER (or auto-detected):
 *
 *   smtp   — any SMTP account, e.g. Gmail with an App Password.  Delivers to
 *            ANY recipient, which is what a live demo needs.
 *   resend — Resend's API.  On their free tier without a verified domain this
 *            only delivers to the account owner's own address.
 *
 * Both are optional: with neither configured the app still works and simply
 * logs what it would have sent, so the project runs from a fresh clone.
 */

type Provider = "smtp" | "resend" | "none";

function pickProvider(): Provider {
  const explicit = process.env.EMAIL_PROVIDER?.toLowerCase();
  const hasSmtp = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
  const hasResend = !!process.env.RESEND_API_KEY;

  if (explicit === "smtp") return hasSmtp ? "smtp" : "none";
  if (explicit === "resend") return hasResend ? "resend" : "none";
  if (hasSmtp) return "smtp";
  if (hasResend) return "resend";
  return "none";
}

const FROM = process.env.EMAIL_FROM ?? "Ticket Booking <onboarding@resend.dev>";

let smtpTransport: nodemailer.Transporter | null = null;
function smtp() {
  if (!smtpTransport) {
    smtpTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT ?? 465),
      secure: Number(process.env.SMTP_PORT ?? 465) === 465,
      auth: {
        user: process.env.SMTP_USER!,
        // App Passwords are displayed in groups of four; strip the spaces.
        pass: process.env.SMTP_PASS!.replace(/\s+/g, ""),
      },
    });
  }
  return smtpTransport;
}

let resendClient: Resend | null = null;
function resend() {
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY!);
  return resendClient;
}

// ---------------------------------------------------------------------------
// QR codes
// ---------------------------------------------------------------------------

/** Renders the booking reference as a PNG QR code. */
export function renderQrPng(reference: string): Promise<Buffer> {
  return QRCode.toBuffer(reference, {
    type: "png",
    width: 320,
    margin: 2,
    errorCorrectionLevel: "M",
  });
}

/** Same QR as a data URI, for showing on the confirmation page in-browser. */
export function renderQrDataUrl(reference: string): Promise<string> {
  return QRCode.toDataURL(reference, { width: 320, margin: 2, errorCorrectionLevel: "M" });
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

export type SendResult = { sent: boolean; provider: Provider; reason?: string };

const QR_CID = "ticket-qr";

async function send(opts: {
  to: string;
  subject: string;
  /** Receives the cid to reference inline, or null when inlining is unavailable. */
  html: (qrCid: string | null) => string;
  qr?: { filename: string; content: Buffer };
}): Promise<SendResult> {
  const provider = pickProvider();

  if (provider === "none") {
    console.warn(
      `[email] no provider configured — skipped "${opts.subject}" to ${opts.to}`,
    );
    return { sent: false, provider, reason: "No email provider configured" };
  }

  try {
    if (provider === "smtp") {
      // Nodemailer supports true inline images, so the QR renders in the body.
      await smtp().sendMail({
        from: FROM,
        to: opts.to,
        subject: opts.subject,
        html: opts.html(opts.qr ? QR_CID : null),
        attachments: opts.qr
          ? [{ filename: opts.qr.filename, content: opts.qr.content, cid: QR_CID }]
          : undefined,
      });
      return { sent: true, provider };
    }

    // Resend: send the QR as a normal attachment and omit the inline <img>,
    // rather than emitting a cid: reference that would render as a broken image.
    const { error } = await resend().emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html(null),
      attachments: opts.qr
        ? [{ filename: opts.qr.filename, content: opts.qr.content.toString("base64") }]
        : undefined,
    });
    if (error) {
      console.error("[email] Resend rejected the message:", error);
      return { sent: false, provider, reason: error.message };
    }
    return { sent: true, provider };
  } catch (err) {
    // Delivery must never take down a booking that is already committed.
    console.error("[email] send failed:", err);
    return { sent: false, provider, reason: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const shell = (title: string, body: string) => `
<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#f4f4f5;padding:32px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e4e4e7">
    <div style="background:#18181b;color:#fff;padding:20px 28px;font-size:17px;font-weight:600">${title}</div>
    <div style="padding:28px;color:#27272a;font-size:15px;line-height:1.6">${body}</div>
  </div>
</div>`;

const money = (paise: number) => `Rs ${(paise / 100).toLocaleString("en-IN")}`;

const when = (d: Date) =>
  d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

const row = (label: string, value: string, bold = false) =>
  `<tr><td style="padding:6px 0;color:#71717a">${label}</td><td style="text-align:right${bold ? ";font-weight:600" : ""}">${value}</td></tr>`;

/** Confirmation email carrying the QR ticket. */
export async function sendTicketEmail(opts: {
  to: string;
  name: string;
  reference: string;
  eventTitle: string;
  venue: string;
  startsAt: Date;
  seats: string[];
  total: number;
}): Promise<SendResult> {
  const png = await renderQrPng(opts.reference);

  return send({
    to: opts.to,
    subject: `Booking confirmed — ${opts.eventTitle} (${opts.reference})`,
    qr: { filename: `ticket-${opts.reference}.png`, content: png },
    html: (cid) =>
      shell(
        "Your ticket",
        `
    <p>Hi ${opts.name}, your booking is confirmed.</p>
    <table style="width:100%;border-collapse:collapse;margin:18px 0">
      ${row("Event", opts.eventTitle, true)}
      ${row("Venue", opts.venue)}
      ${row("When", when(opts.startsAt))}
      ${row("Seats", opts.seats.join(", "), true)}
      ${row("Total", money(opts.total), true)}
    </table>
    <div style="text-align:center;padding:20px;background:#fafafa;border-radius:10px">
      ${cid ? `<img src="cid:${cid}" alt="QR ticket" width="200" height="200" style="display:block;margin:0 auto" />` : ""}
      <div style="margin-top:10px;font-family:ui-monospace,monospace;font-size:15px;letter-spacing:1px">${opts.reference}</div>
      <div style="color:#71717a;font-size:12px;margin-top:4px">
        ${cid ? "Show this QR code at the gate" : "Your QR ticket is attached to this email"}
      </div>
    </div>`,
      ),
  });
}

/** Time-limited waitlist offer email. */
export async function sendWaitlistOfferEmail(opts: {
  to: string;
  name: string;
  eventTitle: string;
  categoryName: string;
  seatLabel: string;
  token: string;
  expiresAt: Date;
}): Promise<SendResult> {
  const link = `${APP_URL}/offer/${opts.token}`;

  return send({
    to: opts.to,
    subject: `A seat opened up — ${opts.eventTitle}`,
    html: () =>
      shell(
        "You're off the waitlist",
        `
    <p>Hi ${opts.name}, a seat just opened up.</p>
    <p>A <strong>${opts.categoryName}</strong> seat (<strong>${opts.seatLabel}</strong>) for
       <strong>${opts.eventTitle}</strong> has been reserved for you because you were next on the waitlist.</p>
    <p style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px">
       This offer expires at <strong>${when(opts.expiresAt)}</strong>.
       After that the seat goes to the next person in the queue.</p>
    <p style="text-align:center;margin:26px 0">
      <a href="${link}" style="background:#18181b;color:#fff;text-decoration:none;padding:13px 26px;border-radius:8px;display:inline-block;font-weight:600">Complete your booking</a>
    </p>
    <p style="color:#71717a;font-size:12px;word-break:break-all">Or paste this link: ${link}</p>`,
      ),
  });
}

/** Confirmation that a booking was cancelled. */
export async function sendCancellationEmail(opts: {
  to: string;
  name: string;
  reference: string;
  eventTitle: string;
}): Promise<SendResult> {
  return send({
    to: opts.to,
    subject: `Booking cancelled — ${opts.reference}`,
    html: () =>
      shell(
        "Booking cancelled",
        `
    <p>Hi ${opts.name}, your booking <strong>${opts.reference}</strong> for
       <strong>${opts.eventTitle}</strong> has been cancelled.</p>
    <p>The seats have been returned to the pool and offered to the next customer on the waitlist.</p>`,
      ),
  });
}
