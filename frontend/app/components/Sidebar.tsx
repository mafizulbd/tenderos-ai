"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, BookOpen, Briefcase, Building, Building2, CalendarDays, FileSearch, FileSignature,
  FolderKanban, Globe, LogOut, ShieldCheck, Users,
} from "lucide-react";
import type { User } from "../types";
import { SECONDARY_MODULES_ENABLED } from "../features";

type Props = {
  user: User;
  onLogout: () => void;
};

type NavItem = { href: string; label: string; icon: typeof BarChart3 };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Overview", icon: BarChart3 },
      { href: "/dashboard/tenders", label: "Tender library", icon: FolderKanban },
      { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/dashboard/team", label: "Team", icon: Users },
      ...(SECONDARY_MODULES_ENABLED
        ? [
            { href: "/dashboard/vendors", label: "Vendors", icon: Building },
            { href: "/dashboard/contracts", label: "Contracts", icon: FileSignature },
          ]
        : []),
      { href: "/dashboard/knowledge-base", label: "Knowledge base", icon: BookOpen },
      { href: "/dashboard/profile", label: "Company profile", icon: Building2 },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/dashboard/discovery", label: "Discovery", icon: Globe },
      { href: "/dashboard/doc-validator", label: "Doc Validator", icon: ShieldCheck },
    ],
  },
];

export function Sidebar({ user, onLogout }: Props) {
  const initial = user.email.charAt(0);
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">
          <FileSearch size={20} />
        </div>
        <div>
          <strong>TenderOS AI</strong>
          <span>Bangladesh Procurement</span>
        </div>
      </div>

      <nav className="nav-sections" aria-label="Dashboard sections">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="nav-group-label">{group.label}</p>
            <div className="nav-list">
              {group.items.map((item) => (
                <Link key={item.href} href={item.href} className={pathname === item.href ? "active" : ""}>
                  <item.icon size={17} />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <Link href="/dashboard/tenders" className="ai-proposal-hint">
        <Briefcase size={16} />
        <span>Open a tender → <strong>AI Proposal</strong> to generate a full bid</span>
      </Link>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <span className="sidebar-user-avatar">{initial}</span>
          <span className="sidebar-user-email">{user.email}</span>
        </div>
        <button onClick={onLogout} title="Logout">
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </aside>
  );
}
