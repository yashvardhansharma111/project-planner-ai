import { redirect } from 'next/navigation';

// Users management is now split into Clients + Developers.
export default function AdminUsersPage() {
  redirect('/admin/clients');
}
