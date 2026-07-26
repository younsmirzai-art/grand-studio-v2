"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  LayoutDashboard,
  FolderOpen,
  Heart,
  Sparkles,
  Search,
  Rocket,
  CreditCard,
  Settings,
  LifeBuoy,
  Shield,
  FileText,
  LogOut,
  CornerDownLeft,
  type LucideIcon,
} from "lucide-react";
import { getClient } from "@/lib/supabase/client";

/** Lets the top bar's ⌘K affordance open the palette without prop drilling. */
export const OPEN_COMMAND_PALETTE_EVENT = "gs:open-command-palette";

type CommandAction =
  | { type: "navigate"; href: string }
  | { type: "search" }
  | { type: "signOut" };

interface CommandItem {
  id: string;
  label: string;
  group: string;
  icon: LucideIcon;
  keywords?: string;
  action: CommandAction;
}

const COMMANDS: CommandItem[] = [
  {
    id: "overview",
    label: "Overview",
    group: "Navigate",
    icon: LayoutDashboard,
    keywords: "dashboard home",
    action: { type: "navigate", href: "/dashboard" },
  },
  {
    id: "library",
    label: "My Library",
    group: "Navigate",
    icon: FolderOpen,
    keywords: "downloads history",
    action: { type: "navigate", href: "/library" },
  },
  {
    id: "favorites",
    label: "Favorites",
    group: "Navigate",
    icon: Heart,
    keywords: "saved starred",
    action: { type: "navigate", href: "/library?tab=favorites" },
  },
  {
    id: "generate",
    label: "AI Generator",
    group: "Navigate",
    icon: Sparkles,
    keywords: "create prompt text to 3d",
    action: { type: "navigate", href: "/generate" },
  },
  {
    id: "browse",
    label: "Browse Models",
    group: "Navigate",
    icon: Search,
    keywords: "marketplace explore catalog",
    action: { type: "navigate", href: "/browse" },
  },
  {
    id: "plugin",
    label: "UE5 Plugin",
    group: "Navigate",
    icon: Rocket,
    keywords: "unreal engine fab commander",
    action: { type: "navigate", href: "/plugin" },
  },
  {
    id: "pricing",
    label: "Pricing",
    group: "Navigate",
    icon: CreditCard,
    keywords: "upgrade pro billing plans",
    action: { type: "navigate", href: "/pricing" },
  },
  {
    id: "settings",
    label: "Settings",
    group: "Navigate",
    icon: Settings,
    keywords: "account profile api key",
    action: { type: "navigate", href: "/settings" },
  },
  {
    id: "support",
    label: "Contact Support",
    group: "Help & Legal",
    icon: LifeBuoy,
    keywords: "help contact us email question",
    action: { type: "navigate", href: "/support" },
  },
  {
    id: "privacy",
    label: "Privacy Policy",
    group: "Help & Legal",
    icon: Shield,
    keywords: "data gdpr legal",
    action: { type: "navigate", href: "/privacy" },
  },
  {
    id: "terms",
    label: "Terms of Service",
    group: "Help & Legal",
    icon: FileText,
    keywords: "legal conditions agreement",
    action: { type: "navigate", href: "/terms" },
  },
  {
    id: "signout",
    label: "Sign out",
    group: "Account",
    icon: LogOut,
    keywords: "log out exit leave",
    action: { type: "signOut" },
  },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((previous) => !previous);
      }
    }
    function handleOpenRequest() {
      setOpen(true);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpenRequest);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpenRequest);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  const results = useMemo(() => {
    const trimmed = query.trim();
    const needle = trimmed.toLowerCase();

    const matches = COMMANDS.filter(
      (command) =>
        !needle ||
        command.label.toLowerCase().includes(needle) ||
        command.keywords?.includes(needle)
    );

    if (!trimmed) return matches;

    return [
      {
        id: "search-models",
        label: `Search models for "${trimmed}"`,
        group: "Search",
        icon: Search,
        action: { type: "search" } as CommandAction,
      },
      ...matches,
    ];
  }, [query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const runCommand = useCallback(
    async (command: CommandItem) => {
      setOpen(false);

      switch (command.action.type) {
        case "navigate":
          router.push(command.action.href);
          return;
        case "search":
          router.push(`/browse?q=${encodeURIComponent(query.trim())}`);
          return;
        case "signOut":
          await getClient().auth.signOut();
          router.push("/");
          router.refresh();
          return;
        default: {
          const exhaustive: never = command.action;
          throw new Error(`Unhandled command action: ${JSON.stringify(exhaustive)}`);
        }
      }
    },
    [query, router]
  );

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = results[activeIndex];
      if (command) void runCommand(command);
    }
  }

  const groups = useMemo(() => {
    const grouped = new Map<string, Array<{ command: CommandItem; index: number }>>();
    results.forEach((command, index) => {
      const existing = grouped.get(command.group);
      if (existing) {
        existing.push({ command, index });
      } else {
        grouped.set(command.group, [{ command, index }]);
      }
    });
    return Array.from(grouped.entries());
  }, [results]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 overflow-hidden sm:max-w-xl bg-[var(--gs-bg-surface)] border-white/10"
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>

        <div className="flex items-center gap-3 px-4 border-b border-white/5">
          <Search className="w-4 h-4 text-white/30 flex-shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search or jump to..."
            className="flex-1 bg-transparent py-4 text-sm text-white placeholder:text-white/40 outline-none"
          />
          <kbd className="text-[10px] text-white/30 border border-white/10 rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-white/40">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            groups.map(([groupName, entries]) => (
              <div key={groupName} className="mb-2 last:mb-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-white/30 px-3 py-1.5">
                  {groupName}
                </div>
                {entries.map(({ command, index }) => (
                  <button
                    key={command.id}
                    type="button"
                    data-index={index}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => void runCommand(command)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                      index === activeIndex
                        ? "bg-white/10 text-white"
                        : "text-white/70 hover:bg-white/5"
                    }`}
                  >
                    <command.icon className="w-4 h-4 text-white/50 flex-shrink-0" />
                    <span className="flex-1 truncate">{command.label}</span>
                    {index === activeIndex && (
                      <CornerDownLeft className="w-3.5 h-3.5 text-white/30" />
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-white/5 text-[10px] text-white/35">
          <span className="flex items-center gap-1.5">
            <kbd className="border border-white/10 rounded px-1 py-0.5">↑</kbd>
            <kbd className="border border-white/10 rounded px-1 py-0.5">↓</kbd>
            to navigate
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="border border-white/10 rounded px-1 py-0.5">↵</kbd>
            to select
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
