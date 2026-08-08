"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, BookOpen, Briefcase, Building, Building2, CalendarDays, FileSearch, FileSignature,
  FolderKanban, Globe, LogOut, ShieldCheck, Users,
} from "lucide-react";
import type { User } from "../types";
import { SECONDARY_MODULES_ENABLED } from "../features";
import { useLanguage } from "../i18n/LanguageContext";
import { translations } from "../i18n/translations";
import { LanguageToggle } from "./LanguageToggle";

type Props = {
  user: User;
  onLogout: () => void;
};

type NavKey = keyof (typeof translations)["en"]["nav"];
type NavItem = { href: string; labelKey: NavKey; icon: typeof BarChart3 };
type NavGroup = { groupKey: NavKey; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    groupKey: "groupWorkspace",
    items: [
      { href: "/dashboard", labelKey: "overview", icon: BarChart3 },
      { href: "/dashboard/tenders", labelKey: "tenderLibrary", icon: FolderKanban },
      { href: "/dashboard/calendar", labelKey: "calendar", icon: CalendarDays },
    ],
  },
  {
    groupKey: "groupManage",
    items: [
      { href: "/dashboard/team", labelKey: "team", icon: Users },
      ...(SECONDARY_MODULES_ENABLED
        ? ([
            { href: "/dashboard/vendors", labelKey: "vendors", icon: Building },
            { href: "/dashboard/contracts", labelKey: "contracts", icon: FileSignature },
          ] satisfies NavItem[])
        : []),
      { href: "/dashboard/knowledge-base", labelKey: "knowledgeBase", icon: BookOpen },
      { href: "/dashboard/profile", labelKey: "companyProfile", icon: Building2 },
    ],
  },
  {
    groupKey: "groupTools",
    items: [
      { href: "/dashboard/discovery", labelKey: "discovery", icon: Globe },
      { href: "/dashboard/doc-validator", labelKey: "docValidator", icon: ShieldCheck },
    ],
  },
];

export function Sidebar({ user, onLogout }: Props) {
  const initial = user.email.charAt(0);
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">
          <FileSearch size={20} />
        </div>
        <div>
          <strong>TenderOS AI</strong>
          <span>{t("nav", "brandTagline")}</span>
        </div>
      </div>

      <nav className="nav-sections" aria-label="Dashboard sections">
        {NAV_GROUPS.map((group) => (
          <div key={group.groupKey}>
            <p className="nav-group-label">{t("nav", group.groupKey)}</p>
            <div className="nav-list">
              {group.items.map((item) => (
                <Link key={item.href} href={item.href} className={pathname === item.href ? "active" : ""}>
                  <item.icon size={17} />
                  {t("nav", item.labelKey)}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <Link href="/dashboard/tenders" className="ai-proposal-hint">
        <Briefcase size={16} />
        <span>
          {t("nav", "aiProposalHintPrefix")}
          <strong>{t("nav", "aiProposalHintBold")}</strong>
          {t("nav", "aiProposalHintSuffix")}
        </span>
      </Link>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <span className="sidebar-user-avatar">{initial}</span>
          <span className="sidebar-user-email">{user.email}</span>
        </div>
        <LanguageToggle />
        <button onClick={onLogout} title={t("common", "logout")}>
          <LogOut size={16} />
          {t("common", "logout")}
        </button>
      </div>
    </aside>
  );
}
