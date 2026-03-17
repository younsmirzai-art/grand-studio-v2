import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Grand Studio",
  description: "Grand Studio terms of service. Rules and conditions for using the platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <header className="border-b border-white/5 pb-8 mb-12">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-3 h-3 rounded-sm bg-[#2196F3]" />
            <span className="text-sm font-bold tracking-[0.2em] uppercase text-white">Grand Studio</span>
          </Link>
          <h1 className="text-4xl font-bold text-white">Terms of Service</h1>
          <p className="text-[#A0A0A8] mt-2">Last updated: March 2026</p>
        </header>

        <div className="prose prose-invert prose-[#A0A0A8] max-w-none space-y-12">
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
            <p className="text-[#A0A0A8] leading-relaxed">
              By creating an account or using Grand Studio, you agree to these Terms of Service. If you do not agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">2. Description of Service</h2>
            <p className="text-[#A0A0A8] leading-relaxed">
              Grand Studio is an AI-powered platform that helps you build Unreal Engine 5 scenes using natural language. The service includes a web application, a relay component for connecting to UE5, AI-generated code and asset suggestions, and integrations with third-party 3D asset providers. We may update or discontinue features with reasonable notice where possible.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">3. User Accounts and Responsibilities</h2>
            <p className="text-[#A0A0A8] leading-relaxed">
              You are responsible for keeping your account credentials secure and for all activity under your account. You must provide accurate information when signing up and use the service in compliance with these terms and applicable laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">4. Intellectual Property</h2>
            <p className="text-[#A0A0A8] leading-relaxed mb-4">
              <strong className="text-white">Your content:</strong> You retain ownership of the scenes and projects you create with Grand Studio. We do not claim ownership of your creative work.
            </p>
            <p className="text-[#A0A0A8] leading-relaxed">
              <strong className="text-white">Imported assets:</strong> 3D models and materials from our asset library and third-party providers are subject to their respective licenses. You are responsible for complying with those licenses when using assets in your projects.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">5. Acceptable Use</h2>
            <p className="text-[#A0A0A8] leading-relaxed mb-4">
              You may not use Grand Studio to create, store, or distribute illegal content, to abuse our systems or APIs (e.g. excessive automated requests), or to violate any applicable law or third-party rights. We may suspend or terminate accounts that breach these terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">6. Limitation of Liability</h2>
            <p className="text-[#A0A0A8] leading-relaxed">
              Grand Studio is provided “as is.” To the fullest extent permitted by law, we are not liable for indirect, incidental, special, or consequential damages, or for loss of data or profits arising from your use of the service. Our total liability is limited to the amount you paid us in the twelve months before the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">7. Termination</h2>
            <p className="text-[#A0A0A8] leading-relaxed">
              You may stop using the service at any time. We may suspend or terminate your access if you breach these terms or for operational or legal reasons, with notice where reasonable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">8. Changes to Terms</h2>
            <p className="text-[#A0A0A8] leading-relaxed">
              We may update these terms from time to time. We will post the revised terms on this page and update the “Last updated” date. Continued use of the service after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">9. Contact</h2>
            <p className="text-[#A0A0A8] leading-relaxed">
              For questions about these terms, contact us at{" "}
              <a href="mailto:legal@grandstudio.app" className="text-[#2196F3] hover:underline">legal@grandstudio.app</a> or through our website.
            </p>
          </section>
        </div>

        <footer className="mt-16 pt-8 border-t border-white/5">
          <Link href="/" className="text-sm text-[#2196F3] hover:text-[#00BCD4] transition-colors">
            ← Back to Grand Studio
          </Link>
        </footer>
      </div>
    </div>
  );
}
