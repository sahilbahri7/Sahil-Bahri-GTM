import { Resend } from "resend";

const OWNER_EMAIL = "sahil@revosys.pro";
const FROM = "Revo-Sys Website <sahil@revosys.pro>";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "RESEND_API_KEY is not configured" });
  }

  const { name, email, company, message, budget } = req.body || {};

  if (!name || !email || !message) {
    return res.status(400).json({ error: "Missing required fields: name, email, message" });
  }

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email address" });
  }

  try {
    const resend = new Resend(apiKey);

    // 1. Notify the owner
    const ownerHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0e0e0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0e0c;padding:48px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#161614;border:1px solid #2a2a26;border-radius:16px;overflow:hidden;max-width:560px;width:100%;">
        <tr><td style="padding:28px 40px;border-bottom:1px solid #2a2a26;">
          <span style="font-family:Georgia,serif;font-size:20px;font-style:italic;color:#e8e0d4;">Revo</span><span style="font-family:monospace;font-size:11px;color:#c4a265;letter-spacing:0.15em;text-transform:uppercase;margin-left:2px;">-Sys</span>
          <span style="font-family:monospace;font-size:10px;color:#6b6b5a;letter-spacing:0.15em;text-transform:uppercase;margin-left:12px;">New Enquiry</span>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <h1 style="margin:0 0 24px;font-family:Georgia,serif;font-size:26px;font-weight:400;font-style:italic;color:#e8e0d4;line-height:1.3;">New contact form submission</h1>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:10px 0;border-bottom:1px solid #2a2a26;">
              <span style="font-family:monospace;font-size:10px;color:#6b6b5a;letter-spacing:0.12em;text-transform:uppercase;">Name</span><br/>
              <span style="font-size:15px;color:#e8e0d4;margin-top:4px;display:block;">${escapeHtml(name)}</span>
            </td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #2a2a26;">
              <span style="font-family:monospace;font-size:10px;color:#6b6b5a;letter-spacing:0.12em;text-transform:uppercase;">Email</span><br/>
              <a href="mailto:${escapeHtml(email)}" style="font-size:15px;color:#c4a265;margin-top:4px;display:block;">${escapeHtml(email)}</a>
            </td></tr>
            ${company ? `<tr><td style="padding:10px 0;border-bottom:1px solid #2a2a26;">
              <span style="font-family:monospace;font-size:10px;color:#6b6b5a;letter-spacing:0.12em;text-transform:uppercase;">Company</span><br/>
              <span style="font-size:15px;color:#e8e0d4;margin-top:4px;display:block;">${escapeHtml(company)}</span>
            </td></tr>` : ""}
            ${budget ? `<tr><td style="padding:10px 0;border-bottom:1px solid #2a2a26;">
              <span style="font-family:monospace;font-size:10px;color:#6b6b5a;letter-spacing:0.12em;text-transform:uppercase;">Budget Range</span><br/>
              <span style="font-size:15px;color:#e8e0d4;margin-top:4px;display:block;">${escapeHtml(budget)}</span>
            </td></tr>` : ""}
            <tr><td style="padding:10px 0;">
              <span style="font-family:monospace;font-size:10px;color:#6b6b5a;letter-spacing:0.12em;text-transform:uppercase;">Message</span><br/>
              <span style="font-size:15px;color:#b8b0a4;margin-top:8px;display:block;line-height:1.7;white-space:pre-wrap;">${escapeHtml(message)}</span>
            </td></tr>
          </table>
          <table cellpadding="0" cellspacing="0" style="margin-top:28px;">
            <tr><td style="border-radius:8px;background:#e8e0d4;">
              <a href="mailto:${escapeHtml(email)}" style="display:inline-block;padding:12px 28px;font-family:-apple-system,sans-serif;font-size:13px;font-weight:600;color:#0e0e0c;text-decoration:none;border-radius:8px;">Reply to ${escapeHtml(name)} →</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #2a2a26;">
          <p style="margin:0;font-family:monospace;font-size:10px;color:#4a4a3a;letter-spacing:0.08em;">REVOSYS.PRO · CONTACT FORM · ${new Date().toUTCString()}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // 2. Confirmation to sender
    const senderHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0e0e0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0e0c;padding:48px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#161614;border:1px solid #2a2a26;border-radius:16px;overflow:hidden;max-width:560px;width:100%;">
        <tr><td style="padding:28px 40px;border-bottom:1px solid #2a2a26;">
          <span style="font-family:Georgia,serif;font-size:20px;font-style:italic;color:#e8e0d4;">Revo</span><span style="font-family:monospace;font-size:11px;color:#c4a265;letter-spacing:0.15em;text-transform:uppercase;margin-left:2px;">-Sys</span>
        </td></tr>
        <tr><td style="padding:36px 40px;">
          <p style="margin:0 0 8px;font-family:monospace;font-size:11px;color:#6b6b5a;letter-spacing:0.12em;text-transform:uppercase;">Hi ${escapeHtml(name)},</p>
          <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:26px;font-weight:400;font-style:italic;color:#e8e0d4;line-height:1.3;">Got your message.</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#9a9a7a;line-height:1.8;">Thanks for reaching out. I'll review your message and get back to you within 1 business day. In the meantime, feel free to explore the blog or check out the case studies on the site.</p>
          <table cellpadding="0" cellspacing="0">
            <tr><td style="border-radius:8px;background:#e8e0d4;">
              <a href="https://revosys.pro/blog" style="display:inline-block;padding:12px 28px;font-family:-apple-system,sans-serif;font-size:13px;font-weight:600;color:#0e0e0c;text-decoration:none;border-radius:8px;">Read the Blog →</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #2a2a26;">
          <p style="margin:0;font-family:monospace;font-size:10px;color:#4a4a3a;letter-spacing:0.08em;line-height:1.8;">REVO-SYS · GTM PLATFORM · REVOSYS.PRO</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // Send both emails in parallel
    const [ownerResult, senderResult] = await Promise.allSettled([
      resend.emails.send({
        from: FROM,
        to: [OWNER_EMAIL],
        replyTo: email,
        subject: `New enquiry from ${name}${company ? ` (${company})` : ""}`,
        html: ownerHtml,
      }),
      resend.emails.send({
        from: FROM,
        to: [email],
        subject: "Got your message — Revo-Sys",
        html: senderHtml,
      }),
    ]);

    if (ownerResult.status === "rejected") {
      console.error("Owner email failed:", ownerResult.reason);
      return res.status(500).json({ error: "Failed to send notification email" });
    }

    return res.status(200).json({
      success: true,
      id: ownerResult.value?.data?.id,
    });

  } catch (err) {
    console.error("contact.js crash:", err?.message);
    return res.status(500).json({ error: err?.message || "Unexpected error" });
  }
}

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
