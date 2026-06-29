'use client';

import {
  Code2,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Menu,
  Plus,
  Settings,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Brand } from './brand';
import { ProfileMenu } from './profile-menu';
import { ThemeToggle } from './theme-toggle';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const ADMIN_LINKS: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/new/chat', label: 'New Project', icon: Plus },
  { href: '/admin/clients', label: 'Clients', icon: Users },
  { href: '/admin/developers', label: 'Developers', icon: Code2 },
  { href: '/admin/projects', label: 'Projects', icon: FolderKanban },
  { href: '/admin/questions', label: 'Questionnaire', icon: ListChecks },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

const CLIENT_LINKS: NavItem[] = [
  { href: '/dashboard/new/chat', label: 'New Project', icon: Plus },
  { href: '/dashboard', label: 'My Projects', icon: FolderKanban },
  { href: '/dashboard/documents', label: 'Documents', icon: FileText },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

const TECH_LINKS: NavItem[] = [
  { href: '/tech/dashboard', label: 'Workspace', icon: LayoutDashboard },
  { href: '/dashboard/documents', label: 'Documents', icon: FileText },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

/** Industry-style app shell: persistent sidebar that collapses to an icon rail
 *  on desktop, and a slide-over drawer on mobile. One hamburger drives both. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false); // desktop rail
  const [mobileOpen, setMobileOpen] = useState(false); // mobile drawer

  // Restore the desktop collapse preference.
  useEffect(() => {
    setCollapsed(localStorage.getItem('sidebarCollapsed') === '1');
  }, []);

  function toggle() {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setMobileOpen((o) => !o);
    } else {
      setCollapsed((c) => {
        localStorage.setItem('sidebarCollapsed', c ? '0' : '1');
        return !c;
      });
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar — full width, sits above the sidebar.
          hamburger + brand (left), theme toggle + profile (right) */}
      <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            aria-label="Toggle menu"
            className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Brand />
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <ProfileMenu />
        </div>
      </header>

      {/* Body — sidebar (starts below the top bar) + page content */}
      <div className="flex flex-1">
        {/* Mobile overlay, starts under the top bar */}
        {mobileOpen && (
          <div
            className="fixed inset-x-0 bottom-0 top-14 z-30 bg-slate-900/30 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <Sidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}

function Sidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const { user } = useAuth();
  const pathname = usePathname();
  const links =
    user?.role === 'admin' ? ADMIN_LINKS : user?.role === 'tech' ? TECH_LINKS : CLIENT_LINKS;

  return (
    <aside
      className={`no-print fixed bottom-0 left-0 top-14 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-all duration-200 lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:translate-x-0 ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      } ${collapsed ? 'lg:w-20' : 'lg:w-64'}`}
    >
      {/* Mobile-only close affordance (drawer); the brand lives in the top bar. */}
      <div className="flex h-12 items-center justify-end px-3 lg:hidden">
        <button
          onClick={onCloseMobile}
          className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-2 lg:pt-4">
        {links.map((l) => {
          // "/dashboard" should only light up for itself + project detail pages,
          // not for sibling routes like /dashboard/documents or /dashboard/new.
          const active =
            l.href === '/dashboard'
              ? pathname === '/dashboard' || pathname.startsWith('/dashboard/projects')
              : l.href === '/dashboard/new/chat'
                ? pathname.startsWith('/dashboard/new') // any intake method
                : pathname === l.href || pathname.startsWith(l.href + '/');
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={onCloseMobile}
              title={collapsed ? l.label : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              } ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className={collapsed ? 'lg:hidden' : ''}>{l.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
