import bcrypt from 'bcryptjs';
import { AiDocumentModel } from '../models/AiDocument';
import { ProjectModel } from '../models/Project';
import { COMMON_INDUSTRY, QuestionModel } from '../models/Question';
import { UserModel } from '../models/User';

const BCRYPT_ROUNDS = 12;
const DEMO_PASSWORD = 'Demo12345';

interface SeedUser {
  fullName: string;
  email: string;
  password: string;
  role: 'client' | 'admin' | 'tech';
}

const SEED_USERS: SeedUser[] = [
  { fullName: 'Platform Admin', email: 'admin@example.com', password: 'Admin@2026', role: 'admin' },
  { fullName: 'Demo Client', email: 'client@example.com', password: DEMO_PASSWORD, role: 'client' },
  { fullName: 'Priya Sharma', email: 'priya@example.com', password: DEMO_PASSWORD, role: 'client' },
  { fullName: 'Tech Reviewer', email: 'tech@example.com', password: DEMO_PASSWORD, role: 'tech' },
];

interface SeedQuestion {
  industry: string;
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect';
  options?: string[];
  placeholder?: string;
  required?: boolean;
  order: number;
  dependsOnKey?: string;
  dependsOnValue?: string;
}

const SEED_QUESTIONS: SeedQuestion[] = [
  { industry: COMMON_INDUSTRY, key: 'platforms', label: 'Which platforms do you need?', type: 'multiselect', options: ['Web', 'Android', 'iOS', 'Desktop'], required: true, order: 1 },
  { industry: COMMON_INDUSTRY, key: 'auth', label: 'How should users sign in?', type: 'multiselect', options: ['Email & password', 'Google', 'Apple', 'Phone OTP', 'SSO / SAML', 'Guest / no login'], order: 2 },
  { industry: COMMON_INDUSTRY, key: 'core_features', label: 'Core features to include', type: 'multiselect', options: ['Payments', 'Chat / messaging', 'Notifications', 'Location / maps', 'Search', 'Analytics dashboard', 'File uploads', 'Admin panel', 'Reviews & ratings', 'Scheduling / calendar'], order: 3 },
  { industry: COMMON_INDUSTRY, key: 'integrations', label: 'Third-party integrations', type: 'multiselect', options: ['Stripe', 'Razorpay', 'Twilio', 'SendGrid', 'Google Maps', 'AWS S3', 'Firebase', 'Slack', 'WhatsApp', 'OpenAI / LLM'], order: 4 },

  { industry: 'Fintech', key: 'product', label: 'What financial product or service?', type: 'text', placeholder: 'e.g. digital wallet, lending, payments', required: true, order: 1 },
  { industry: 'Fintech', key: 'compliance', label: 'Key compliance needs', type: 'select', options: ['KYC/AML', 'PCI-DSS', 'PSD2 / Open Banking', 'Not sure'], order: 2 },
  { industry: 'Fintech', key: 'users', label: 'Who are the primary users?', type: 'text', placeholder: 'e.g. consumers, SMBs, agents', order: 3 },
  { industry: 'Fintech', key: 'integrations', label: 'Payment / banking integrations needed', type: 'text', placeholder: 'e.g. UPI, Stripe, card networks', order: 4 },

  { industry: 'Healthcare', key: 'solution', label: 'Type of healthcare solution', type: 'select', options: ['Telehealth', 'Patient records (EHR)', 'Appointment booking', 'Wellness/fitness', 'Other'], required: true, order: 1 },
  { industry: 'Healthcare', key: 'audience', label: 'Patient-facing or provider-facing?', type: 'select', options: ['Patient', 'Provider', 'Both'], order: 2 },
  { industry: 'Healthcare', key: 'compliance', label: 'Compliance requirements', type: 'text', placeholder: 'e.g. HIPAA, GDPR, India DPDP', order: 3 },
  { industry: 'Healthcare', key: 'features', label: 'Must-have features', type: 'multiselect', options: ['Video consults', 'E-prescriptions', 'Reminders', 'Patient records', 'Payments', 'Lab integrations'], order: 4 },

  { industry: 'E-commerce / Retail', key: 'model', label: 'Business model', type: 'select', options: ['D2C brand', 'Marketplace', 'B2B wholesale', 'Subscription'], required: true, order: 1 },
  { industry: 'E-commerce / Retail', key: 'commission', label: 'Marketplace commission & payout model', type: 'text', placeholder: 'e.g. 10% per order, weekly seller payouts', order: 2, dependsOnKey: 'model', dependsOnValue: 'Marketplace' },
  { industry: 'E-commerce / Retail', key: 'catalog', label: 'What are you selling?', type: 'text', placeholder: 'e.g. apparel, electronics, groceries', order: 3 },
  { industry: 'E-commerce / Retail', key: 'payments', label: 'Payment methods', type: 'multiselect', options: ['Cards', 'UPI', 'Wallets', 'COD', 'Net banking', 'BNPL'], order: 4 },
  { industry: 'E-commerce / Retail', key: 'features', label: 'Key features', type: 'textarea', placeholder: 'e.g. recommendations, reviews, loyalty', order: 5 },

  { industry: 'Education', key: 'type', label: 'Type of platform', type: 'select', options: ['LMS / courses', 'Live tutoring', 'Test prep', 'School admin', 'Other'], required: true, order: 1 },
  { industry: 'Education', key: 'audience', label: 'Target learners', type: 'text', placeholder: 'e.g. K-12, university, professionals', order: 2 },
  { industry: 'Education', key: 'features', label: 'Core features', type: 'textarea', placeholder: 'e.g. video lessons, quizzes, certificates', order: 3 },

  { industry: 'SaaS / Productivity', key: 'problem', label: 'What problem does it solve?', type: 'textarea', placeholder: 'Describe the core workflow you improve', required: true, order: 1 },
  { industry: 'SaaS / Productivity', key: 'users', label: 'Who is it for?', type: 'text', placeholder: 'e.g. marketing teams, developers, HR', order: 2 },
  { industry: 'SaaS / Productivity', key: 'features', label: 'Key features', type: 'textarea', placeholder: 'e.g. dashboards, automations, integrations', order: 3 },

  { industry: 'Other', key: 'idea', label: 'Describe your project idea', type: 'textarea', placeholder: 'What are you building and for whom?', required: true, order: 1 },
  { industry: 'Other', key: 'features', label: 'Key features', type: 'textarea', placeholder: 'List the must-have capabilities', order: 2 },
];

