import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { LogoutButton } from "@/components/auth/LogoutButton";

const navigation = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Resources", href: "/resources" },
  { label: "Reservations", href: "/reservations" },
];

export function AppHeader() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link
          href="/dashboard"
          aria-label="ReserveHub dashboard"
          className="flex items-center gap-2 rounded-md font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <CalendarDays className="size-5" aria-hidden="true" />
          <span className="text-lg">ReserveHub</span>
        </Link>

        <nav
          aria-label="Application navigation"
          className="flex flex-wrap items-center gap-1"
        >
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <LogoutButton />
      </div>
    </header>
  );
}
