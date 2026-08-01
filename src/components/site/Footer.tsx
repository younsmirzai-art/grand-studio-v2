import Link from "next/link";

const columns = [
  {
    title: "Product",
    links: [
      { name: "Browse Models", href: "/browse" },
      { name: "UE5 Plugin", href: "/plugin" },
      { name: "Pricing", href: "/pricing" },
      { name: "AI Generator", href: "/generate" },
    ],
  },
  {
    title: "Company",
    links: [
      { name: "Contact Us", href: "/support" },
      { name: "Email Support", href: "mailto:support@grandstudio.dev" },
      { name: "Status", href: "/support" },
    ],
  },
  {
    title: "Legal",
    links: [
      { name: "Privacy Policy", href: "/privacy" },
      { name: "Terms of Service", href: "/terms" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-20 border-t border-white/5 bg-black/30 relative">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-xs font-bold">
                GS
              </div>
              <span className="font-display font-semibold text-lg">
                Grand Studio
              </span>
            </Link>
            <p className="text-sm text-white/50 leading-relaxed max-w-xs mb-4">
              The universal 3D model hub. Browse, download, and create — built
              for game developers and 3D artists.
            </p>
            <div className="inline-flex items-center gap-2 text-xs text-white/40">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              All systems operational
            </div>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h4 className="font-display font-medium text-sm text-white mb-4">
                {column.title}
              </h4>
              <ul className="space-y-2.5 text-sm text-white/50">
                {column.links.map((link) => (
                  <li key={link.name}>
                    {link.href.startsWith("mailto:") ? (
                      <a
                        href={link.href}
                        className="hover:text-white transition"
                      >
                        {link.name}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="hover:text-white transition"
                      >
                        {link.name}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} Grand Studio. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-white/40">
            <Link href="/privacy" className="hover:text-white transition">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white transition">
              Terms
            </Link>
            <Link href="/support" className="hover:text-white transition">
              Support
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
