import { Link } from "@tanstack/react-router";
import { BarChart3, Database, FileSearch, History, Info, LayoutDashboard, Menu, Workflow } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppState } from "@/lib/store";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/data-processing", label: "Dataset Upload", icon: Database },
  { to: "/dataset-analysis", label: "Data Analysis", icon: FileSearch },
  { to: "/ml-analysis", label: "ML Model", icon: Workflow },
  { to: "/results", label: "Predictions", icon: BarChart3 },
  { to: "/history", label: "History", icon: History },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          activeOptions={{ exact: to === "/" }}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          activeProps={{
            className: "bg-sidebar-accent font-medium text-sidebar-foreground",
          }}
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}

function StatusFooter() {
  const { fileName, stage } = useAppState();
  const labels: Record<string, string> = {
    empty: "No dataset loaded",
    loaded: "Dataset loaded",
    cleaned: "Data cleaned",
    trained: "Model trained",
  };
  return (
    <div className="border-t border-sidebar-border px-4 py-3 text-xs text-sidebar-foreground/70">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "size-2 rounded-full",
            stage === "empty" ? "bg-muted-foreground" : "bg-chart-2",
          )}
        />
        <span>{labels[stage]}</span>
      </div>
      {fileName ? <p className="mt-1 truncate font-mono">{fileName}</p> : null}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col justify-between border-r border-sidebar-border bg-sidebar lg:flex">
        <div>
          <div className="border-b border-sidebar-border px-5 py-5">
            <p className="font-mono text-xs uppercase tracking-widest text-sidebar-primary">
              Analytics Workspace
            </p>
            <h1 className="mt-1 text-base font-semibold text-sidebar-foreground">
              BigData ML Analytics
            </h1>
          </div>
          <div className="p-3">
            <NavLinks />
            <div className="mt-3 border-t border-sidebar-border pt-3">
              <Link
                to="/about"
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                activeProps={{ className: "bg-sidebar-accent font-medium text-sidebar-foreground" }}
              >
                <Info className="size-4" aria-hidden />
                About project
              </Link>
            </div>
          </div>
        </div>
        <StatusFooter />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle navigation"
            >
              <Menu className="size-4" />
            </Button>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Big Data Machine Learning Pipeline
              </h2>
              <p className="text-xs text-muted-foreground">
                DataFrame processing + Random Forest classification
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <span className="size-2 rounded-full bg-chart-2" />
            Processing engine ready
          </div>
        </header>

        {open ? (
          <div className="border-b border-border bg-sidebar p-3 lg:hidden">
            <NavLinks onNavigate={() => setOpen(false)} />
            <Link
              to="/about"
              onClick={() => setOpen(false)}
              className="mt-2 flex items-center gap-3 border-t border-sidebar-border px-3 pt-3 pb-2 text-sm text-sidebar-foreground/70"
            >
              <Info className="size-4" aria-hidden />
              About project
            </Link>
          </div>
        ) : null}

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>

        <footer className="border-t border-border px-4 py-4 text-xs text-muted-foreground lg:px-8">
          Educational demonstration of big data processing and machine learning.
        </footer>
      </div>
    </div>
  );
}
