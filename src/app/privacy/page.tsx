import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Grand Studio",
  description: "Grand Studio privacy policy. How we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <header className="border-b border-white/5 pb-8 mb-12">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-3 h-3 rounded-sm bg-[#2196F3]" />
            <span className="text-sm font-bold tracking-[0.2em] uppercase text-white">Grand Studio</span>
          </Link>
          <h1 className="text-4xl font-bold text-white">Privacy Policy</h1>
          <p className="text-[#A0A0A8] mt-2">Last updated: March 2026</p>
        </header>

        <div className="prose prose-invert prose-[#A0A0A8] max-w-none space-y-12">
          <section>
            <h2 className="text-xl font-semibold text-white mb-4">1. What Data We Collect</h2>
            <p className="text-[#A0A0A8] leading-relaxed">
              We collect information you provide directly: your <strong className="text-white">email address</strong> when you sign up, and <strong className="text-white">project data</strong> (scene descriptions, chat history, build logs, and asset references) when you use Grand Studio. We also store account and authentication data necessary to provide the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">2. How We Use Your Data</h2>
            <p className="text-[#A0A0A8] leading-relaxed">
              We use your data to provide, maintain, and improve Grand Studio: to authenticate you, run AI-powered scene generation, store and sync your projects, and send essential service-related communications. We do not sell your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">3. Third-Party Services</h2>
            <p className="text-[#A0A0A8] leading-relaxed mb-4">
              We use the following services to operate Grand Studio:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-[#A0A0A8]">
              <li><strong className="text-white">Supabase</strong> — database and authentication (account and project data).</li>
              <li><strong className="text-white">OpenRouter</strong> — AI models for natural language and code generation.</li>
              <li><strong className="text-white">Poly Haven</strong> and <strong className="text-white">Sketchfab</strong> — 3D model and texture search and download for your scenes. Their own privacy policies apply to assets you access through our integration.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">4. Cookies</h2>
            <p className="text-[#A0A0A8] leading-relaxed">
              We use minimal cookies necessary for authentication and session management. We do not use advertising or tracking cookies. You can control cookies through your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">5. Data Security</h2>
            <p className="text-[#A0A0A8] leading-relaxed">
              We use encrypted connections (HTTPS) for all data in transit. Data at rest is stored in secure, access-controlled environments. We do not store credit card or payment data; any future payments will be handled by a certified payment provider.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">6. Your Rights</h2>
            <p className="text-[#A0A0A8] leading-relaxed mb-4">
              You can request to delete your account and associated data, or export your data, by contacting us. We will respond within a reasonable time and in line with applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-4">7. Contact</h2>
            <p className="text-[#A0A0A8] leading-relaxed">
              For privacy-related questions or requests, contact us at{" "}
              <a href="mailto:privacy@grandstudio.app" className="text-[#2196F3] hover:underline">privacy@grandstudio.app</a> or through our website.
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
