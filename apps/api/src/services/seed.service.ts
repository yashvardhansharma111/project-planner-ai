import bcrypt from 'bcryptjs';
import { AiDocumentModel } from '../models/AiDocument';
import { ProjectModel } from '../models/Project';
import { QuestionModel } from '../models/Question';
import { UserModel } from '../models/User';

const BCRYPT_ROUNDS = 12;

// ── Demo accounts ────────────────────────────────────────────────────────────
// Exactly ONE admin. Passwords are only applied on first insert ($setOnInsert),
// so re-runs never clobber a password you've since changed.
interface SeedUser {
  fullName: string;
  email: string;
  password: string;
  role: 'client' | 'admin' | 'tech';
}

const DEMO_PASSWORD = 'Demo12345';

const SEED_USERS: SeedUser[] = [
  { fullName: 'Platform Admin', email: 'admin@example.com', password: 'Admin@2026', role: 'admin' },
  { fullName: 'Demo Client', email: 'client@example.com', password: DEMO_PASSWORD, role: 'client' },
  { fullName: 'Priya Sharma', email: 'priya@example.com', password: DEMO_PASSWORD, role: 'client' },
  { fullName: 'Tech Reviewer', email: 'tech@example.com', password: DEMO_PASSWORD, role: 'tech' },
];

// ── Demo projects (owned by the client accounts above) ───────────────────────
interface SeedProject {
  ownerEmail: string;
  name: string;
  industry: string;
  description: string;
  budgetRange: string;
  targetCountries: string[];
  status: 'draft' | 'in_review' | 'approved' | 'locked' | 'archived';
  deadline?: string; // ISO date
}

const SEED_PROJECTS: SeedProject[] = [
  {
    ownerEmail: 'client@example.com',
    name: 'Fintech Onboarding App',
    industry: 'Fintech',
    description: 'KYC-compliant onboarding with tiered identity verification.',
    budgetRange: '$10k–$50k',
    targetCountries: ['IN', 'AE'],
    status: 'in_review',
    deadline: '2026-08-15',
  },
  {
    ownerEmail: 'client@example.com',
    name: 'Telehealth Booking Platform',
    industry: 'Healthcare',
    description: 'Appointment scheduling with video consults and e-prescriptions.',
    budgetRange: '$50k–$100k',
    targetCountries: ['IN', 'US'],
    status: 'draft',
    deadline: '2026-09-30',
  },
  {
    ownerEmail: 'priya@example.com',
    name: 'D2C Fashion Storefront',
    industry: 'Retail',
    description: 'Headless commerce store with AI-driven product recommendations.',
    budgetRange: '$10k–$50k',
    targetCountries: ['IN'],
    status: 'approved',
  },
  {
    ownerEmail: 'priya@example.com',
    name: 'Logistics Fleet Tracker',
    industry: 'Logistics',
    description: 'Real-time fleet tracking dashboard with route optimization.',
    budgetRange: '$100k+',
    targetCountries: ['IN', 'SG'],
    status: 'draft',
  },
];

// Projects that get demo PRD + TRD documents (approved, so the tech reviewer
// can download them). Keyed by project name.
const DOCUMENTED_PROJECTS = ['Fintech Onboarding App', 'D2C Fashion Storefront'];

function prdMarkdown(name: string, industry: string, description: string): string {
  return `# Product Requirements Document — ${name}

**Industry:** ${industry}
**Status:** Approved

## 1. Overview
${description}

## 2. Goals
- Deliver a focused MVP that validates the core value proposition.
- Ship an intuitive, accessible experience across web and mobile web.

## 3. Target Users
- Primary: end customers in the ${industry.toLowerCase()} space.
- Secondary: internal operators managing day-to-day workflows.

## 4. Key Features
1. Account creation and secure authentication.
2. Core workflow for the primary user journey.
3. Notifications and status tracking.
4. Admin dashboard for oversight.

## 5. Success Metrics
- Activation rate > 40% within first session.
- < 2% error rate on the critical path.

_Generated demo document — replace once AI generation is live._
`;
}

