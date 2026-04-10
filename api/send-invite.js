import { Resend } from "resend";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);
const SECRET = process.env.MAGIC_SECRET || "dev-fallback-change-in-prod";

const APP_URL = process.env.APP_URL || "https://sahilbahri.vercel.app";
const FROM = "Sahil Bahri <sahil@revosys.pro>";

// Generate a tamper-proof signed token containing the email + expiry.
// No database needed — verified purely by HMAC signature.
function generateToken(email) {
  const payload = Buffer.from(
    JSON.stringify({ email: email.toLowerCase(), exp: Date.now() + 24 * 60 * 60 * 1000 })
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { to, name, type } = req.body;

  if (!to) {
    return res.status(400).json({ error: "Missing recipient email" });
  }

  const token = generateToken(to);
  const magicLink = `${APP_URL}?token=${token}`;
  const isInvite = type === "invite";

  const subject = isInvite
    ? "You've been invited to the S.Bahri Client Portal"
    : "Your login link for S.Bahri Portal";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
</head>
<body style="margin:0;padding:0;background:#0e0e0c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0e0c;padding:48px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#161614;border:1px solid #2a2a26;border-radius:16px;overflow:hidden;max-width:560px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="padding:36px 40px 28px;border-bottom:1px solid #2a2a26;">
              <span style="font-family:Georgia,serif;font-size:22px;font-style:italic;color:#e8e0d4;letter-spacing:-0.5px;">S.Bahri</span>
              <span style="font-family:monospace;font-size:10px;color:#6b6b5a;letter-spacing:0.15em;text-transform:uppercase;margin-left:12px;">GTM Consulting</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              ${name ? `<p style="margin:0 0 8px;font-family:monospace;font-size:11px;color:#6b6b5a;letter-spacing:0.12em;text-transform:uppercase;">Hi ${name},</p>` : ""}
              <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:28px;font-weight:400;font-style:italic;color:#e8e0d4;line-height:1.3;">
                ${isInvite ? "You've been invited to your client workspace" : "Your secure login link"}
              </h1>
              <p style="margin:0 0 32px;font-size:15px;color:#9a9a7a;line-height:1.8;">
                ${isInvite
                  ? "Sahil Bahri has created a workspace for you to track project progress, review proposals, approve scopes, and access deliverables."
                  : "Click the button below to sign in to your workspace. This link expires in 24 hours and is single-use."
                }
              </p>
              <!-- CTA -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background:#e8e0d4;">
                    <a href="${magicLink}" style="display:inline-block;padding:14px 32px;font-family:-apple-system,sans-serif;font-size:14px;font-weight:600;color:#0e0e0c;text-decoration:none;border-radius:8px;">
                      ${isInvite ? "Access Your Workspace" : "Sign In to Portal"}
                    </a>
                  </td>
                </tr>
              </table>
              <!-- Link fallback -->
              <p style="margin:28px 0 0;font-size:12px;color:#6b6b5a;line-height:1.7;">
                If the button doesn't work, copy and paste this link into your browser:<br/>
                <a href="${magicLink}" style="color:#c4a265;word-break:break-all;">${magicLink}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #2a2a26;">
              <p style="margin:0;font-family:monospace;font-size:10px;color:#4a4a3a;letter-spacing:0.08em;line-height:1.8;">
                THIS LINK EXPIRES IN 24 HOURS AND IS SINGLE-USE.<br/>
                IF YOU DID NOT REQUEST THIS, YOU CAN SAFELY IGNORE THIS EMAIL.<br/><br/>
                S.BAHRI GTM CONSULTING · REVOSYS.PRO · SAHIL@REVOSYS.PRO
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, id: data?.id });
  } catch (err) {
    console.error("Send error:", err);
    return res.status(500).json({ error: "Failed to send email" });
  }
}
