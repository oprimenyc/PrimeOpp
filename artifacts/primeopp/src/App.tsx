import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Navbar from "@/components/Navbar";
import HomePage from "@/pages/home";
import AdminPage from "@/pages/admin";
import AdminLogin from "@/pages/admin-login";
import AdminOrdersPage from "@/pages/admin-orders";
import ProductPage from "@/pages/product";
import CartPage from "@/pages/cart";
import OrderSuccessPage from "@/pages/order-success";
import TermsPage from "@/pages/terms";
import PrivacyPage from "@/pages/privacy";

const queryClient = new QueryClient();

function Router() {
  const [location] = useLocation();
  const hideNav =
    location.startsWith("/admin") ||
    location.startsWith("/product") ||
    location.startsWith("/cart") ||
    location.startsWith("/order-success") ||
    location.startsWith("/terms") ||
    location.startsWith("/privacy");

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
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin/orders" component={AdminOrdersPage} />
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