function trdMarkdown(name: string): string {
  return `# Technical Requirements Document — ${name}

**Status:** Approved

## 1. Architecture
Monorepo: Next.js frontend + Node.js/Express API, MongoDB via Mongoose.

## 2. Tech Stack
- Frontend: Next.js 14, React 18, Tailwind CSS.
- Backend: Node.js 20, Express 4, TypeScript 5.
- Data: MongoDB 7.x (Atlas), Mongoose 8.
- Auth: JWT access token + HTTP-only refresh cookie.

## 3. Data Model
Collections: users, projects, ai_documents (PRD/TRD).

## 4. APIs
REST under \`/api\` — auth, projects, documents, admin.

## 5. Security
- bcrypt (12 rounds) password hashing.
- Role-based access control: client / admin / tech.
- Helmet headers, CORS restricted to the frontend origin.

_Generated demo document — replace once AI generation is live._
`;
}

// ── Default questionnaire bank (admin-editable after seeding) ────────────────
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
  // Fintech
  { industry: 'Fintech', key: 'product', label: 'What financial product or service?', type: 'text', placeholder: 'e.g. digital wallet, lending, payments', required: true, order: 1 },
  { industry: 'Fintech', key: 'compliance', label: 'Key compliance needs', type: 'select', options: ['KYC/AML', 'PCI-DSS', 'PSD2 / Open Banking', 'Not sure'], order: 2 },
  { industry: 'Fintech', key: 'users', label: 'Who are the primary users?', type: 'text', placeholder: 'e.g. consumers, SMBs, agents', order: 3 },
  { industry: 'Fintech', key: 'integrations', label: 'Payment / banking integrations needed', type: 'text', placeholder: 'e.g. UPI, Stripe, card networks', order: 4 },

  // Healthcare
  { industry: 'Healthcare', key: 'solution', label: 'Type of healthcare solution', type: 'select', options: ['Telehealth', 'Patient records (EHR)', 'Appointment booking', 'Wellness/fitness', 'Other'], required: true, order: 1 },
  { industry: 'Healthcare', key: 'audience', label: 'Patient-facing or provider-facing?', type: 'select', options: ['Patient', 'Provider', 'Both'], order: 2 },
  { industry: 'Healthcare', key: 'compliance', label: 'Compliance requirements', type: 'text', placeholder: 'e.g. HIPAA, GDPR, India DPDP', order: 3 },
  { industry: 'Healthcare', key: 'features', label: 'Must-have features', type: 'multiselect', options: ['Video consults', 'E-prescriptions', 'Reminders', 'Patient records', 'Payments', 'Lab integrations'], order: 4 },

  // E-commerce / Retail
  { industry: 'E-commerce / Retail', key: 'model', label: 'Business model', type: 'select', options: ['D2C brand', 'Marketplace', 'B2B wholesale', 'Subscription'], required: true, order: 1 },
  { industry: 'E-commerce / Retail', key: 'commission', label: 'Marketplace commission & payout model', type: 'text', placeholder: 'e.g. 10% per order, weekly seller payouts', order: 2, dependsOnKey: 'model', dependsOnValue: 'Marketplace' },
  { industry: 'E-commerce / Retail', key: 'catalog', label: 'What are you selling?', type: 'text', placeholder: 'e.g. apparel, electronics, groceries', order: 3 },
  { industry: 'E-commerce / Retail', key: 'payments', label: 'Payment methods', type: 'multiselect', options: ['Cards', 'UPI', 'Wallets', 'COD', 'Net banking', 'BNPL'], order: 4 },
  { industry: 'E-commerce / Retail', key: 'features', label: 'Key features', type: 'textarea', placeholder: 'e.g. recommendations, reviews, loyalty', order: 5 },

  // Education
  { industry: 'Education', key: 'type', label: 'Type of platform', type: 'select', options: ['LMS / courses', 'Live tutoring', 'Test prep', 'School admin', 'Other'], required: true, order: 1 },
  { industry: 'Education', key: 'audience', label: 'Target learners', type: 'text', placeholder: 'e.g. K-12, university, professionals', order: 2 },
  { industry: 'Education', key: 'features', label: 'Core features', type: 'textarea', placeholder: 'e.g. video lessons, quizzes, certificates', order: 3 },

  // SaaS / Productivity
  { industry: 'SaaS / Productivity', key: 'problem', label: 'What problem does it solve?', type: 'textarea', placeholder: 'Describe the core workflow you improve', required: true, order: 1 },
  { industry: 'SaaS / Productivity', key: 'users', label: 'Who is it for?', type: 'text', placeholder: 'e.g. marketing teams, developers, HR', order: 2 },
  { industry: 'SaaS / Productivity', key: 'features', label: 'Key features', type: 'textarea', placeholder: 'e.g. dashboards, automations, integrations', order: 3 },

  // Other
  { industry: 'Other', key: 'idea', label: 'Describe your project idea', type: 'textarea', placeholder: 'What are you building and for whom?', required: true, order: 1 },
  { industry: 'Other', key: 'features', label: 'Key features', type: 'textarea', placeholder: 'List the must-have capabilities', order: 2 },
];

