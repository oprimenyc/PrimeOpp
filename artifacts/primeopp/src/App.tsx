// This is the main App file — it sets up routing and wraps the app
// Every page goes through here

import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Navbar from "@/components/Navbar";
import HomePage from "@/pages/home";

// QueryClient handles data fetching (we'll use this more when we add a real backend)
const queryClient = new QueryClient();

// Router sets up which page shows for which URL
function Router() {
  return (
    <Switch>
      {/* Home page — shows at "/" */}
      <Route path="/" component={HomePage} />
      {/* If someone goes to a page that doesn't exist, show the not-found page */}
      <Route component={NotFound} />
    </Switch>
  );
}

// The main App — wraps everything in providers
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        {/* Navbar shows on every page */}
        <Navbar />
        {/* Page content changes based on the URL */}
        <Router />
      </WouterRouter>
      {/* Toaster shows popup notifications */}
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
