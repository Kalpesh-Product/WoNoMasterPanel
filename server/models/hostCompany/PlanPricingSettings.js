const mongoose = require("mongoose");

// Singleton document holding the editable Professional plan prices. Staff
// can change them anytime from Master Panel — nothing here is a hardcoded
// constant in code. Custom plan has NO separate base price: it's always
// this same Professional price plus whatever individually-priced
// modules/department bundles are selected on top (see ModulePricing.js and
// modulePricingService.js's computeCustomPlanMonthlyPrice) — Custom
// literally includes the Professional module set, so it should cost
// Professional's price plus add-ons, never a second independent number.
//
// professionalPlanPriceUsd = monthly rate (e.g. $199).
// professionalAnnualPlanPriceUsd = the discounted PER-MONTH-equivalent rate
// a host pays when they choose yearly billing (e.g. $165). The amount
// actually charged for an annual cycle is this × 12, upfront, for a
// 12-month period. Left null/unset, annual falls back to the monthly price
// (no discount) everywhere it's displayed or charged.
const planPricingSettingsSchema = new mongoose.Schema(
  {
    singletonKey: {
      type: String,
      default: "default",
      unique: true,
    },
    professionalPlanPriceUsd: {
      type: Number,
      required: true,
      default: 199,
      min: 0,
    },
    professionalAnnualPlanPriceUsd: {
      type: Number,
      default: null,
      min: 0,
    },
    // Basic plan price — $0 today, so Basic stays free in practice. Staff can
    // set these from Master Panel ahead of actually turning on Basic
    // billing (a separate future toggle); nothing reads these yet.
    basicPlanPriceUsd: {
      type: Number,
      default: 0,
      min: 0,
    },
    basicPlanAnnualPriceUsd: {
      type: Number,
      default: null,
      min: 0,
    },
    // How many months a new company stays on Basic for free before it's
    // required to pay (e.g. 6). Nothing reads this yet — the actual
    // countdown (setting planExpiryDate at Basic signup, the
    // reminder/expiry cron jobs, and locking a workspace once it lapses)
    // is separate work that spans HostPanel too. This is groundwork only.
    basicFreeDurationMonths: {
      type: Number,
      default: 6,
      min: 1,
    },
    // Master switch for the Professional free-trial offer, plus how long a
    // newly-started trial runs. Changing freeTrialDurationDays only affects
    // trials started after the change — a trial already in progress keeps
    // the day count it started with (its planExpiryDate/trialEndAt were
    // already computed and stored on that start-trial call).
    freeTrialEnabled: {
      type: Boolean,
      default: false,
    },
    freeTrialDurationDays: {
      type: Number,
      default: 30,
      min: 1,
    },
    // An optional, staff-named Stripe Promotion Code to use INSTEAD of the
    // system's own free-trial coupon below (e.g. a branded "LAUNCH100" for
    // a marketing push) — never both at once, never stacked. Empty = just
    // use the system coupon, which is what actually makes the trial free;
    // this field never controls whether the trial itself is free.
    activeTrialPromotionCodeId: {
      type: String,
      trim: true,
      default: "",
    },
    // Auto-provisioned once (getOrCreateSystemFreeTrialCoupon,
    // modulePricingService.js) and reused forever — a Stripe Coupon,
    // 100% off, duration "once". This is THE mechanism that makes the
    // free trial actually free: startTrialCheckout applies it to every
    // trial's first invoice instead of using Stripe's own trial_period_days,
    // so that invoice is a real $199 charge discounted to $0 (visible
    // breakdown, not a blank "free trial" placeholder), and nothing ever
    // re-applies it after that one invoice. Staff never edit this
    // directly — it's not the same thing as the named promo codes above.
    systemFreeTrialCouponId: {
      type: String,
      trim: true,
      default: "",
    },
    updatedByEmail: {
      type: String,
      trim: true,
      default: "",
    },
    // Website-lead visibility cap per plan — how many website leads a host
    // can see on Website Leads before HostPanel prompts them to request
    // more. null = unlimited (Custom plan).
    basicLeadsLimit: {
      type: Number,
      default: 5,
      min: 0,
    },
    professionalLeadsLimit: {
      type: Number,
      default: 25,
      min: 0,
    },
    customLeadsLimit: {
      type: Number,
      default: null,
      min: 0,
    },
  },
  { timestamps: true },
);

module.exports =
  mongoose.models.PlanPricingSettings ||
  mongoose.model("PlanPricingSettings", planPricingSettingsSchema);
