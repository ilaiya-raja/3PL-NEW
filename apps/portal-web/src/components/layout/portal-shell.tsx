'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  Moon,
  Sun,
  LogOut,
  Package,
  Inbox,
  LayoutDashboard,
  Menu,
  PackagePlus,
  Truck,
  ChevronLeft,
  ChevronRight,
  Boxes,
  Files,
  BarChart3,
  Receipt,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { applyBrandPrimary } from '@/lib/branding';
import { useEffect, useState } from 'react';

const overviewItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
];

const operationsItems = [
  { href: '/inventory', label: 'Inventory', icon: Boxes },
  { href: '/orders', label: 'Orders', icon: Package },
  { href: '/inbound', label: 'Inbound', icon: Inbox },
  { href: '/documents', label: 'Documents', icon: Files },
  { href: '/invoices', label: 'Invoices', icon: Receipt },
];

const actionItems = [
  { href: '/orders', label: 'Create order', icon: PackagePlus, hash: 'create' },
  { href: '/inbound', label: 'Create ASN', icon: Truck, hash: 'create' },
];

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

function NavSection({
  title,
  collapsed,
  children,
}: {
  title: string;
  collapsed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      {!collapsed && (
        <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href as '/'}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={cn(
        'group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
        collapsed && 'justify-center px-2',
        active
          ? 'bg-primary/12 text-primary'
          : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
      )}
    >
      <Icon
        className={cn(
          'h-4 w-4 shrink-0',
          active ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'
        )}
      />
      {!collapsed && <span className="truncate">{label}</span>}
      {active && !collapsed && (
        <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
      )}
    </Link>
  );
}

function SidebarBody({
  collapsed,
  onNavigate,
  companyName,
  logoUrl,
  userName,
  userEmail,
  initials,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
  companyName: string;
  logoUrl?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  initials: string;
}) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          'flex items-center border-b border-border/70 px-4 py-5',
          collapsed && 'justify-center px-2'
        )}
      >
        <Link
          href="/"
          onClick={onNavigate}
          className={cn('min-w-0', collapsed && 'flex justify-center')}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={companyName}
              className={cn(
                'object-contain',
                collapsed ? 'h-8 w-8' : 'h-9 w-auto max-w-[180px]'
              )}
            />
          ) : collapsed ? (
            <span className="flex h-9 w-9 items-center justify-center bg-primary/12 font-display text-sm font-semibold text-primary">
              {companyName.slice(0, 1).toUpperCase()}
            </span>
          ) : (
            <div className="min-w-0">
              <p className="font-display truncate text-lg font-semibold leading-tight tracking-tight">
                {companyName}
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Client portal
              </p>
            </div>
          )}
        </Link>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        <NavSection title="Overview" collapsed={collapsed}>
          {overviewItems.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={isActive(pathname, item.href)}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </NavSection>

        <NavSection title="Operations" collapsed={collapsed}>
          {operationsItems.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={isActive(pathname, item.href)}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </NavSection>

        <NavSection title="Quick actions" collapsed={collapsed}>
          {actionItems.map((item) => (
            <NavLink
              key={item.label}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={false}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          ))}
        </NavSection>
      </div>

      <div className="space-y-2 border-t border-border/70 p-3">
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'sm'}
          className={cn(
            'w-full text-muted-foreground',
            !collapsed && 'justify-start gap-3 px-3'
          )}
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          title="Toggle theme"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          {!collapsed && <span>Theme</span>}
        </Button>

        <div
          className={cn(
            'flex items-center gap-3 rounded-md bg-muted/40 px-3 py-2.5',
            collapsed && 'justify-center px-2'
          )}
        >
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-secondary text-[11px] font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-none">
                {userName}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {userEmail}
              </p>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'sm'}
          className={cn(
            'w-full text-muted-foreground hover:text-destructive',
            !collapsed && 'justify-start gap-3 px-3'
          )}
          onClick={() => signOut({ callbackUrl: '/login' })}
          title="Log out"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Log out</span>}
        </Button>
      </div>
    </div>
  );
}

export function PortalShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    applyBrandPrimary(session?.user?.branding?.primaryColor);
  }, [session?.user?.branding?.primaryColor]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const companyName =
    session?.user?.branding?.companyName || 'Client Portal';
  const initials =
    session?.user?.name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase() || '?';

  const shellProps = {
    companyName,
    logoUrl: session?.user?.branding?.logoUrl,
    userName: session?.user?.name,
    userEmail: session?.user?.email,
    initials,
  };

  const pageTitle =
    [...overviewItems, ...operationsItems].find((i) =>
      isActive(pathname, i.href)
    )?.label || 'Portal';

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'sticky top-0 z-40 hidden h-screen shrink-0 border-r border-border/70 bg-card backdrop-blur-md transition-[width] duration-300 md:flex md:flex-col',
          collapsed ? 'w-[72px]' : 'w-[260px]'
        )}
      >
        <SidebarBody collapsed={collapsed} {...shellProps} />
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="absolute -right-3 top-20 z-50 flex h-6 w-6 items-center justify-center border border-border/80 bg-card text-muted-foreground shadow-sm hover:text-foreground"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/70 bg-card px-4 backdrop-blur-md md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <SidebarBody
                {...shellProps}
                onNavigate={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <div className="min-w-0">
            <p className="truncate font-display text-base font-semibold tracking-tight">
              {companyName}
            </p>
            <p className="truncate text-xs text-muted-foreground">{pageTitle}</p>
          </div>
        </header>

        <main className="portal-main flex-1 px-4 py-8 sm:px-8 sm:py-10 lg:px-10">
          <div className="mx-auto max-w-portal animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
