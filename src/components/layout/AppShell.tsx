import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  BrainCircuit,
  BriefcaseBusiness,
  CloudCog,
  DatabaseZap,
  ExternalLink,
  FlaskConical,
  LayoutDashboard,
  ShieldCheck,
  Target,
} from "lucide-react";
import { useSupabase } from "../../lib/supabase/SupabaseProvider";
import { cn } from "../../lib/styles";
import { AmbientBackdrop } from "./AmbientBackdrop";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/study", label: "Study OS", icon: Target },
  { to: "/lab", label: "Lab", icon: FlaskConical },
  { to: "/career", label: "Career OS", icon: BriefcaseBusiness },
  { to: "/quiz", label: "Quiz", icon: BrainCircuit },
  { to: "/wiki", label: "Wiki", icon: BookOpen },
];

const examActiveKey = "nebula-hub:exam:active";
const leaveExamMessage =
  "Your active AWS exam timer and randomized question set will reset if you leave. Are you sure?";

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { smoke } = useSupabase();

  const confirmExamNavigation = (targetPath: string) => {
    if (
      location.pathname !== "/quiz" ||
      targetPath === "/quiz" ||
      window.localStorage.getItem(examActiveKey) !== "true"
    ) {
      return true;
    }

    const confirmed = window.confirm(leaveExamMessage);

    if (confirmed) {
      window.localStorage.removeItem(examActiveKey);
    }

    return confirmed;
  };

  return (
    <div className="min-h-screen text-slate-100">
      <AmbientBackdrop />
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/55 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <NavLink
              className="group flex min-w-0 items-center gap-3"
              onClick={(event) => {
                if (!confirmExamNavigation("/")) {
                  event.preventDefault();
                }
              }}
              to="/"
            >
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/25 bg-cyan-200/10 shadow-[0_0_32px_rgba(34,211,238,0.22)]">
                <CloudCog className="h-6 w-6 text-cyan-100" />
                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.75)]" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold tracking-wide text-white">
                  Nebula-Hub
                </p>
                <p className="truncate text-xs font-medium uppercase tracking-[0.22em] text-slate-500">
                  AWS command center
                </p>
              </div>
            </NavLink>

            <nav className="flex w-full gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.045] p-1 lg:w-auto">
              {navItems.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    className={({ isActive }) =>
                      cn(
                        "relative flex min-h-11 min-w-28 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition",
                        isActive
                          ? "text-white"
                          : "text-slate-400 hover:bg-white/[0.06] hover:text-white",
                      )
                    }
                    end={item.to === "/"}
                    key={item.to}
                    onClick={(event) => {
                      if (!confirmExamNavigation(item.to)) {
                        event.preventDefault();
                      }
                    }}
                    to={item.to}
                  >
                    {({ isActive }) => (
                      <>
                        {isActive ? (
                          <motion.span
                            layoutId="nav-active"
                            className="absolute inset-0 rounded-xl border border-cyan-200/25 bg-cyan-200/12 shadow-[0_0_24px_rgba(34,211,238,0.16)]"
                          />
                        ) : null}
                        <Icon className="relative h-4 w-4" />
                        <span className="relative whitespace-nowrap">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                );
              })}
            </nav>

          </div>

          <div className="grid gap-3 text-xs text-slate-400 md:grid-cols-3">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">
              <DatabaseZap className="h-4 w-4 text-cyan-200" />
              Services: {smoke?.services.count ?? "pending"}
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">
              <BrainCircuit className="h-4 w-4 text-teal-200" />
              Quiz prompts: {smoke?.quiz.count ?? "pending"}
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">
              <ShieldCheck className="h-4 w-4 text-amber-200" />
              Frontend anon access only
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(8px)" }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="mx-auto flex max-w-7xl flex-col gap-3 px-4 pb-8 pt-2 text-sm text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <span>Designed by Nebiyu Mekonnen</span>
        <a
          className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 font-semibold text-slate-300 transition hover:border-cyan-200/25 hover:bg-cyan-200/10 hover:text-cyan-50"
          href="https://www.linkedin.com/in/nebiyumekonnen/"
          rel="noreferrer"
          target="_blank"
        >
          LinkedIn
          <ExternalLink className="h-4 w-4" />
        </a>
      </footer>
    </div>
  );
}
