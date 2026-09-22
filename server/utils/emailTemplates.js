const emailTemplates = (email, name, password) => {
  const userMailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Welcome to WONO!",
    html: renderNotificationEmail({
      heroTitle: "Welcome to WONO!",
      heroSubtitle: "Your account has been created successfully.",
      greetingHtml: `
        <p style="margin:0 0 4px;">Hello ${name},</p>
        <p class="email-text" style="margin:0;">Thank you for registering with WONO. We'll be in touch within 24 hours.</p>
      `,
      detailsTitle: "Your Login Details",
      detailRows: [
        ["Email", email],
        ["Password", password],
      ],
      noteHtml:
        "For your security, we recommend changing your password after your first login.",
    }),
  };

  return userMailOptions;
};

function toDMY(isoDateOnly) {
  if (!isoDateOnly) return "-";
  const [yyyy, mm, dd] = isoDateOnly.split("-");
  if (!yyyy || !mm || !dd) return "-";
  return `${dd}-${mm}-${yyyy}`;
}

function referenceDateStamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}${get("month")}${get("day")}`;
}

function formatSubmittedOn(date = new Date()) {
  const tz = "Asia/Kolkata";
  const submittedDate = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  const submittedTime = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
  return { submittedDate, submittedTime };
}

function formatLongDate(dateInput) {
  if (!dateInput) return "-";
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

const EMAIL_LOGO_URL = "https://www.wono.co/email-logo-wono.svg";
const EMAIL_LOGO_DARK_URL = "https://www.wono.co/email-logo-wono-dark.svg";

/**
 * Shared shell for all WONO transactional emails: logo header, blue/white
 * checkmark hero, dark-mode-aware styling, contact band, and footer.
 * Only the hero copy and the sections you actually pass in vary per email
 * type — everything else (top logo bar and bottom footer) stays identical
 * across templates. Mirrors backend/utils/emailTemplates.js in the Nomads
 * repo — keep both in sync when the shell changes.
 *
 * Every base (light-mode) color is set inline, not just via CSS class —
 * Gmail and several other clients strip <style> blocks in parts of their
 * rendering pipeline, so class-only colors can silently disappear. The
 * @media (prefers-color-scheme: dark) block layers dark-mode overrides on
 * top for clients that support it; clients that don't just keep the inline
 * light-mode colors, which is the correct fallback.
 */
function renderNotificationEmail({
  heroTitle,
  heroSubtitle,
  greetingHtml,
  referenceLabel,
  referenceValue,
  detailsTitle = "Your Details",
  detailRows = [],
  otpCode,
  totalPayable,
  ctaButton,
  whatNextTitle = "What Happens Next?",
  whatNextItems = [],
  noteTitle,
  noteHtml,
  signOffHtml,
  bodyHtml,
}) {
  const detailRowsHtml = detailRows
    .map(
      ([label, value], index) => `
      <tr>
        <td class="email-label${index > 0 ? " email-divider" : ""}" style="padding:9px 0;width:45%;color:#8a93a3;${index > 0 ? "border-top:1px solid #eef2f8;" : ""}">${label}</td>
        <td class="email-value${index > 0 ? " email-divider" : ""}" style="padding:9px 0;font-weight:500;text-align:right;color:#16233b;${index > 0 ? "border-top:1px solid #eef2f8;" : ""}">${value}</td>
      </tr>`,
    )
    .join("");

  const whatNextHtml = whatNextItems
    .map(
      (item) => `
      <tr>
        <td style="padding:6px 0;width:26px;vertical-align:top;">
          <span class="email-badge" style="display:inline-block;width:18px;height:18px;line-height:18px;border-radius:50%;font-size:11px;text-align:center;background-color:#e5f4fd;color:#0BA9EF;">&#10003;</span>
        </td>
        <td style="padding:6px 0;">${item}</td>
      </tr>`,
    )
    .join("");

  const referenceBadgeHtml =
    referenceLabel && referenceValue
      ? `
            <tr>
              <td style="padding:20px 32px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-detail-bg" style="border-radius:10px;border-width:1px;border-style:solid;background-color:#f3f9fe;border-color:#dceafb;">
                  <tr>
                    <td class="email-badge" style="padding:14px 18px 0;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;background:none;color:#0BA9EF;">${referenceLabel}</td>
                  </tr>
                  <tr>
                    <td class="email-heading" style="padding:2px 18px 14px;font-size:16px;font-weight:700;color:#123a75;">${referenceValue}</td>
                  </tr>
                </table>
              </td>
            </tr>`
      : "";

  const otpCodeHtml = otpCode
    ? `
            <tr>
              <td style="padding:24px 32px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-detail-bg" style="border-radius:10px;border-width:1px;border-style:solid;background-color:#f3f9fe;border-color:#dceafb;">
                  <tr>
                    <td style="padding:18px 24px;text-align:center;">
                      <p class="email-subtext" style="margin:0 0 10px;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:#55617a;">Your Verification Code</p>
                      <p class="email-heading" style="margin:0 0 10px;font-size:32px;font-weight:700;letter-spacing:10px;color:#123a75;">${otpCode.code}</p>
                      <p class="email-subtext" style="margin:0;font-size:12px;color:#55617a;">Expires in ${otpCode.expiryMinutes} minutes</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`
    : "";

  const totalPayableHtml = totalPayable
    ? `
            <tr>
              <td style="padding:24px 32px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-detail-bg" style="border-radius:10px;border-width:1px;border-style:solid;background-color:#f3f9fe;border-color:#dceafb;">
                  <tr>
                    <td style="padding:18px 24px;text-align:center;">
                      <p class="email-subtext" style="margin:0 0 10px;font-size:11px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;color:#55617a;">${totalPayable.label || "Total Payable"}</p>
                      <p class="email-heading" style="margin:0;font-size:28px;font-weight:700;color:#123a75;">${totalPayable.value}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`
    : "";

  const ctaButtonHtml = ctaButton
    ? `
            <tr>
              <td style="padding:28px 32px 4px;text-align:center;">
                <a href="${ctaButton.href}" style="display:inline-block;background:#0BA9EF;color:#ffffff;font-weight:600;font-size:14px;text-decoration:none;padding:13px 32px;border-radius:8px;">${ctaButton.label}</a>
                ${
                  ctaButton.caption
                    ? `<p class="email-subtext" style="margin:12px 0 0;font-size:12px;color:#55617a;">${ctaButton.caption}</p>`
                    : ""
                }
              </td>
            </tr>`
    : "";

  const noteBlockHtml = noteHtml
    ? `
            <tr>
              <td style="padding:28px 32px 4px;">
                ${
                  noteTitle
                    ? `<p style="margin:0 0 12px;font-size:12px;font-weight:600;letter-spacing:0.5px;color:#0BA9EF;text-transform:uppercase;">${noteTitle}</p>`
                    : ""
                }
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-detail-bg" style="border-radius:10px;border-width:1px;border-style:solid;background-color:#f3f9fe;border-color:#dceafb;">
                  <tr>
                    <td class="email-subtext" style="padding:14px 18px;font-size:12px;line-height:1.6;color:#55617a;">${noteHtml}</td>
                  </tr>
                </table>
              </td>
            </tr>`
    : "";

  const signOffHtmlBlock = signOffHtml
    ? `<p class="email-subtext" style="margin:14px 0 0;font-size:13px;color:#55617a;">${signOffHtml}</p>`
    : "";

  return `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta name="color-scheme" content="light dark" />
          <meta name="supported-color-schemes" content="light dark" />
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
            body { margin:0; padding:0; }
            .email-bg { background-color:#eef4fb; }
            .email-card { background-color:#ffffff; border-color:#dce7f5; }
            .email-hero-bg { background-color:#f3f9fe; }
            .email-detail-bg { background-color:#f3f9fe; border-color:#dceafb; }
            .email-heading { color:#123a75; }
            .email-text { color:#344054; }
            .email-subtext { color:#55617a; }
            .email-label { color:#8a93a3; }
            .email-value { color:#16233b; }
            .email-divider { border-top:1px solid #eef2f8; }
            .email-badge { background-color:#e5f4fd; color:#0BA9EF; }
            .email-footer-bg { background-color:#1d5fa8; }
            .email-footer-text { color:#cfe3fb; }
            .email-footer-link { color:#eaf4ff; }
            .email-header-bg { background-color:#ffffff; }
            .email-tagline { color:#1f2733; }
            .email-tagline-accent { color:#0BA9EF; }
            .logo-light { display:inline-block; }
            .logo-dark { display:none; }
            @media (prefers-color-scheme: dark) {
              .email-bg { background-color:#0b1220 !important; }
              .email-card { background-color:#111a2b !important; border-color:#1f2c46 !important; }
              .email-hero-bg { background-color:#0f1c33 !important; }
              .email-detail-bg { background-color:#0f1c33 !important; border-color:#1f3a63 !important; }
              .email-heading { color:#ffffff !important; }
              .email-text { color:#d7deea !important; }
              .email-subtext { color:#a9b6cc !important; }
              .email-label { color:#8493ad !important; }
              .email-value { color:#f1f5fb !important; }
              .email-divider { border-top:1px solid #22314d !important; }
              .email-badge { background-color:#12314f !important; color:#5fc4ff !important; }
              .email-footer-bg { background-color:#0c2b57 !important; }
              .email-footer-text { color:#a9c6ee !important; }
              .email-footer-link { color:#7db6f5 !important; }
              .email-header-bg { background-color:#111a2b !important; }
              .email-tagline { color:#d7deea !important; }
              .email-tagline-accent { color:#5fc4ff !important; }
              .logo-light { display:none !important; }
              .logo-dark { display:inline-block !important; }
            }
          </style>
        </head>
        <body class="email-bg" style="margin:0;padding:32px 16px;font-family:'Poppins',Arial,sans-serif;background-color:#eef4fb;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-card" style="max-width:580px;margin:0 auto;border-radius:14px;overflow:hidden;border-width:1px;border-style:solid;font-family:'Poppins',Arial,sans-serif;background-color:#ffffff;border-color:#dce7f5;">
            <tr>
              <td style="background:linear-gradient(90deg,#0BA9EF,#1e40af);height:5px;line-height:5px;font-size:0;">&nbsp;</td>
            </tr>
            <tr>
              <td class="email-header-bg" style="background:#ffffff;padding:26px 32px;text-align:center;border-bottom:1px solid #eef2f8;">
                <img src="${EMAIL_LOGO_URL}" alt="WONO" width="140" height="40" class="logo-light" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;height:40px;width:140px;" />
                <img src="${EMAIL_LOGO_DARK_URL}" alt="WONO" width="140" height="40" class="logo-dark" style="display:none;margin:0 auto;border:0;outline:none;text-decoration:none;height:40px;width:140px;" />
                <p class="email-tagline" style="margin:8px 0 0;font-size:12px;font-weight:500;letter-spacing:0.2px;color:#1f2733;">
                  <span class="email-tagline">W</span><span class="email-tagline-accent">o</span><span class="email-tagline">rld of N</span><span class="email-tagline-accent">o</span><span class="email-tagline">mads</span>
                </p>
              </td>
            </tr>
            <tr>
              <td class="email-hero-bg" style="padding:40px 32px 28px;text-align:center;background-color:#f3f9fe;">
                <div style="width:60px;height:60px;line-height:60px;border-radius:50%;background:#0BA9EF;margin:0 auto 18px;">
                  <span style="font-size:28px;color:#ffffff;">&#10003;</span>
                </div>
                <h1 class="email-heading" style="margin:0 0 8px;font-size:22px;font-weight:700;color:#123a75;">${heroTitle}</h1>
                <p class="email-subtext" style="margin:0;font-size:14px;color:#55617a;">${heroSubtitle}</p>
              </td>
            </tr>
            <tr>
              <td class="email-text" style="padding:28px 32px 0;font-size:14px;line-height:1.6;color:#344054;">
                ${greetingHtml}
              </td>
            </tr>${bodyHtml || ""}${referenceBadgeHtml}${otpCodeHtml}
            ${
              detailRows.length
                ? `<tr>
              <td style="padding:28px 32px 4px;">
                <p style="margin:0 0 12px;font-size:12px;font-weight:600;letter-spacing:0.5px;color:#0BA9EF;text-transform:uppercase;">${detailsTitle}</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-text" style="font-size:14px;color:#344054;">
                  ${detailRowsHtml}
                </table>
              </td>
            </tr>`
                : ""
            }${totalPayableHtml}${ctaButtonHtml}
            ${
              whatNextItems.length
                ? `<tr>
              <td style="padding:28px 32px 4px;">
                <p style="margin:0 0 12px;font-size:12px;font-weight:600;letter-spacing:0.5px;color:#0BA9EF;text-transform:uppercase;">${whatNextTitle}</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-text" style="font-size:14px;color:#344054;">
                  ${whatNextHtml}
                </table>
              </td>
            </tr>`
                : ""
            }${noteBlockHtml}
            <tr>
              <td style="padding:28px 32px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-detail-bg" style="border-radius:10px;border-width:1px;border-style:solid;background-color:#f3f9fe;border-color:#dceafb;">
                  <tr>
                    <td style="padding:18px 24px;text-align:center;">
                      <p class="email-subtext" style="margin:0 0 6px;font-size:13px;color:#55617a;">Need Immediate Assistance?</p>
                      <p style="margin:0;font-size:14px;">
                        <a href="mailto:response@wono.co" style="color:#0BA9EF;text-decoration:none;font-weight:600;">response@wono.co</a>
                        &nbsp;|&nbsp;
                        <a href="https://www.wono.co" style="color:#0BA9EF;text-decoration:none;font-weight:600;">www.wono.co</a>
                      </p>
                      ${signOffHtmlBlock}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-footer-bg" style="background-color:#1d5fa8;padding:22px 32px;text-align:center;">
                <p class="email-footer-text" style="margin:0 0 6px;font-size:11px;color:#cfe3fb;">&copy; Copyright 2026-27 All Rights Reserved.<br/>WONOCO PRIVATE LIMITED - SINGAPORE.</p>
                <p style="margin:0;font-size:11px;">
                  <a href="https://www.wono.co/privacy" class="email-footer-link" style="color:#eaf4ff !important;text-decoration:underline;">Privacy Policy</a>
                  &nbsp;|&nbsp;
                  <a href="https://www.wono.co/terms-and-conditions" class="email-footer-link" style="color:#eaf4ff !important;text-decoration:underline;">Terms &amp; Conditions</a>
                </p>
              </td>
            </tr>
          </table>
        </body>
      </html>
      `;
}

// Company-verification payment emails (Company Verification Leads page).
// Mirror buildPlanSubscriptionPaymentEmail / buildPlanSubscriptionConfirmationEmail
// in hostUserControllers.js — same shell, copy adapted for a verification
// badge instead of a plan subscription.

const VERIFICATION_CHANGE_TYPE_COPY = {
  initial: {
    subject: "Complete Your Verification Payment",
    heroTitle: "Complete Your Payment",
    heroLead: "Activate Your",
    bodyLead: "Your business verification request for",
    bodyTrail: "has been approved and is ready for payment.",
  },
  renewal: {
    subject: "Renew Your Verification Badge",
    heroTitle: "Renew Your Verification Badge",
    heroLead: "Keep Your",
    bodyLead: "Your business verification badge for",
    bodyTrail: "is expiring soon.",
  },
  upgrade: {
    subject: "Change Your Verification Plan",
    heroTitle: "Change Your Verification Plan",
    heroLead: "Upgrade Your",
    bodyLead: "You're switching plans for",
    bodyTrail: "— complete payment to apply the new plan.",
  },
  downgrade: {
    subject: "Change Your Verification Plan",
    heroTitle: "Change Your Verification Plan",
    heroLead: "Change Your",
    bodyLead: "You're switching plans for",
    bodyTrail: "— complete payment to apply the new plan.",
  },
};

const buildVerificationPaymentEmail = ({
  customerName,
  companyName,
  tierLabel,
  paymentLinkUrl,
  amount,
  changeType = "initial",
  projectedStart,
  projectedEnd,
}) => {
  const copy = VERIFICATION_CHANGE_TYPE_COPY[changeType] || VERIFICATION_CHANGE_TYPE_COPY.initial;
  // For a renewal/change-plan started before the current plan has expired,
  // the new one starts only once the current one runs out — spelling that
  // out here so paying early never reads as "losing" the time already paid
  // for.
  const periodNote =
    changeType !== "initial" && projectedStart && projectedEnd
      ? [
          [
            "Plan Starts",
            new Date(projectedStart) > new Date()
              ? `${formatLongDate(projectedStart)} (after your current plan ends)`
              : formatLongDate(projectedStart),
          ],
          ["Plan Ends", formatLongDate(projectedEnd)],
        ]
      : [];
  return {
    subject: copy.subject,
    html: renderNotificationEmail({
      heroTitle: copy.heroTitle,
      heroSubtitle: `<span style="font-weight:700;color:#123a75;">${copy.heroLead} Verified Badge — ${tierLabel}</span><br/>${copy.bodyTrail}`,
      greetingHtml: `
        <p style="margin:0 0 4px;">Hello ${customerName},</p>
        <p class="email-text" style="margin:0;">${copy.bodyLead} <b class="email-heading">${companyName}</b> ${copy.bodyTrail}</p>
      `,
      detailsTitle: "Payment Summary",
      detailRows: [
        ["Company", companyName],
        ["Plan", tierLabel],
        ["Amount Due", `$${Number(amount).toFixed(2)} USD`],
        ...periodNote,
      ],
      ctaButton: { href: paymentLinkUrl, label: "Complete Payment" },
    }),
  };
};

// Optional second CTA block appended via bodyHtml — renderNotificationEmail's
// own ctaButton only supports one button, so a second link (either a
// Renew/Change-Plan pair or a single Become-a-Host nudge) is built as raw
// table markup and passed through bodyHtml instead.
const buildTwoCtaBodyHtml = (buttons) => `
  <tr><td style="padding:24px 32px 4px;text-align:center;">
    ${buttons
      .map(
        (btn, index) => `<a href="${btn.href}" style="display:inline-block;background:${index === 0 ? "#0BA9EF" : "#ffffff"};color:${index === 0 ? "#ffffff" : "#0BA9EF"};font-weight:600;font-size:14px;text-decoration:none;padding:13px 28px;border-radius:8px;border:1px solid #0BA9EF;margin:0 6px 8px;">${btn.label}</a>`,
      )
      .join("")}
  </td></tr>`;

const buildVerificationConfirmationEmail = ({
  customerName,
  companyName,
  tierLabel,
  amount,
  paidAt,
  verificationExpiresAt,
  changeType = "initial",
  becomeHostUrl,
  invoiceUrl,
}) => ({
  subject: "Verification Payment Successful!",
  html: renderNotificationEmail({
    heroTitle: "Payment Successful!",
    heroSubtitle: `<span style="font-weight:700;color:#123a75;">Your ${companyName} Verified Badge Is ${changeType === "initial" ? "Active" : "Updated"}</span>`,
    greetingHtml: `
        <p style="margin:0 0 4px;">Hello ${customerName},</p>
        <p class="email-text" style="margin:0;">We've received your payment. Your blue verification badge for <b class="email-heading">${companyName}</b> is now live on all your listings.${changeType !== "initial" ? " Any time remaining on your previous plan has been carried over — nothing is lost." : ""}${invoiceUrl ? " Your invoice is attached to this email." : ""}</p>
      `,
    detailsTitle: "Payment Summary",
    detailRows: [
      ["Company", companyName],
      ["Plan", tierLabel],
      [
        "Amount Paid",
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(amount || 0),
      ],
      ["Payment Date", formatLongDate(paidAt || new Date())],
      ["Start Date", formatLongDate(paidAt || new Date())],
      ["Valid Until", formatLongDate(verificationExpiresAt)],
    ],
    ctaButton: invoiceUrl
      ? { href: invoiceUrl, label: "View Invoice" }
      : undefined,
    bodyHtml: becomeHostUrl
      ? buildTwoCtaBodyHtml([
          { href: becomeHostUrl, label: "Become a Host — Sign Up Free" },
        ])
      : undefined,
  }),
});

// Sent by the renewal-reminder cron, 5 days before verificationExpiresAt.
// Unlike buildVerificationPaymentEmail, this can't link straight to a Stripe
// Payment Link — the tier hasn't been chosen yet, since the owner might
// renew the same plan or change it. Both CTAs land on the self-serve
// "Verification" tab (Part C.1) instead, which creates the actual link.
const buildVerificationRenewalReminderEmail = ({
  customerName,
  companyName,
  tierLabel,
  expiresOnLabel,
  manageUrl,
}) => ({
  subject: "Your Verification Badge Is Expiring Soon",
  html: renderNotificationEmail({
    heroTitle: "Renew Your Verification Badge",
    heroSubtitle: `<span style="font-weight:700;color:#123a75;">Expiring ${expiresOnLabel}</span><br/>Renew now to keep your verified badge active.`,
    greetingHtml: `
        <p style="margin:0 0 4px;">Hello ${customerName},</p>
        <p class="email-text" style="margin:0;">Your <b class="email-heading">${tierLabel}</b> verification badge for <b class="email-heading">${companyName}</b> expires on <b class="email-heading">${expiresOnLabel}</b>. Renew your current plan or switch to a different one below.</p>
      `,
    bodyHtml: buildTwoCtaBodyHtml([
      { href: `${manageUrl}&action=renew`, label: "Renew Now" },
      { href: `${manageUrl}&action=change`, label: "Change Plan" },
    ]),
  }),
});

// Sent by the expiry-day cron, once verificationExpiresAt has passed and the
// badge has actually lapsed (distinct from the 5-day-before reminder above).
const buildVerificationExpiredEmail = ({ customerName, companyName, manageUrl }) => ({
  subject: "Your Verification Badge Has Expired",
  html: renderNotificationEmail({
    heroTitle: "Your Verification Badge Has Expired",
    heroSubtitle: `<span style="font-weight:700;color:#123a75;">${companyName} is no longer verified</span><br/>Renew now to restore your badge.`,
    greetingHtml: `
        <p style="margin:0 0 4px;">Hello ${customerName},</p>
        <p class="email-text" style="margin:0;">Your verification badge for <b class="email-heading">${companyName}</b> has expired and is no longer shown on your listings. Renew your plan or switch to a different one to restore it.</p>
      `,
    bodyHtml: buildTwoCtaBodyHtml([
      { href: `${manageUrl}&action=renew`, label: "Renew Now" },
      { href: `${manageUrl}&action=change`, label: "Change Plan" },
    ]),
  }),
});

// Host core-plan billing emails (Signup Leads / Upgrade Plan / Plan &
// Billing). Same shell as the verification-payment emails above, copy
// adapted for a Professional/Custom plan subscription instead of a
// verification badge.

const PLAN_CHANGE_TYPE_COPY = {
  initial: {
    subject: "Complete Your Plan Payment",
    heroTitle: "Complete Your Payment",
    heroLead: "Activate Your",
    bodyLead: "Your signup for",
    bodyTrail: "has been approved and is ready for payment.",
  },
  renewal: {
    subject: "Renew Your WONO Plan",
    heroTitle: "Renew Your Plan",
    heroLead: "Keep Your",
    bodyLead: "Your plan for",
    bodyTrail: "is renewing this month.",
  },
  upgrade: {
    subject: "Complete Your Plan Upgrade",
    heroTitle: "Complete Your Plan Upgrade",
    heroLead: "Upgrade Your",
    bodyLead: "You're upgrading the plan for",
    bodyTrail: "— complete payment to apply the new plan.",
  },
  downgrade: {
    subject: "Confirm Your Plan Change",
    heroTitle: "Confirm Your Plan Change",
    heroLead: "Change Your",
    bodyLead: "You're switching plans for",
    bodyTrail: "— complete payment to apply the new plan.",
  },
};

const buildPlanPaymentEmail = ({
  customerName,
  companyName,
  planLabel,
  paymentLinkUrl,
  amount,
  changeType = "initial",
  projectedStart,
  projectedEnd,
}) => {
  const copy = PLAN_CHANGE_TYPE_COPY[changeType] || PLAN_CHANGE_TYPE_COPY.initial;
  return {
    subject: copy.subject,
    html: renderNotificationEmail({
      heroTitle: copy.heroTitle,
      heroSubtitle: `<span style="font-weight:700;color:#123a75;">${copy.heroLead} ${planLabel}</span><br/>${copy.bodyTrail}`,
      greetingHtml: `
        <p style="margin:0 0 4px;">Hello ${customerName},</p>
        <p class="email-text" style="margin:0;">${copy.bodyLead} <b class="email-heading">${companyName}</b> ${copy.bodyTrail}</p>
      `,
      detailsTitle: "Payment Summary",
      detailRows: [
        ["Company", companyName],
        ["Plan", planLabel],
        ["Amount Due", `$${Number(amount).toFixed(2)} USD / month`],
        ...(projectedStart && projectedEnd
          ? [
              ["Cycle Starts", formatLongDate(projectedStart)],
              ["Cycle Ends", formatLongDate(projectedEnd)],
            ]
          : []),
      ],
      ctaButton: { href: paymentLinkUrl, label: "Complete Payment" },
    }),
  };
};

const buildPlanPaymentConfirmationEmail = ({
  customerName,
  companyName,
  planLabel,
  amount,
  paidAt,
  periodEnd,
  changeType = "initial",
  invoiceUrl,
}) => ({
  subject: "Plan Payment Successful!",
  html: renderNotificationEmail({
    heroTitle: "Payment Successful!",
    heroSubtitle: `<span style="font-weight:700;color:#123a75;">${companyName}'s ${planLabel} Is ${changeType === "initial" ? "Active" : "Updated"}</span>`,
    greetingHtml: `
        <p style="margin:0 0 4px;">Hello ${customerName},</p>
        <p class="email-text" style="margin:0;">We've received your payment. The ${planLabel} for <b class="email-heading">${companyName}</b> is now active.${invoiceUrl ? " Your invoice is attached to this email." : ""}</p>
      `,
    detailsTitle: "Payment Summary",
    detailRows: [
      ["Company", companyName],
      ["Plan", planLabel],
      [
        "Amount Paid",
        new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
          amount || 0,
        ),
      ],
      ["Payment Date", formatLongDate(paidAt || new Date())],
      ["Renews On", formatLongDate(periodEnd)],
    ],
    ctaButton: invoiceUrl ? { href: invoiceUrl, label: "View Invoice" } : undefined,
  }),
});

// Sent once, the moment a Professional/Custom plan's very first payment is
// confirmed (changeType === "initial") — distinct from the payment
// confirmation above so hosts get one clear "your plan has started" email in
// addition to the receipt.
const buildPlanStartedEmail = ({ customerName, companyName, planLabel, startDate }) => ({
  subject: `Your ${planLabel} Has Started`,
  html: renderNotificationEmail({
    heroTitle: "Your Plan Has Started",
    heroSubtitle: `<span style="font-weight:700;color:#123a75;">${companyName} is now on the ${planLabel}</span>`,
    greetingHtml: `
        <p style="margin:0 0 4px;">Hello ${customerName},</p>
        <p class="email-text" style="margin:0;">Your <b class="email-heading">${planLabel}</b> for <b class="email-heading">${companyName}</b> started on <b class="email-heading">${formatLongDate(startDate)}</b>. You now have access to everything included in this plan.</p>
      `,
  }),
});

// Sent by the plan-expiry-reminder cron, 5 days before planExpiryDate.
const buildPlanExpiryReminderEmail = ({
  customerName,
  companyName,
  planLabel,
  expiryDate,
  modulesAtRisk = [],
}) => ({
  subject: "Your WONO Plan Is Expiring Soon",
  html: renderNotificationEmail({
    heroTitle: "Your Plan Is Expiring Soon",
    heroSubtitle: `<span style="font-weight:700;color:#123a75;">Expiring ${formatLongDate(expiryDate)}</span><br/>Renew now to avoid losing access.`,
    greetingHtml: `
        <p style="margin:0 0 4px;">Hello ${customerName},</p>
        <p class="email-text" style="margin:0;">Your <b class="email-heading">${planLabel}</b> for <b class="email-heading">${companyName}</b> expires on <b class="email-heading">${formatLongDate(expiryDate)}</b>. If it isn't renewed by then, your workspace will be downgraded to the Basic plan${modulesAtRisk.length ? ` and you'll lose access to: <b class="email-heading">${modulesAtRisk.join(", ")}</b>` : ""}. Your data is never deleted — renewing restores access immediately.</p>
      `,
  }),
});

// Sent by the downgrade cron, once planExpiryDate has passed with no renewal.
const buildPlanDowngradedEmail = ({
  customerName,
  companyName,
  previousPlanLabel,
  modulesLost = [],
}) => ({
  subject: "Your WONO Plan Has Been Downgraded",
  html: renderNotificationEmail({
    heroTitle: "Your Plan Has Been Downgraded",
    heroSubtitle: `<span style="font-weight:700;color:#123a75;">${companyName} is now on the Basic plan</span>`,
    greetingHtml: `
        <p style="margin:0 0 4px;">Hello ${customerName},</p>
        <p class="email-text" style="margin:0;">Your ${previousPlanLabel} for <b class="email-heading">${companyName}</b> expired without renewal, so your workspace has been moved to the Basic plan${modulesLost.length ? ` and you've lost access to: <b class="email-heading">${modulesLost.join(", ")}</b>` : ""}. Nothing has been deleted — renew anytime to restore full access.</p>
      `,
  }),
});

module.exports = emailTemplates;
module.exports.toDMY = toDMY;
module.exports.referenceDateStamp = referenceDateStamp;
module.exports.formatSubmittedOn = formatSubmittedOn;
module.exports.formatLongDate = formatLongDate;
module.exports.renderNotificationEmail = renderNotificationEmail;
module.exports.buildVerificationPaymentEmail = buildVerificationPaymentEmail;
module.exports.buildVerificationConfirmationEmail =
  buildVerificationConfirmationEmail;
module.exports.buildVerificationRenewalReminderEmail =
  buildVerificationRenewalReminderEmail;
module.exports.buildVerificationExpiredEmail = buildVerificationExpiredEmail;
module.exports.buildPlanPaymentEmail = buildPlanPaymentEmail;
module.exports.buildPlanPaymentConfirmationEmail = buildPlanPaymentConfirmationEmail;
module.exports.buildPlanStartedEmail = buildPlanStartedEmail;
module.exports.buildPlanExpiryReminderEmail = buildPlanExpiryReminderEmail;
module.exports.buildPlanDowngradedEmail = buildPlanDowngradedEmail;
