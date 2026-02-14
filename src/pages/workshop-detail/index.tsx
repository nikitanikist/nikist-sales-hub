import { useParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  UserX, UserMinus, UserPlus, Phone, MessageSquare, AlertCircle, ArrowLeft,
} from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";
import { WorkshopWhatsAppTab } from "@/components/workshops/WorkshopWhatsAppTab";
import { WorkshopCallsDialog } from "@/components/WorkshopCallsDialog";
import OrganizationLoadingState from "@/components/OrganizationLoadingState";
import EmptyState from "@/components/EmptyState";
import { Calendar } from "lucide-react";
import { useWorkshopDetailData } from "./hooks/useWorkshopDetailData";
import WorkshopDetailHeader from "./WorkshopDetailHeader";
import WorkshopParticipantTabs from "./WorkshopParticipantTabs";
import WorkshopStatsTab from "./WorkshopStatsTab";
import { useNavigate } from "react-router-dom";

const WorkshopDetail = () => {
  const { workshopId } = useParams<{ workshopId: string }>();
  const navigate = useNavigate();
  const { currentOrganization, isLoading: orgLoading } = useOrganization();

  const data = useWorkshopDetailData(workshopId, currentOrganization?.id || null);

  // Loading states
  if (orgLoading) return <OrganizationLoadingState />;

  if (!currentOrganization) {
    return (
      <EmptyState
        icon={Calendar}
        title="No Organization Selected"
        description="Please select an organization to view workshop details."
      />
    );
  }

  if (data.workshopLoading) {
    return (
      <div className="space-y-6 px-4 sm:px-0">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (data.workshopError || !data.workshop) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-xl font-semibold mb-2">Workshop Not Found</h3>
        <p className="text-muted-foreground text-center max-w-md mb-6">
          The workshop you're looking for doesn't exist or you don't have access to it.
        </p>
        <Button onClick={() => navigate("/workshops")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Workshops
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 sm:px-0">
      <WorkshopDetailHeader
        workshop={data.workshop}
        metrics={data.metrics}
        participantsData={data.participantsData}
        participantsLoading={data.participantsLoading}
        isSyncing={data.isSyncing}
        hasWhatsAppGroup={data.hasWhatsAppGroup}
        syncMembers={data.syncMembers}
        formatOrg={data.formatOrg}
      />

      <Tabs defaultValue="missing" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="missing" className="flex items-center gap-2">
            <UserX className="h-4 w-4" />Missing
            {data.participantsData?.totalMissing ? <Badge variant="secondary" className="ml-1">{data.participantsData.totalMissing}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="left" className="flex items-center gap-2">
            <UserMinus className="h-4 w-4" />Left Group
            {data.participantsData?.totalLeftGroup ? <Badge variant="secondary" className="ml-1">{data.participantsData.totalLeftGroup}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="unregistered" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />Unregistered
            {data.participantsData?.totalUnregistered ? <Badge variant="secondary" className="ml-1">{data.participantsData.totalUnregistered}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />Call Statistics
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />WhatsApp
          </TabsTrigger>
        </TabsList>

        <WorkshopParticipantTabs
          hasWhatsAppGroup={data.hasWhatsAppGroup}
          participantsLoading={data.participantsLoading}
          searchQuery={data.searchQuery}
          setSearchQuery={data.setSearchQuery}
          filteredMissing={data.filteredMissing}
          downloadMissingCSV={data.downloadMissingCSV}
          missingCount={data.participantsData?.missing?.length || 0}
          leftSearchQuery={data.leftSearchQuery}
          setLeftSearchQuery={data.setLeftSearchQuery}
          filteredLeftGroup={data.filteredLeftGroup}
          downloadLeftGroupCSV={data.downloadLeftGroupCSV}
          leftCount={data.participantsData?.leftGroup?.length || 0}
          unregisteredSearchQuery={data.unregisteredSearchQuery}
          setUnregisteredSearchQuery={data.setUnregisteredSearchQuery}
          filteredUnregistered={data.filteredUnregistered}
          downloadUnregisteredCSV={data.downloadUnregisteredCSV}
          unregisteredCount={data.participantsData?.unregistered?.length || 0}
        />

        <WorkshopStatsTab
          metrics={data.metrics}
          totalRevenue={data.totalRevenue}
          adSpend={data.adSpend}
          totalCashReceived={data.totalCashReceived}
          totalPL={data.totalPL}
          openCallsDialog={data.openCallsDialog}
        />

        <TabsContent value="whatsapp">
          <WorkshopWhatsAppTab workshopId={workshopId || ''} workshopTitle={data.workshop.title} />
        </TabsContent>
      </Tabs>

      <WorkshopCallsDialog
        open={data.callsDialogOpen}
        onOpenChange={data.setCallsDialogOpen}
        workshopTitle={data.workshop.title}
        category={data.selectedCallCategory}
      />
    </div>
  );
};

export default WorkshopDetail;
