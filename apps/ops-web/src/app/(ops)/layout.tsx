"use client";

import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { LicenseBanner } from "@/components/shared/license-banner";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import {
  LayoutDashboard,
  Users,
  Warehouse,
  Package,
  TruckIcon,
  CalendarClock,
  Boxes,
  ShieldAlert,
  Settings as SettingsIcon,
  LogOut,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
  Search,
  FileText,
  PackageOpen,
  ListChecks,
  PackageCheck,
  Key,
  RotateCcw,
  BookOpen,
  BarChart3,
  CreditCard,
  Sparkles,
  Undo2,
  Radio,
  Bell,
  ArrowDownToLine,
} from "lucide-react";

const navigation = [
  {
    name: "OVERVIEW",
    items: [{ name: "Dashboard", href: "/", icon: LayoutDashboard }],
  },
  {
    name: "MASTER DATA",
    items: [
      { name: "Clients", href: "/clients", icon: Users },
      { name: "Warehouses", href: "/warehouses", icon: Warehouse },
      { name: "Items", href: "/items", icon: Package },
    ],
  },
  {
    name: "INBOUND",
    items: [
      { name: "Receipts", href: "/receipts", icon: TruckIcon },
      { name: "Appointments", href: "/appointments", icon: CalendarClock },
    ],
  },
  {
    name: "INVENTORY",
    items: [
      { name: "Stock", href: "/inventory", icon: Boxes },
      { name: "Putaway", href: "/putaway", icon: ArrowDownToLine },
      { name: "Cycle Count", href: "/cycle-count", icon: RotateCcw },
      { name: "Ledger", href: "/ledger", icon: BookOpen },
      { name: "Holds", href: "/holds", icon: ShieldAlert },
      { name: "Adjustments", href: "/adjustments", icon: FileText },
    ],
  },
  {
    name: "OUTBOUND",
    items: [
      { name: "Orders", href: "/orders", icon: PackageOpen },
      { name: "Waves", href: "/waves", icon: ListChecks },
      { name: "Pick Tasks", href: "/pick-tasks", icon: ListChecks },
      { name: "Shipments", href: "/shipments", icon: PackageCheck },
    ],
  },
  {
    name: "REPORTS",
    items: [{ name: "Reports", href: "/reports", icon: BarChart3 }],
  },
  {
    name: "COMMERCIAL",
    items: [
      { name: "Billing", href: "/billing", icon: CreditCard },
      { name: "VAS", href: "/billing/vas", icon: Sparkles },
      { name: "RMA", href: "/billing/rma", icon: Undo2 },
      { name: "EDI", href: "/billing/edi", icon: Radio },
    ],
  },
  {
    name: "SETTINGS",
    items: [
      { name: "Users", href: "/settings/users", icon: Users },
      { name: "Notifications", href: "/settings/notifications", icon: Bell },
      { name: "License", href: "/settings/license", icon: Key },
    ],
  },
];

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const breadcrumbs = pathname
    .split("/")
    .filter(Boolean)
    .map((segment, index, array) => {
      const href = "/" + array.slice(0, index + 1).join("/");
      const name = segment
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      return { name, href };
    });

  const userInitials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "U";

  const isAdmin = session?.user?.role === "ADMIN";

  const navigateTo = (href: string) => {
    setCommandOpen(false);
    router.push(href);
  };

  return (
    <div className="min-h-screen bg-background">
      <LicenseBanner daysRemaining={25} />
      
      <div className="flex">
        <aside
          className={cn(
            "fixed left-0 top-0 z-40 h-screen border-r bg-muted/50 transition-all duration-300",
            sidebarCollapsed ? "w-16" : "w-64"
          )}
        >
          <div className="flex h-full flex-col">
            <div className="flex h-14 items-center justify-between border-b px-4">
              {!sidebarCollapsed && (
                <h2 className="text-lg font-semibold">WMS Ops</h2>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className={cn(sidebarCollapsed && "mx-auto")}
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-2">
              {navigation.map((section) => (
                <div key={section.name} className="py-2">
                  {!sidebarCollapsed && (
                    <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {section.name}
                    </p>
                  )}
                  {section.items.map((item) => {
                    const active = isActive(item.href);
                    const Icon = item.icon;
                    
                    // Hide License page for non-admins
                    if (item.href === "/settings/license" && !isAdmin) {
                      return null;
                    }

                    return (
                      <Link key={item.href} href={item.href}>
                        <div
                          className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                            active
                              ? "bg-primary/10 text-primary border-l-2 border-primary"
                              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {!sidebarCollapsed && <span>{item.name}</span>}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>
          </div>
        </aside>

        <div
          className={cn(
            "flex-1 transition-all duration-300",
            sidebarCollapsed ? "ml-16" : "ml-64"
          )}
        >
          <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-6">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Home</BreadcrumbLink>
                </BreadcrumbItem>
                {breadcrumbs.map((crumb, index) => (
                  <span key={crumb.href} className="flex items-center gap-1.5">
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {index === breadcrumbs.length - 1 ? (
                        <BreadcrumbPage>{crumb.name}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink href={crumb.href}>
                          {crumb.name}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </span>
                ))}
              </BreadcrumbList>
            </Breadcrumb>

            <div className="ml-auto flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCommandOpen(true)}
              >
                <Search className="mr-2 h-4 w-4" />
                <span className="hidden md:inline">Search...</span>
                <kbd className="pointer-events-none ml-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 md:inline-flex">
                  ⌘K
                </kbd>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{userInitials}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {session?.user?.name}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {session?.user?.email}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground mt-1">
                        Role: {session?.user?.role}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/settings")}>
                    <SettingsIcon className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="p-6">{children}</main>
        </div>
      </div>

      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Search pages…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {navigation.map((section) => (
            <CommandGroup key={section.name} heading={section.name}>
              {section.items.map((item) => {
                if (item.href === "/settings/license" && !isAdmin) {
                  return null;
                }
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.href}
                    value={`${section.name} ${item.name}`}
                    onSelect={() => navigateTo(item.href)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {item.name}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </div>
  );
}
