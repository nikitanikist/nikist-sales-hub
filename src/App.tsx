import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ModuleGuard } from "@/components/ModuleGuard";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import SalesClosers from "./pages/SalesClosers";
import CloserAssignedCalls from "./pages/CloserAssignedCalls";
import AllCloserCalls from "./pages/AllCloserCalls";
import Workshops from "./pages/Workshops";
import WorkshopDetail from "./pages/WorkshopDetail";
import Sales from "./pages/Sales";
import Funnels from "./pages/Funnels";
import Calls from "./pages/Calls";
import Products from "./pages/Products";
import Onboarding from "./pages/Onboarding";
import Users from "./pages/Users";
import Batches from "./pages/Batches";
import FuturesMentorship from "./pages/FuturesMentorship";
import HighFuture from "./pages/HighFuture";
import DailyMoneyFlow from "./pages/DailyMoneyFlow";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import CohortPage from "./pages/CohortPage";
import ManageCohorts from "./pages/ManageCohorts";
import OrganizationSettings from "./pages/OrganizationSettings";
import { WorkshopNotification } from "./pages/operations";
import DynamicLinks from "./pages/operations/DynamicLinks";
import LinkRedirect from "./pages/operations/LinkRedirect";
import AppLayout from "./components/AppLayout";
import NotFound from "./pages/NotFound";
import Install from "./pages/Install";
import ProtectedRoute from "./components/ProtectedRoute";
import TemplateEditor from "./pages/settings/TemplateEditor";

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
            <Route path="/install" element={<Install />} />
            {/* Public redirect route - no auth required */}
            <Route path="/link/:slug" element={<LinkRedirect />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/calls" element={<ModuleGuard moduleSlug="one-to-one-funnel"><Calls /></ModuleGuard>} />
              <Route path="/sales-closers" element={<ModuleGuard moduleSlug="one-to-one-funnel"><SalesClosers /></ModuleGuard>} />
              <Route path="/sales-closers/all-calls" element={<ModuleGuard moduleSlug="one-to-one-funnel"><AllCloserCalls /></ModuleGuard>} />
              <Route path="/sales-closers/:closerId/calls" element={<ModuleGuard moduleSlug="one-to-one-funnel"><CloserAssignedCalls /></ModuleGuard>} />
              {/* Legacy routes - redirect to unified cohort pages */}
              <Route path="/batches" element={<Navigate to="/cohorts/insider-crypto-club" replace />} />
              <Route path="/futures-mentorship" element={<Navigate to="/cohorts/futures-mentorship" replace />} />
              <Route path="/high-future" element={<Navigate to="/cohorts/high-future" replace />} />
              {/* New unified cohort routes */}
              <Route path="/cohorts/manage" element={<ProtectedRoute adminOnly><ModuleGuard moduleSlug="cohort-management"><ManageCohorts /></ModuleGuard></ProtectedRoute>} />
              <Route path="/cohorts/:cohortSlug" element={<ProtectedRoute><ModuleGuard moduleSlug="cohort-management"><CohortPage /></ModuleGuard></ProtectedRoute>} />
              <Route path="/daily-money-flow" element={<ModuleGuard moduleSlug="daily-money-flow"><DailyMoneyFlow /></ModuleGuard>} />
              <Route path="/workshops" element={<ModuleGuard moduleSlug="workshops"><Workshops /></ModuleGuard>} />
              <Route path="/workshops/:workshopId" element={<ModuleGuard moduleSlug="workshops"><WorkshopDetail /></ModuleGuard>} />
              <Route path="/operations/workshop-notification" element={<ModuleGuard moduleSlug="workshops"><WorkshopNotification /></ModuleGuard>} />
              <Route path="/operations/dynamic-links" element={<ProtectedRoute><DynamicLinks /></ProtectedRoute>} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/funnels" element={<Funnels />} />
              <Route path="/products" element={<Products />} />
              <Route path="/users" element={<Users />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/settings" element={<ProtectedRoute adminOnly><OrganizationSettings /></ProtectedRoute>} />
              <Route path="/settings/templates/new" element={<ProtectedRoute adminOnly><TemplateEditor /></ProtectedRoute>} />
              <Route path="/settings/templates/:id" element={<ProtectedRoute adminOnly><TemplateEditor /></ProtectedRoute>} />
              <Route path="/super-admin" element={<SuperAdminDashboard />} />
              <Route path="/super-admin/create-org" element={<SuperAdminDashboard />} />
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
