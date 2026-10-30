"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import {
  LayoutDashboard,
  LogOut,
  X,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
  FilePen,
  ClipboardCheck,
  FileSpreadsheet,
  DoorOpen,
  TrendingUp,
  Home,
  Sparkles,
  UserCheck,
  Gift,
  BadgeCheck,
  Flag,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/actions/auth";
import { resetTeacherScope } from "@/hooks/use-teacher-scope";
import { activeHref, groupLinks } from "@/lib/nav-rules";
import { UserDisplay } from "./user-display";
import { KixiLogo } from "./kixi-logo";

import { ENTITIES, NAV_KEYS } from "@/lib/crud/entities";

type NavLink = { href: string; label: string; icon: LucideIcon };

const allNavLinks: NavLink[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/exam-rooms", label: "Salas de Prova", icon: DoorOpen },
  { href: "/tarefas", label: "Tarefas das pautas", icon: ClipboardCheck },
  { href: "/pautas", label: "Pautas", icon: FileSpreadsheet },
  { href: "/desempenho", label: "Desempenho", icon: TrendingUp },
  { href: "/exam-builder", label: "Montar prova", icon: FilePen },
  { href: "/assign", label: "Atribuir", icon: UserCheck },
  { href: "/donations", label: "Doações", icon: Gift },
  { href: "/verification", label: "Verificação", icon: BadgeCheck },
  { href: "/moderacao", label: "Moderação", icon: Flag },
  ...NAV_KEYS.map((k) => {
    const e = ENTITIES[k];
    return { href: `/${e.path}`, label: e.plural, icon: e.icon };
  }),
];

// Tem de bater com `teacherMayOpen` em lib/roles.ts: um link aqui fora dessa
// lista mandava o professor de volta ao início.
const TEACHER_HREFS = ["/desempenho", "/tarefas", "/pautas", "/exam-rooms", "/statements", "/exam-builder", "/simulations", "/simulation-answers", "/classes"];

const teacherHomeLink: NavLink = { href: "/professor", label: "Início", icon: Home };

// FE-18 (#29): só do professor. O ADMIN não dá aulas; muda o estilo nas atribuições.
const teacherTutorLink: NavLink = { href: "/professor/tutor", label: "Estilo do tutor", icon: Sparkles };

/** Abaixo disto o menu é uma gaveta; daqui para cima é a barra lateral (`lg` no Tailwind). */
const DESKTOP_QUERY = "(min-width: 1024px)";

/** A barra lateral recolhida lembra-se entre visitas. O `<html>` leva o estado (data-nav) para o conteúdo se afastar da largura certa. */
const COLLAPSE_KEY = "kixi.manager.nav.collapsed";
const COLLAPSE_EVENT = "kixi:nav-collapse";

function subscribeCollapsed(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(COLLAPSE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(COLLAPSE_EVENT, onChange);
  };
}

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(next: boolean) {
  try {
    window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
  } catch {
    // Sem armazenamento (modo privado): a barra recolhe na mesma, só não se lembra.
  }
  window.dispatchEvent(new Event(COLLAPSE_EVENT));
}

function logout() {
  resetTeacherScope();
  logoutAction();
}

function NavList({
  links,
  pathname,
  collapsed = false,
  onNavigate,
}: {
  links: NavLink[];
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const { top, groups } = groupLinks(links);
  const current = activeHref(pathname, links.map((l) => l.href));

  const renderLink = ({ href, label, icon: Icon }: NavLink) => {
    const active = href === current;
    return (
      <li key={href}>
        <Link
          href={href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          title={collapsed ? label : undefined}
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
            collapsed && "justify-center px-0",
            active ? "bg-accent text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          <Icon size={18} aria-hidden="true" className="shrink-0" />
          <span className={collapsed ? "sr-only" : "truncate"}>{label}</span>
        </Link>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      {top.length > 0 && <ul className="space-y-1">{top.map(renderLink)}</ul>}
      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`nav-group-${group.id}`}>
          <h2
            id={`nav-group-${group.id}`}
            className={cn(
              "mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
              collapsed && "sr-only",
            )}
          >
            {group.label}
          </h2>
          {collapsed && <hr className="mx-3 mb-2 border-border" aria-hidden="true" />}
          <ul className="space-y-1">{group.items.map(renderLink)}</ul>
        </section>
      ))}
    </div>
  );
}

