import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import SalesClosers from "./pages/SalesClosers";
import CloserAssignedCalls from "./pages/CloserAssignedCalls";
import AllCloserCalls from "./pages/AllCloserCalls";
import Workshops from "./pages/Workshops";
import Sales from "./pages/Sales";
import Funnels from "./pages/Funnels";
import Calls from "./pages/Calls";
import Products from "./pages/Products";
import Onboarding from "./pages/Onboarding";
import Users from "./pages/Users";
import Batches from "./pages/Batches";
import FuturesMentorship from "./pages/FuturesMentorship";
import HighFuture from "./pages/HighFuture";
import AppLayout from "./components/AppLayout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/calls" element={<Calls />} />
              <Route path="/sales-closers" element={<SalesClosers />} />
              <Route path="/sales-closers/all-calls" element={<AllCloserCalls />} />
              <Route path="/sales-closers/:closerId/calls" element={<CloserAssignedCalls />} />
              <Route path="/batches" element={<Batches />} />
              <Route path="/futures-mentorship" element={<FuturesMentorship />} />
              <Route path="/high-future" element={<HighFuture />} />
              <Route path="/workshops" element={<Workshops />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/funnels" element={<Funnels />} />
              <Route path="/products" element={<Products />} />
              <Route path="/users" element={<Users />} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
