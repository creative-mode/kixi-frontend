"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  LogOut,
  X,
  Menu as MenuIcon,
  ChevronRight,
  FilePen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/actions/auth";
import { UserDisplay } from "./user-display";
import { fetchCurrentUser } from "@/lib/auth";
import { KixiLogo } from "./kixi-logo";

import { ENTITIES, NAV_KEYS } from "@/lib/crud/entities";

const allNavLinks = [
  {
    href: "/",
    label: "Dashboard",
    description: "Visão geral e métricas",
    icon: LayoutDashboard,
    color: "bg-accent text-primary",
  },
  {
    href: "/exam-builder",
    label: "Montar prova",
    description: "Prova no modelo da escola, pronta a imprimir",
    icon: FilePen,
    color: "bg-accent text-primary",
  },
  ...NAV_KEYS.map((k) => {
    const e = ENTITIES[k];
    return { href: `/${e.path}`, label: e.plural, description: e.description, icon: e.icon, color: e.tone };
  }),
];

export function ManagerNavbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [teacherOnly, setTeacherOnly] = useState(false);
  useEffect(() => {
    fetchCurrentUser().then((u) => setTeacherOnly(!!u && !u.roles.includes('ADMIN') && u.roles.includes('TEACHER')));
  }, []);
  // O professor só vê o exam builder.
  const navLinks = teacherOnly ? allNavLinks.filter((l) => l.href === '/exam-builder') : allNavLinks;
  const pathname = usePathname();

  // Don't render navbar on public pages (login)
  const isPublicPage = pathname === '/login' || pathname === '/403';

  // Close menu when route changes
  useEffect(() => {
    const task = window.setTimeout(() => setIsOpen(false), 0);
    return () => window.clearTimeout(task);
  }, [pathname]);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (isOpen && !isPublicPage) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen, isPublicPage]);

  if (isPublicPage) return null;

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 border-b-2 border-border bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-bold tracking-tighter z-50 relative flex items-center gap-2"
          >
            <KixiLogo size={28} wordmark />
            <span className="text-xs text-muted-foreground">Manager</span>
          </Link>

          <div className="flex items-center gap-4 z-50 relative">
            <div className="hidden md:block">
              <UserDisplay />
            </div>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-md border border-transparent hover:border-border hover:bg-accent transition-colors relative group"
            >
              <div className="relative w-6 h-6 flex items-center justify-center">
                <AnimatePresence mode="wait">
                  {isOpen ? (
                    <motion.div
                      key="close"
                      initial={{ rotate: -90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: 90, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <X size={24} />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="menu"
                      initial={{ rotate: 90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: -90, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <MenuIcon size={24} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: "-100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-40 bg-background pt-24 pb-8 overflow-y-auto"
          >
            <div className="container mx-auto px-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-6xl mx-auto">
                {navLinks.map((link, index) => {
                  const Icon = link.icon;
                  const isActive = link.href === "/" ? pathname === "/" : pathname === link.href || pathname.startsWith(`${link.href}/`);

                  return (
                    <motion.div
                      key={link.href}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 + 0.2 }}
                    >
                      <Link
                        href={link.href}
                        className={cn(
                          "group flex items-start gap-4 p-6 rounded-md border transition-colors duration-200",
                          isActive
                            ? "bg-accent border-primary"
                            : "bg-card hover:bg-accent border-border hover:border-primary"
                        )}
                      >
                        <div
                          className={cn(
                            "p-3 rounded-md",
                            link.color
                          )}
                        >
                          <Icon size={24} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-lg">
                              {link.label}
                            </span>
                            <ChevronRight
                              size={16}
                              className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-muted-foreground"
                            />
                          </div>
                          <p className="text-sm text-muted-foreground group-hover:text-foreground/80 transition-colors">
                            {link.description}
                          </p>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-12 max-w-6xl mx-auto border-t pt-8 flex justify-between items-center"
              >
                <div className="md:hidden">
                  <UserDisplay />
                </div>
                <Button variant="destructive" size="lg" className="ml-auto" onClick={() => logoutAction()}>
                  <LogOut size={18} />
                  Sair do sistema
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
