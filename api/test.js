export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    node: process.version,
    hasApiKey: !!process.env.RESEND_API_KEY,
    hasSecret: !!process.env.MAGIC_SECRET,
    appUrl: process.env.APP_URL || "(not set)",
  });
}
