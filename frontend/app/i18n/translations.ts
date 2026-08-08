/**
 * UI-chrome translation dictionaries (English/Bangla).
 *
 * Scope: this covers the always-visible app shell (auth, sidebar nav, dashboard
 * topbar) — not yet every page's content. Adding a namespace/key here and to
 * both `en` and `bn` is the whole extension mechanism; a third language is just
 * a third object of the same shape, no other code changes needed.
 */

export type Locale = "en" | "bn";

const en = {
  common: {
    logout: "Logout",
    refresh: "Refresh",
    dismiss: "Dismiss",
    pleaseWait: "Please wait...",
    resendEmail: "Resend email",
    sending: "Sending...",
    verifyEmailNotice: "Verify your email to secure your account.",
    verificationSentNotice: "Verification email sent — check your inbox.",
  },
  nav: {
    brandTagline: "Bangladesh Procurement",
    groupWorkspace: "Workspace",
    groupManage: "Manage",
    groupTools: "Tools",
    overview: "Overview",
    tenderLibrary: "Tender library",
    calendar: "Calendar",
    team: "Team",
    vendors: "Vendors",
    contracts: "Contracts",
    knowledgeBase: "Knowledge base",
    companyProfile: "Company profile",
    discovery: "Discovery",
    docValidator: "Doc Validator",
    aiProposalHintPrefix: "Open a tender → ",
    aiProposalHintBold: "AI Proposal",
    aiProposalHintSuffix: " to generate a full bid",
  },
  auth: {
    heroTitle: "Tender command center for suppliers",
    heroSubtitle:
      "Analyze tender documents, extract compliance requirements, and prepare a submission draft inside a private workspace.",
    pointPrivateLibrary: "Private tender library",
    pointComplianceMatrix: "Compliance matrix",
    pointDocxExport: "DOCX report export",
    login: "Login",
    signup: "Sign up",
    email: "Email",
    password: "Password",
    forgotPassword: "Forgot password?",
    backToLogin: "Back to login",
    sendResetLink: "Send reset link",
    createAccount: "Create account",
    resetSentPrefix: "If an account exists for",
    resetSentSuffix: "a password reset link has been sent. Check your inbox.",
    authFailed: "Authentication failed.",
    resetFailed: "Could not send reset email.",
  },
  dashboard: {
    defaultWorkspaceName: "Tender Workspace",
    topbarLabel: "Dashboard",
    subtitle:
      "Upload tenders, track bids, and export submission-ready reports for Bangladesh procurement.",
  },
};

type Dict = typeof en;

const bn: Dict = {
  common: {
    logout: "লগআউট",
    refresh: "রিফ্রেশ",
    dismiss: "খারিজ করুন",
    pleaseWait: "অনুগ্রহ করে অপেক্ষা করুন...",
    resendEmail: "ইমেইল পুনরায় পাঠান",
    sending: "পাঠানো হচ্ছে...",
    verifyEmailNotice: "আপনার অ্যাকাউন্ট সুরক্ষিত করতে ইমেইল যাচাই করুন।",
    verificationSentNotice: "যাচাইকরণ ইমেইল পাঠানো হয়েছে — আপনার ইনবক্স দেখুন।",
  },
  nav: {
    brandTagline: "বাংলাদেশ ক্রয় ব্যবস্থা",
    groupWorkspace: "কর্মক্ষেত্র",
    groupManage: "পরিচালনা",
    groupTools: "টুলস",
    overview: "সারসংক্ষেপ",
    tenderLibrary: "টেন্ডার লাইব্রেরি",
    calendar: "ক্যালেন্ডার",
    team: "টিম",
    vendors: "ভেন্ডর",
    contracts: "চুক্তি",
    knowledgeBase: "নলেজ বেস",
    companyProfile: "কোম্পানি প্রোফাইল",
    discovery: "ডিসকভারি",
    docValidator: "ডকুমেন্ট ভ্যালিডেটর",
    aiProposalHintPrefix: "একটি টেন্ডার খুলুন → ",
    aiProposalHintBold: "এআই প্রস্তাব",
    aiProposalHintSuffix: " দিয়ে সম্পূর্ণ বিড তৈরি করুন",
  },
  auth: {
    heroTitle: "সরবরাহকারীদের জন্য টেন্ডার কমান্ড সেন্টার",
    heroSubtitle:
      "টেন্ডার ডকুমেন্ট বিশ্লেষণ করুন, সম্মতির শর্তাবলী খুঁজে বের করুন, এবং একটি ব্যক্তিগত ওয়ার্কস্পেসে জমাদানের খসড়া তৈরি করুন।",
    pointPrivateLibrary: "ব্যক্তিগত টেন্ডার লাইব্রেরি",
    pointComplianceMatrix: "কমপ্লায়েন্স ম্যাট্রিক্স",
    pointDocxExport: "DOCX রিপোর্ট এক্সপোর্ট",
    login: "লগইন",
    signup: "সাইন আপ",
    email: "ইমেইল",
    password: "পাসওয়ার্ড",
    forgotPassword: "পাসওয়ার্ড ভুলে গেছেন?",
    backToLogin: "লগইনে ফিরে যান",
    sendResetLink: "রিসেট লিংক পাঠান",
    createAccount: "অ্যাকাউন্ট তৈরি করুন",
    resetSentPrefix: "যদি এই ইমেইলে কোনো অ্যাকাউন্ট থেকে থাকে",
    resetSentSuffix: "তাহলে একটি পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে। আপনার ইনবক্স দেখুন।",
    authFailed: "প্রমাণীকরণ ব্যর্থ হয়েছে।",
    resetFailed: "রিসেট ইমেইল পাঠানো যায়নি।",
  },
  dashboard: {
    defaultWorkspaceName: "টেন্ডার ওয়ার্কস্পেস",
    topbarLabel: "ড্যাশবোর্ড",
    subtitle:
      "টেন্ডার আপলোড করুন, বিড ট্র্যাক করুন, এবং বাংলাদেশের ক্রয় প্রক্রিয়ার জন্য জমাদানযোগ্য রিপোর্ট এক্সপোর্ট করুন।",
  },
};

export const translations: Record<Locale, Dict> = { en, bn };
