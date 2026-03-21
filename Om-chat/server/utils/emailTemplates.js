/**
 * Build OTP email subject, text, and HTML.
 * @param {{ username: string, otp: string, expiryMinutes?: number }} options
 * @returns {{ subject: string, text: string, html: string }}
 */
function otpEmailTemplate({ username, otp, expiryMinutes = 10 }) {
  const subject = `${otp} is your Om Chat verification code`;

  const text = [
    `Hi ${username},`,
    '',
    `Your Om Chat verification code is: ${otp}`,
    '',
    `This code expires in ${expiryMinutes} minutes.`,
    'Do not share this code with anyone.',
    '',
    'If you did not create an Om Chat account, ignore this email.'
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:14px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <tr>
          <td style="background:#5865F2;padding:28px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;
                       letter-spacing:-0.3px;">Om Chat</h1>
          </td>
        </tr>

        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 8px;font-size:15px;color:#374151;">
              Hi <strong>${escapeHtml(username)}</strong>,
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:#6b7280;">
              Use the code below to verify your Om Chat account.
            </p>

            <div style="background:#eef0ff;border:2px dashed #5865F2;
                        border-radius:12px;padding:28px;text-align:center;
                        margin-bottom:28px;">
              <p style="margin:0 0 6px;font-size:12px;color:#5865F2;
                         text-transform:uppercase;letter-spacing:1px;font-weight:600;">
                Your verification code
              </p>
              <p style="margin:0;font-size:48px;font-weight:800;
                         letter-spacing:14px;color:#5865F2;font-family:monospace;">
                ${escapeHtml(otp)}
              </p>
            </div>

            <p style="margin:0 0 6px;font-size:13px;color:#9ca3af;text-align:center;">
              Expires in <strong>${expiryMinutes} minutes</strong>
            </p>
            <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">
              Never share this code with anyone.
            </p>
          </td>
        </tr>

        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #e5e7eb;
                     text-align:center;">
            <p style="margin:0;font-size:12px;color:#d1d5db;">
              If you didn't request this, you can safely ignore this email.<br>
              (c) Om Chat · Do not reply to this email
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

/**
 * Build owner-forward OTP email content for manual relay.
 * @param {{ username: string, email: string, otp: string, expiryMinutes?: number }} options
 * @returns {{ subject: string, text: string, html: string }}
 */
function ownerRelayOtpEmailTemplate({ username, email, otp, expiryMinutes = 10 }) {
  const safeEmail = String(email || '').trim().toLowerCase();
  const safeUsername = String(username || 'user').trim() || 'user';
  const subject = `Manual OTP for ${safeEmail || safeUsername}`;

  const text = [
    'Om Chat manual OTP relay',
    '',
    `For email: ${safeEmail}`,
    `Username: ${safeUsername}`,
    `OTP: ${otp}`,
    `Expires in: ${expiryMinutes} minutes`,
    '',
    'Send this OTP manually to the user.'
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#101114;font-family:Arial,sans-serif;color:#f5f7fb;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#181a20;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
        <tr>
          <td style="padding:24px 28px;background:#252937;">
            <h1 style="margin:0;font-size:22px;color:#ffffff;">Om Chat Manual OTP</h1>
            <p style="margin:8px 0 0;color:#c7cfdd;font-size:14px;">Forward this code manually to the user.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <p style="margin:0 0 10px;font-size:14px;color:#c7cfdd;">For email:</p>
            <p style="margin:0 0 18px;font-size:18px;font-weight:700;color:#ffffff;">${escapeHtml(safeEmail)}</p>
            <p style="margin:0 0 10px;font-size:14px;color:#c7cfdd;">Username:</p>
            <p style="margin:0 0 18px;font-size:16px;font-weight:600;color:#ffffff;">${escapeHtml(safeUsername)}</p>
            <div style="padding:24px;border-radius:14px;background:#0f1530;border:1px dashed #6d84ff;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#8ea0ff;font-weight:700;">OTP</p>
              <p style="margin:0;font-size:42px;letter-spacing:12px;font-family:monospace;font-weight:800;color:#ffffff;">${escapeHtml(otp)}</p>
            </div>
            <p style="margin:18px 0 0;font-size:13px;color:#c7cfdd;">Expires in ${expiryMinutes} minutes.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char] || char));
}

module.exports = { otpEmailTemplate, ownerRelayOtpEmailTemplate };
