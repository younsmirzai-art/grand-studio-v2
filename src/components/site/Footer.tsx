import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-32 border-t border-white/5 bg-black/30 relative">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500" />
              <span className="font-display font-semibold text-lg">Grand Studio</span>
            </div>
            <p className="text-sm text-white/50 leading-relaxed max-w-xs">
              The universal 3D model hub. Download from every marketplace in one
              place.
            </p>
          </div>

          <div>
            <h4 className="font-display font-medium text-sm text-white mb-4">
              Product
            </h4>
            <ul className="space-y-2.5 text-sm text-white/50">
              <li>
                <Link href="/browse" className="hover:text-white transition">
                  Browse Models
                </Link>
              </li>
              <li>
                <Link href="/plugin" className="hover:text-white transition">
                  UE5 Plugin
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-white transition">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-medium text-sm text-white mb-4">
              Support
            </h4>
            <ul className="space-y-2.5 text-sm text-white/50">
              <li>
                <Link href="/support" className="hover:text-white transition">
                  Contact Us
                </Link>
              </li>
              <li>
                <a
                  href="mailto:support@grandstudio.dev"
                  className="hover:text-white transition"
                >
                  Email
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-display font-medium text-sm text-white mb-4">
              Legal
            </h4>
            <ul className="space-y-2.5 text-sm text-white/50">
              <li>
                <Link href="/privacy" className="hover:text-white transition">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition">
                  Terms
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-white/40">
            © 2026 Grand Studio. All rights reserved.
          </p>
          <p className="text-xs text-white/40">
            Made for creators worldwide
          </p>
        </div>
      </div>
    </footer>
  );
}
