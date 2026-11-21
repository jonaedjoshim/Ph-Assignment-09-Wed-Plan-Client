"use client";

import {
  CalendarDays,
  Clock3,
  Crown,
  CreditCard,
  Heart,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Search,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";
import { authClient } from "@/lib/auth-client";

export type DashboardVariant = "customer" | "vendor" | "admin";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

type DashboardConfig = {
  title: string;
  items: NavItem[];
};

const dashboardConfig: Record<DashboardVariant, DashboardConfig> = {
  customer: {
    title: "Customer",
    items: [
      { label: "Overview", href: "/customer", icon: LayoutDashboard },
      { label: "My bookings", href: "/bookings", icon: CalendarDays },
      { label: "Saved services", href: "/customer/favorites", icon: Heart },
      { label: "Browse services", href: "/services", icon: Search },
      { label: "Profile settings", href: "/settings/profile", icon: UserRound },
    ],
  },
  vendor: {
    title: "Vendor",
    items: [
      { label: "Overview", href: "/vendor", icon: LayoutDashboard },
      { label: "My services", href: "/vendor/services", icon: LayoutGrid },
      { label: "Availability", href: "/vendor/availability", icon: Clock3 },
      {
        label: "Booking requests",
        href: "/vendor/bookings",
        icon: CalendarDays,
      },
      { label: "Subscription", href: "/vendor/subscription", icon: Crown },
      { label: "Profile settings", href: "/settings/profile", icon: UserRound },
    ],
  },
  admin: {
    title: "Admin",
    items: [
      { label: "Overview", href: "/admin", icon: LayoutDashboard },
      { label: "Manage users", href: "/admin/users", icon: Users },
      { label: "Review services", href: "/admin/services", icon: Layers },
      { label: "Transactions", href: "/admin/transactions", icon: CreditCard },
    ],
  },
};

const rootDashboardPaths = ["/customer", "/vendor", "/admin"];

function isActivePath(pathname: string, href: string): boolean {
  if (rootDashboardPaths.includes(href)) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function DashboardHeaderSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="h-[73px] border-b border-[#eaded8]/70 bg-[#fffaf7]/90"
    />
  );
}

export function DashboardShell({
  variant,
  children,
}: {
  variant: DashboardVariant;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();

  const config = dashboardConfig[variant];
  const userName = isSessionPending ? "" : (session?.user?.name ?? "");

  return (
    <div className="flex min-h-screen bg-wedplan-cream text-wedplan-ink">
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-[#eaded8] lg:bg-white">
        <div className="border-b border-[#eaded8] px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-wedplan-rose">
            {config.title} workspace
          </p>
          <p className="mt-2 truncate text-sm font-semibold text-wedplan-ink">
            {userName}
          </p>
        </div>

        <nav
          aria-label={`${config.title} dashboard navigation`}
          className="flex flex-col gap-1 px-4 py-5"
        >
          {config.items.map((item) => {
            const Icon = item.icon;
            const isActive = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-[#f5eae5] text-wedplan-rose"
                    : "text-stone-600 hover:bg-[#f8f2ef] hover:text-wedplan-ink"
                }`}
              >
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<DashboardHeaderSkeleton />}>
          <SiteHeader />
        </Suspense>

        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