export function ManagerNavbar({ roles }: { roles: string[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);

  const isAdmin = roles.includes("ADMIN");
  const isTeacher = roles.includes("TEACHER");
  const navLinks = isTeacher && !isAdmin
    ? [teacherHomeLink, ...allNavLinks.filter((l) => TEACHER_HREFS.includes(l.href)), teacherTutorLink]
    : allNavLinks;
  const pathname = usePathname();

  // Don't render navbar on public pages (login)
  const isPublicPage = pathname === '/login' || pathname === '/403';

  const closeMenu = () => {
    setIsOpen(false);
    menuButton.current?.focus();
  };

  // A largura que o conteúdo reserva à barra lateral (ver `--nav-width` em globals.css).
  useEffect(() => {
    document.documentElement.dataset.nav = collapsed ? "collapsed" : "expanded";
  }, [collapsed]);

  // Close menu when route changes
  useEffect(() => {
    const task = window.setTimeout(() => setIsOpen(false), 0);
    return () => window.clearTimeout(task);
  }, [pathname]);

  // Ao passar para o ecrã largo a gaveta deixa de existir: fecha, para não deixar o conteúdo inerte.
  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => {
      if (desktop.matches) setIsOpen(false);
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

  // Com a gaveta aberta: o conteúdo atrás fica inerte (sem foco nem leitor de ecrã), o
  // scroll fica preso, o foco entra na gaveta e o Esc fecha-a e devolve o foco ao botão.
  useEffect(() => {
    if (!isOpen || isPublicPage) return;
    const content = document.getElementById("conteudo");
    content?.setAttribute("inert", "");
    document.body.style.overflow = "hidden";
    drawer.current?.querySelector<HTMLElement>("a, button")?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      menuButton.current?.focus();
    };
    document.addEventListener("keydown", onKey);

    return () => {
      content?.removeAttribute("inert");
      document.body.style.overflow = "unset";
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, isPublicPage]);

  if (isPublicPage) return null;

  return (
    <MotionConfig reducedMotion="user">
      <header className="fixed top-0 left-0 right-0 z-50 border-b-2 border-border bg-card">
        <div className="mx-auto flex h-16 items-center justify-between px-4">
          <div className="relative z-50 flex items-center gap-2">
            <button
              ref={menuButton}
              onClick={() => setIsOpen(!isOpen)}
              aria-label={isOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={isOpen}
              aria-controls="manager-menu"
              className="flex size-11 items-center justify-center rounded-md border border-transparent transition-colors hover:border-border hover:bg-accent lg:hidden"
            >
              {isOpen ? <X size={24} aria-hidden="true" /> : <MenuIcon size={24} aria-hidden="true" />}
            </button>
            <Link
              href="/"
              className="text-xl font-bold tracking-tighter z-50 relative flex items-center gap-2"
            >
              <KixiLogo size={28} wordmark />
              <span className="text-xs text-muted-foreground">Manager</span>
            </Link>
          </div>

          <div className="flex items-center gap-4 z-50 relative">
            <div className="hidden md:block">
              <UserDisplay />
            </div>
          </div>
        </div>
      </header>

      {/* Ecrã largo: a barra está sempre à vista, sem clique. */}
      <aside
        className={cn(
          "fixed bottom-0 left-0 top-16 z-30 hidden flex-col border-r-2 border-border bg-card transition-[width] duration-150 lg:flex",
          "w-(--nav-width)",
        )}
      >
        <nav aria-label="Principal" className="nav-scroll flex-1 overflow-y-auto p-3">
          <NavList links={navLinks} pathname={pathname} collapsed={collapsed} />
        </nav>
        <div className="space-y-2 border-t border-border p-3">
          <button
            type="button"
            onClick={() => writeCollapsed(!collapsed)}
            aria-label={collapsed ? "Expandir o menu lateral" : "Recolher o menu lateral"}
            title={collapsed ? "Expandir o menu lateral" : undefined}
            className={cn(
              "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
            {!collapsed && <span>Recolher</span>}
          </button>
          <Button
            variant="destructive"
            className={cn("min-h-11 w-full", collapsed && "px-0")}
            onClick={logout}
            aria-label="Sair do sistema"
            title={collapsed ? "Sair do sistema" : undefined}
          >
            <LogOut size={18} aria-hidden="true" />
            {!collapsed && "Sair"}
          </Button>
        </div>
      </aside>

      {/* Ecrã estreito: gaveta com a mesma navegação. */}
      <AnimatePresence>
        {isOpen && (
          <div className="lg:hidden">
            <motion.button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={closeMenu}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-x-0 bottom-0 top-16 z-40 bg-foreground/40"
            />
            <motion.div
              ref={drawer}
              id="manager-menu"
              role="dialog"
              aria-modal="true"
              aria-label="Menu principal"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="fixed bottom-0 left-0 top-16 z-40 flex w-80 max-w-[85vw] flex-col border-r-2 border-border bg-card"
            >
              <nav aria-label="Principal" className="nav-scroll flex-1 overflow-y-auto p-3">
                <NavList links={navLinks} pathname={pathname} />
              </nav>
              <div className="flex items-center justify-between gap-3 border-t border-border p-3">
                <div className="md:hidden">
                  <UserDisplay />
                </div>
                <Button variant="destructive" className="ml-auto min-h-11" onClick={logout}>
                  <LogOut size={18} aria-hidden="true" />
                  Sair do sistema
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </MotionConfig>
  );
}