async function seedQuestions(): Promise<void> {
  for (const q of SEED_QUESTIONS) {
    await QuestionModel.findOneAndUpdate(
      { industry: q.industry, key: q.key },
      {
        $set: {
          label: q.label,
          type: q.type,
          options: q.options ?? [],
          placeholder: q.placeholder ?? '',
          required: q.required ?? false,
          order: q.order,
          dependsOnKey: q.dependsOnKey ?? null,
          dependsOnValue: q.dependsOnValue ?? null,
          isActive: true,
        },
      },
      { upsert: true, new: true },
    );
  }
}

/** Idempotently seed demo users + the questionnaire bank. Dev only. */
export async function seedDemoData(): Promise<void> {
  await seedQuestions();

  for (const u of SEED_USERS) {
    const passwordHash = await bcrypt.hash(u.password, BCRYPT_ROUNDS);
    await UserModel.findOneAndUpdate(
      { email: u.email },
      { $set: { fullName: u.fullName, role: u.role, isActive: true }, $setOnInsert: { passwordHash } },
      { upsert: true, new: true },
    );
  }

  const [users, projects, admins, documents] = await Promise.all([
    UserModel.countDocuments(),
    ProjectModel.countDocuments(),
    UserModel.countDocuments({ role: 'admin' }),
    AiDocumentModel.countDocuments(),
  ]);
  console.log(
    `🌱 Seeded — users: ${users}, projects: ${projects}, admins: ${admins}, docs: ${documents}`,
  );
}
