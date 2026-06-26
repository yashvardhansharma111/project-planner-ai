'use client';

import { UserManager } from '@/components/admin/user-manager';

export default function AdminDevelopersPage() {
  return (
    <UserManager
      role="tech"
      title="Developers"
      subtitle="Technical users who can view and download approved documents."
    />
  );
}
