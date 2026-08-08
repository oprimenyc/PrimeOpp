import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Navbar from "@/components/Navbar";
import HomePage from "@/pages/home";
import AdminPage from "@/pages/admin";
import AdminDashboardPage from "@/pages/admin-dashboard";
import AdminLogin from "@/pages/admin-login";
import AdminOrdersPage from "@/pages/admin-orders";
import ListingWorkspacePage from "@/pages/listing-workspace";
import SourcingPage from "@/pages/sourcing";
import ProductPage from "@/pages/product";
import CartPage from "@/pages/cart";
import OrderSuccessPage from "@/pages/order-success";
import TermsPage from "@/pages/terms";
import PrivacyPage from "@/pages/privacy";
import { AboutPage, ContactPage, FAQPage, RefundPolicyPage, ShippingPolicyPage, MaintenancePage, ServerErrorPage } from "@/pages/static-pages";
import { CollectionsPage, CategoryPage, SearchPage } from "@/pages/catalog";
import { AccountPage, CustomerOrdersPage, WishlistPage, RecentlyViewedPage } from "@/pages/customer";

const queryClient = new QueryClient();

function Router() {
  const [location] = useLocation();
  const hideNav =
    location.startsWith("/admin") ||
    location.startsWith("/product") ||
    location.startsWith("/cart") ||
    location.startsWith("/order-success") ||
    location.startsWith("/terms") ||
    location.startsWith("/privacy") ||
    location.startsWith("/refund-policy") ||
    location.startsWith("/shipping-policy") ||
    location.startsWith("/maintenance") ||
    location.startsWith("/500");

  return (
    <>
      {!hideNav && <Navbar />}
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/product/:id" component={ProductPage} />
        <Route path="/cart" component={CartPage} />
        <Route path="/order-success" component={OrderSuccessPage} />
        <Route path="/terms" component={TermsPage} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route path="/about" component={AboutPage} />
        <Route path="/contact" component={ContactPage} />
        <Route path="/faq" component={FAQPage} />
        <Route path="/refund-policy" component={RefundPolicyPage} />
        <Route path="/shipping-policy" component={ShippingPolicyPage} />
        <Route path="/collections" component={CollectionsPage} />
        <Route path="/category/:category" component={CategoryPage} />
        <Route path="/search" component={SearchPage} />
        <Route path="/account" component={AccountPage} />
        <Route path="/orders" component={CustomerOrdersPage} />
        <Route path="/wishlist" component={WishlistPage} />
        <Route path="/recently-viewed" component={RecentlyViewedPage} />
        <Route path="/maintenance" component={MaintenancePage} />
        <Route path="/500" component={ServerErrorPage} />
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin/dashboard" component={AdminDashboardPage} />
        <Route path="/admin/orders" component={AdminOrdersPage} />
        <Route path="/admin/listings" component={ListingWorkspacePage} />
        <Route path="/admin/sourcing/:id" component={SourcingPage} />
        <Route path="/admin/sourcing" component={SourcingPage} />
        <Route path="/admin" component={AdminPage} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
