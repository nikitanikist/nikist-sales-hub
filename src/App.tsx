import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ModuleGuard } from "@/components/ModuleGuard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/leads";
import SalesClosers from "./pages/SalesClosers";
import CloserAssignedCalls from "./pages/CloserAssignedCalls";
import AllCloserCalls from "./pages/AllCloserCalls";
import Workshops from "./pages/workshops";
import WorkshopDetail from "./pages/workshop-detail";
import Sales from "./pages/Sales";
import Funnels from "./pages/Funnels";
import Calls from "./pages/calls";
import Products from "./pages/Products";
import Onboarding from "./pages/Onboarding";
import Users from "./pages/users";
import Batches from "./pages/batches";
import FuturesMentorship from "./pages/futures-mentorship";
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
import { WhatsAppDashboard, SendNotification, Campaigns, CampaignDetail, Templates as WhatsAppTemplates, ScheduledMessages } from "./pages/whatsapp";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

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
              <Route path="/" element={<ProtectedRoute><ErrorBoundary><Dashboard /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/leads" element={<ErrorBoundary><Leads /></ErrorBoundary>} />
              <Route path="/calls" element={<ModuleGuard moduleSlug="one-to-one-funnel"><ErrorBoundary><Calls /></ErrorBoundary></ModuleGuard>} />
              <Route path="/sales-closers" element={<ModuleGuard moduleSlug="one-to-one-funnel"><ErrorBoundary><SalesClosers /></ErrorBoundary></ModuleGuard>} />
              <Route path="/sales-closers/all-calls" element={<ModuleGuard moduleSlug="one-to-one-funnel"><ErrorBoundary><AllCloserCalls /></ErrorBoundary></ModuleGuard>} />
              <Route path="/sales-closers/:closerId/calls" element={<ModuleGuard moduleSlug="one-to-one-funnel"><ErrorBoundary><CloserAssignedCalls /></ErrorBoundary></ModuleGuard>} />
              {/* Legacy routes - redirect to unified cohort pages */}
              <Route path="/batches" element={<Navigate to="/cohorts/insider-crypto-club" replace />} />
              <Route path="/futures-mentorship" element={<Navigate to="/cohorts/futures-mentorship" replace />} />
              <Route path="/high-future" element={<Navigate to="/cohorts/high-future" replace />} />
              {/* New unified cohort routes */}
              <Route path="/cohorts/manage" element={<ProtectedRoute adminOnly><ModuleGuard moduleSlug="cohort-management"><ErrorBoundary><ManageCohorts /></ErrorBoundary></ModuleGuard></ProtectedRoute>} />
              <Route path="/cohorts/:cohortSlug" element={<ProtectedRoute><ModuleGuard moduleSlug="cohort-management"><ErrorBoundary><CohortPage /></ErrorBoundary></ModuleGuard></ProtectedRoute>} />
              <Route path="/daily-money-flow" element={<ModuleGuard moduleSlug="daily-money-flow"><ErrorBoundary><DailyMoneyFlow /></ErrorBoundary></ModuleGuard>} />
              <Route path="/workshops" element={<ModuleGuard moduleSlug="workshops"><ErrorBoundary><Workshops /></ErrorBoundary></ModuleGuard>} />
              <Route path="/workshops/:workshopId" element={<ModuleGuard moduleSlug="workshops"><ErrorBoundary><WorkshopDetail /></ErrorBoundary></ModuleGuard>} />
              <Route path="/operations/workshop-notification" element={<ModuleGuard moduleSlug="workshops"><ErrorBoundary><WorkshopNotification /></ErrorBoundary></ModuleGuard>} />
              <Route path="/operations/dynamic-links" element={<ProtectedRoute><ErrorBoundary><DynamicLinks /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/sales" element={<ErrorBoundary><Sales /></ErrorBoundary>} />
              <Route path="/funnels" element={<ErrorBoundary><Funnels /></ErrorBoundary>} />
              <Route path="/products" element={<ErrorBoundary><Products /></ErrorBoundary>} />
              <Route path="/users" element={<ErrorBoundary><Users /></ErrorBoundary>} />
              <Route path="/onboarding" element={<ErrorBoundary><Onboarding /></ErrorBoundary>} />
              <Route path="/settings" element={<ProtectedRoute adminOnly><ErrorBoundary><OrganizationSettings /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/settings/templates/new" element={<ProtectedRoute adminOnly><ErrorBoundary><TemplateEditor /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/settings/templates/:id" element={<ProtectedRoute adminOnly><ErrorBoundary><TemplateEditor /></ErrorBoundary></ProtectedRoute>} />
              {/* WhatsApp Module */}
              <Route path="/whatsapp" element={<ProtectedRoute><ErrorBoundary><WhatsAppDashboard /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/whatsapp/send-notification" element={<ProtectedRoute><ErrorBoundary><SendNotification /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/whatsapp/campaigns" element={<ProtectedRoute><ErrorBoundary><Campaigns /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/whatsapp/campaigns/:campaignId" element={<ProtectedRoute><ErrorBoundary><CampaignDetail /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/whatsapp/templates" element={<ProtectedRoute><ErrorBoundary><WhatsAppTemplates /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/whatsapp/scheduled" element={<ProtectedRoute><ErrorBoundary><ScheduledMessages /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/super-admin" element={<ErrorBoundary><SuperAdminDashboard /></ErrorBoundary>} />
              <Route path="/super-admin/create-org" element={<ErrorBoundary><SuperAdminDashboard /></ErrorBoundary>} />
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
