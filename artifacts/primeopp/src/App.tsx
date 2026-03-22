import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Navbar from "@/components/Navbar";
import HomePage from "@/pages/home";
import AdminPage from "@/pages/admin";
import AdminLogin from "@/pages/admin-login";
import ProductPage from "@/pages/product";

const queryClient = new QueryClient();

function Router() {
  const [location] = useLocation();
  // Hide the store navbar on admin pages and product detail page
  const hideNav = location.startsWith("/admin") || location.startsWith("/product");

  return (
    <>
      {!hideNav && <Navbar />}
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/product/:id" component={ProductPage} />
        <Route path="/admin/login" component={AdminLogin} />
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
