'use client';

import { UserManager } from '@/components/admin/user-manager';

export default function AdminClientsPage() {
  return (
    <UserManager
      role="client"
      title="Clients"
      subtitle="People who create projects and request documents."
    />
  );
}
