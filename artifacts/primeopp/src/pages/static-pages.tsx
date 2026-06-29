import { Seo } from "@/components/Seo";

type InfoPageProps = {
  title: string;
  kicker: string;
  description: string;
  sections: Array<{ heading: string; body: string }>;
};

function InfoPage({ title, kicker, description, sections }: InfoPageProps) {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-28">
      <Seo title={title} description={description} />
      <div className="max-w-4xl mx-auto">
        <p className="text-red-600 text-[10px] font-black tracking-[0.45em] uppercase mb-4">{kicker}</p>
        <h1 className="text-5xl md:text-7xl font-black tracking-tight uppercase mb-6">{title}</h1>
        <p className="text-zinc-400 text-base normal-case leading-relaxed max-w-2xl mb-12">{description}</p>
        <div className="divide-y divide-zinc-900 border-y border-zinc-900">
          {sections.map((section) => (
            <section key={section.heading} className="py-8">
              <h2 className="text-lg font-black tracking-[0.25em] uppercase mb-3">{section.heading}</h2>
              <p className="text-zinc-400 text-sm normal-case leading-relaxed">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

export function AboutPage() {
  return <InfoPage title="About" kicker="PrimeOpp" description="Premium streetwear drops printed on demand with a focus on bold design, responsible inventory, and reliable fulfillment." sections={[
    { heading: "What we make", body: "PrimeOpp creates limited apparel and partner picks for customers who want sharp, high-contrast essentials without mass overproduction." },
    { heading: "How fulfillment works", body: "Products are produced after checkout through vetted print-on-demand partners, then shipped directly to the customer." },
    { heading: "Support promise", body: "Every order is tracked from payment through fulfillment so our team can resolve exceptions quickly." },
  ]} />;
}

export function ContactPage() {
  return <InfoPage title="Contact" kicker="Support" description="Need help with an order, shipment, return, or product question? Reach the PrimeOpp support team." sections={[
    { heading: "Email", body: "Contact support@primeopp.com with your order number and the email used at checkout." },
    { heading: "Response time", body: "Support requests are reviewed during business hours. Order and fulfillment issues are prioritized first." },
    { heading: "Order help", body: "Include photos for damaged items, your shipping address for delivery issues, and any provider tracking details you received." },
  ]} />;
}

export function FAQPage() {
  const sections = [
    { heading: "When will my order ship?", body: "Most print-on-demand orders enter production after payment and ship after production is complete. Delivery timing depends on destination and provider capacity." },
    { heading: "Can I change my order?", body: "Contact support as soon as possible. Once an item enters production, changes may no longer be possible." },
    { heading: "Do you support refunds?", body: "Refunds are reviewed according to the refund policy, order state, and whether production or fulfillment has started." },
  ];
  return (
    <main className="min-h-screen bg-black text-white px-6 py-28">
      <Seo
        title="FAQ"
        description="Common questions about PrimeOpp products, checkout, shipping, and support."
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: sections.map((section) => ({
            "@type": "Question",
            name: section.heading,
            acceptedAnswer: { "@type": "Answer", text: section.body },
          })),
        }}
      />
      <div className="max-w-4xl mx-auto">
        <p className="text-red-600 text-[10px] font-black tracking-[0.45em] uppercase mb-4">Answers</p>
        <h1 className="text-5xl md:text-7xl font-black tracking-tight uppercase mb-6">FAQ</h1>
        <p className="text-zinc-400 text-base normal-case leading-relaxed max-w-2xl mb-12">Common questions about PrimeOpp products, checkout, shipping, and support.</p>
        <div className="divide-y divide-zinc-900 border-y border-zinc-900">
          {sections.map((section) => (
            <section key={section.heading} className="py-8">
              <h2 className="text-lg font-black tracking-[0.25em] uppercase mb-3">{section.heading}</h2>
              <p className="text-zinc-400 text-sm normal-case leading-relaxed">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}

export function RefundPolicyPage() {
  return <InfoPage title="Refund Policy" kicker="Policy" description="Refund eligibility for made-to-order apparel and partner products." sections={[
    { heading: "Made-to-order items", body: "Because products are printed on demand, refunds are generally limited to damaged, defective, missing, or incorrectly fulfilled items." },
    { heading: "Requests", body: "Refund requests should include the order number, issue description, and clear photos when relevant." },
    { heading: "Payment timing", body: "Approved refunds are returned to the original payment method and may take several business days to appear." },
  ]} />;
}

export function ShippingPolicyPage() {
  return <InfoPage title="Shipping Policy" kicker="Delivery" description="Shipping expectations for PrimeOpp orders." sections={[
    { heading: "Production", body: "Print-on-demand items are produced after checkout. Production and shipping timelines can vary by product and destination." },
    { heading: "Tracking", body: "Tracking is sent when the fulfillment provider creates shipment details." },
    { heading: "Exceptions", body: "If tracking stalls or delivery fails, contact support with your order number so we can investigate the provider record." },
  ]} />;
}

export function MaintenancePage() {
  return <InfoPage title="Maintenance" kicker="System" description="PrimeOpp is temporarily unavailable while maintenance is in progress." sections={[
    { heading: "Status", body: "The storefront or admin tools may be offline briefly during upgrades." },
    { heading: "Orders", body: "Paid orders remain recorded and will continue through the fulfillment pipeline once maintenance completes." },
  ]} />;
}

export function ServerErrorPage() {
  return <InfoPage title="Something Went Wrong" kicker="500" description="The request could not be completed." sections={[
    { heading: "Next step", body: "Return to the store and try again. If the issue continues, contact support with what you were trying to do." },
  ]} />;
}
