"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectButton from "@/components/ui/ConnectButton";
import NetworkBadge from "@/components/botchain/NetworkBadge";
import { footerLinks } from "@/lib/botchain/chain";
import BuiltOnBotChain from "@/components/botchain/BuiltOnBotChain";
import { app } from "@/lib/app-config";

export type NavItem = { href: string; label: string };

interface PageShellProps {
  children: React.ReactNode;
  nav?: NavItem[];
  title?: string;
  description?: string;
}

function RosterNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 border-t border-[#2E3466] pt-1.5 pb-2 overflow-x-auto font-sans">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-1 text-xs uppercase tracking-wider font-semibold rounded-md transition-all ${
              active
                ? "bg-[#343A6B] text-[#F1F1F6] border border-[#555B91]"
                : "text-[#B4B9DE] hover:text-[#F1F1F6] hover:bg-[#262B52]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function PageShell({
  children,
  nav = [],
  title,
  description,
}: PageShellProps) {
  const links = footerLinks();

  return (
    <div
      className="flex flex-col min-h-[100dvh] overflow-x-hidden"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      {/* Top operational navigation banner */}
      <header className="sticky top-0 z-30 flex-shrink-0 bg-[#262B52] border-b border-[#2E3466] shadow-md">
        <div className="mx-auto w-full max-w-[960px] px-4 md:px-6">
          <div className="flex items-center justify-between py-2.5 gap-3">
            {/* Roster brand wordmark with rotating duty beacon */}
            <Link
              href="/"
              className="flex items-center gap-2.5 flex-shrink-0 no-underline group"
            >
              <div className="relative w-3.5 h-3.5 flex items-center justify-center">
                <span className="absolute w-full h-full rounded-full bg-[#FB5607]/40 animate-ping" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#FB5607]" />
              </div>
              <span className="text-base font-extrabold tracking-tight text-[#F1F1F6] font-sans group-hover:text-[#FB5607] transition-colors">
                {app.name}
              </span>
            </Link>

            {/* Network pill & Mock/Wagmi Connect button */}
            <div className="flex items-center gap-2.5">
              <NetworkBadge />
              <div className="w-[150px] md:w-[175px] flex-shrink-0">
                <ConnectButton />
              </div>
            </div>
          </div>

          {nav.length > 0 && <RosterNav items={nav} />}
        </div>
      </header>

      {/* Main container */}
      <main className="flex-1 mx-auto w-full max-w-[960px] px-4 py-6 md:px-6 md:py-8">
        {(title || description) && (
          <div className="mb-6">
            {title && (
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#F1F1F6]">
                {title}
              </h1>
            )}
            {description && (
              <p className="mt-1 text-sm text-[#B4B9DE] leading-relaxed">
                {description}
              </p>
            )}
          </div>
        )}
        {children}
      </main>

      {/* Shared ecosystem footer */}
      <footer className="mt-auto border-t border-[#2E3466] bg-[#262B52]/60 py-6 text-xs text-[#B4B9DE]">
        <div className="mx-auto flex w-full max-w-[960px] flex-col items-center justify-between gap-3 px-4 md:flex-row md:px-6">
          <BuiltOnBotChain />
          <div className="flex items-center gap-4">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="text-[#B4B9DE] transition-colors hover:text-[#F1F1F6]"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
