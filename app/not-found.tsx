import Link from "next/link";
import PageShell from "@/components/layout/PageShell";

export default function NotFound() {
  const nav = [
    { href: "/", label: "Rotas" },
    { href: "/new", label: "New Rota" },
    { href: "/me", label: "My Duties" },
  ];

  return (
    <PageShell nav={nav}>
      <div className="max-w-lg mx-auto py-16 flex flex-col items-center justify-center text-center gap-6">
        <div className="w-20 h-20 rounded-full bg-[var(--bg-surface)] border-2 border-[var(--border-default)] flex items-center justify-center text-3xl text-[var(--accent)] shadow-xl">
          ◎
        </div>

        <div>
          <span className="font-mono text-xs uppercase tracking-widest text-[var(--danger)] font-bold">
            Status Code 404
          </span>
          <h1 className="text-3xl font-bold font-mono text-[var(--text-primary)] mt-1">
            Roster Wheel Not Found
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)] leading-relaxed">
            The requested rota does not exist or has not been deployed on BOT Chain.
            Verify the rota ID and your active network.
          </p>
        </div>

        <Link
          href="/"
          className="px-6 py-2.5 bg-[var(--accent)] text-[var(--accent-ink)] font-bold font-mono text-xs uppercase tracking-wider rounded-lg hover:opacity-90 transition-all shadow-md"
        >
          Return to All Rotas
        </Link>
      </div>
    </PageShell>
  );
}
