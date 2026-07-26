import Link from "next/link";

const legalLinks = [
  { name: "Privacy Policy", href: "/privacy" },
  { name: "Terms of Service", href: "/terms" },
  { name: "Contact Us", href: "/support" },
  { name: "Pricing", href: "/pricing" },
];

export function DashboardFooter() {
  return (
    <footer className="border-t border-white/5 mt-4">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-xs text-white/40">
          <span>© {new Date().getFullYear()} Grand Studio</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            All systems operational
          </span>
        </div>

        <nav className="flex items-center gap-x-5 gap-y-2 flex-wrap justify-center">
          {legalLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs text-white/40 hover:text-white transition"
            >
              {link.name}
            </Link>
          ))}
          <a
            href="mailto:support@grandstudio.dev"
            className="text-xs text-white/40 hover:text-white transition"
          >
            support@grandstudio.dev
          </a>
        </nav>
      </div>
    </footer>
  );
}