/** Idempotently seed the default questionnaire bank (upsert by industry+key). */
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

/**
 * Idempotently seeds demo users + projects + PRD/TRD documents + questionnaire
 * bank. Safe to run on every dev startup: users upserted by email, projects by
 * (ownerId, name), documents by (projectId, docType), questions by
 * (industry, key) — so nothing duplicates. Dev only.
 */
export async function seedDemoData(): Promise<void> {
  await seedQuestions();

  const idByEmail = new Map<string, string>();

  for (const u of SEED_USERS) {
    const passwordHash = await bcrypt.hash(u.password, BCRYPT_ROUNDS);
    const user = await UserModel.findOneAndUpdate(
      { email: u.email },
      {
        $set: { fullName: u.fullName, role: u.role, isActive: true },
        $setOnInsert: { passwordHash },
      },
      { upsert: true, new: true },
    );
    idByEmail.set(u.email, user.id);
  }

  const idByProjectName = new Map<string, string>();
  for (const p of SEED_PROJECTS) {
    const ownerId = idByEmail.get(p.ownerEmail);
    if (!ownerId) continue;
    const project = await ProjectModel.findOneAndUpdate(
      { ownerId, name: p.name },
      {
        $set: {
          industry: p.industry,
          description: p.description,
          budgetRange: p.budgetRange,
          targetCountries: p.targetCountries,
          status: p.status,
          ...(p.deadline ? { deadline: new Date(p.deadline) } : {}),
        },
      },
      { upsert: true, new: true },
    );
    idByProjectName.set(p.name, project.id);
  }

  // Seed approved PRD + TRD for the documented projects so the tech reviewer
  // (read-only, approved-only) has something to download.
  for (const p of SEED_PROJECTS) {
    if (!DOCUMENTED_PROJECTS.includes(p.name)) continue;
    const projectId = idByProjectName.get(p.name);
    if (!projectId) continue;

    const docs: { docType: 'prd' | 'trd'; content: string }[] = [
      { docType: 'prd', content: prdMarkdown(p.name, p.industry, p.description) },
      { docType: 'trd', content: trdMarkdown(p.name) },
    ];
    for (const d of docs) {
      await AiDocumentModel.findOneAndUpdate(
        { projectId, docType: d.docType },
        {
          $set: {
            content: d.content,
            isApproved: true,
            generatedBy: 'seed/demo',
          },
        },
        { upsert: true, new: true },
      );
    }
  }

  const [users, projects, admins, documents] = await Promise.all([
    UserModel.countDocuments(),
    ProjectModel.countDocuments(),
    UserModel.countDocuments({ role: 'admin' }),
    AiDocumentModel.countDocuments(),
  ]);
  console.log(
    `🌱 Demo data seeded — users: ${users}, projects: ${projects}, admins: ${admins}, docs: ${documents}`,
  );
  console.log(
    '   Logins: admin@example.com/Admin@2026 · client@example.com/Demo12345 · tech@example.com/Demo12345',
  );
}
