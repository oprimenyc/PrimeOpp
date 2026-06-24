// Privacy Policy page

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-zinc-900 px-6 py-4 flex items-center justify-between">
        <a href="/" className="text-xs text-zinc-500 tracking-widest uppercase hover:text-white transition-colors">
          ← Back to shop
        </a>
        <span className="text-white font-black text-sm tracking-widest uppercase">PRIMEOPP</span>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-16">
        <p className="text-[10px] tracking-[0.4em] text-red-600 uppercase mb-4">Legal</p>
        <h1 className="text-4xl font-black tracking-wide uppercase mb-12">Privacy Policy</h1>

        <div className="space-y-8 text-sm text-zinc-400 leading-relaxed normal-case">

          <section>
            <h2 className="text-white font-bold tracking-widest uppercase text-xs mb-3">1. Information We Collect</h2>
            <p>When you place an order, we collect your name, email address, shipping address, and payment information. Payment data is handled entirely by Stripe — we never see or store your card number.</p>
          </section>

          <section>
            <h2 className="text-white font-bold tracking-widest uppercase text-xs mb-3">2. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>To process and fulfill your order</li>
              <li>To send you order confirmation and shipping updates</li>
              <li>To contact you about issues with your order</li>
              <li>To improve our site and products</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-bold tracking-widest uppercase text-xs mb-3">3. Sharing Your Information</h2>
            <p>We share your shipping address and order details with our print-on-demand partners (Printful, Tapstitch) solely to fulfill your order. We do not sell or rent your personal information to third parties for marketing purposes.</p>
          </section>

          <section>
            <h2 className="text-white font-bold tracking-widest uppercase text-xs mb-3">4. Payment Security</h2>
            <p>All payments are processed by Stripe, a PCI-DSS Level 1 certified payment processor. Your card details are encrypted and never stored on our servers.</p>
          </section>

          <section>
            <h2 className="text-white font-bold tracking-widest uppercase text-xs mb-3">5. Cookies</h2>
            <p>We use minimal cookies to keep your shopping cart and remember your session. We do not use tracking cookies for advertising.</p>
          </section>

          <section>
            <h2 className="text-white font-bold tracking-widest uppercase text-xs mb-3">6. Data Retention</h2>
            <p>We keep order records for at least 3 years for accounting purposes. You can request deletion of your personal data (except where required by law) by emailing support@primeopp.com.</p>
          </section>

          <section>
            <h2 className="text-white font-bold tracking-widest uppercase text-xs mb-3">7. Your Rights</h2>
            <p>You have the right to access, correct, or delete your personal data. Contact us at support@primeopp.com with any requests.</p>
          </section>

          <section>
            <h2 className="text-white font-bold tracking-widest uppercase text-xs mb-3">8. Contact</h2>
            <p>Questions about this policy? Email support@primeopp.com.</p>
          </section>

          <p className="text-zinc-600 text-xs pt-4">Last updated: June 2026</p>
        </div>
      </div>
    </div>
  );
}

export default PrivacyPage;
