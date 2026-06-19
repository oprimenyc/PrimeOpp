// Terms of Service page

function TermsPage() {
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
        <h1 className="text-4xl font-black tracking-wide uppercase mb-12">Terms of Service</h1>

        <div className="space-y-8 text-sm text-zinc-400 leading-relaxed normal-case">

          <section>
            <h2 className="text-white font-bold tracking-widest uppercase text-xs mb-3">1. Acceptance of Terms</h2>
            <p>By accessing and using PrimeOpp ("the Site"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Site.</p>
          </section>

          <section>
            <h2 className="text-white font-bold tracking-widest uppercase text-xs mb-3">2. Products & Orders</h2>
            <p>All print-on-demand items are made to order. We reserve the right to cancel any order at our discretion. Prices are listed in USD and may change without notice. We do our best to display accurate product images and descriptions.</p>
          </section>

          <section>
            <h2 className="text-white font-bold tracking-widest uppercase text-xs mb-3">3. Payments</h2>
            <p>Payments are processed securely through Stripe. PrimeOpp does not store your credit card information. By placing an order, you authorize the charge for the total amount shown at checkout.</p>
          </section>

          <section>
            <h2 className="text-white font-bold tracking-widest uppercase text-xs mb-3">4. Shipping & Fulfillment</h2>
            <p>Print-on-demand items typically ship within 3–7 business days after production. Shipping times vary by location. We are not responsible for delays caused by carriers or customs. Tracking information will be emailed once your order ships.</p>
          </section>

          <section>
            <h2 className="text-white font-bold tracking-widest uppercase text-xs mb-3">5. Returns & Refunds</h2>
            <p>Because items are made-to-order, we do not accept returns for buyer's remorse. If your item arrives damaged, defective, or incorrect, contact us within 14 days and we will replace it at no charge. Email: support@primeopp.com</p>
          </section>

          <section>
            <h2 className="text-white font-bold tracking-widest uppercase text-xs mb-3">6. Affiliate Links</h2>
            <p>Some products on this site are affiliate links to third-party retailers. PrimeOpp may earn a commission on purchases made through these links. All affiliate products are clearly labeled.</p>
          </section>

          <section>
            <h2 className="text-white font-bold tracking-widest uppercase text-xs mb-3">7. Intellectual Property</h2>
            <p>All content on this Site, including logos, graphics, and text, is the property of PrimeOpp. You may not reproduce or distribute any content without written permission.</p>
          </section>

          <section>
            <h2 className="text-white font-bold tracking-widest uppercase text-xs mb-3">8. Limitation of Liability</h2>
            <p>PrimeOpp is not liable for any indirect, incidental, or consequential damages arising from your use of the Site or purchase of products. Our maximum liability is limited to the amount you paid for your order.</p>
          </section>

          <section>
            <h2 className="text-white font-bold tracking-widest uppercase text-xs mb-3">9. Changes to Terms</h2>
            <p>We may update these terms at any time. Continued use of the Site constitutes acceptance of any changes.</p>
          </section>

          <p className="text-zinc-600 text-xs pt-4">Last updated: June 2026</p>
        </div>
      </div>
    </div>
  );
}

export default TermsPage;
