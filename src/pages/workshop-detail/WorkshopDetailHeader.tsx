import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Users, TrendingUp, RefreshCw, Calendar,
  MessageSquare, Loader2, AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { statusColors } from "./hooks/useWorkshopDetailData";

interface WorkshopDetailHeaderProps {
  workshop: any;
  metrics: any;
  participantsData: any;
  participantsLoading: boolean;
  isSyncing: boolean;
  hasWhatsAppGroup: boolean;
  syncMembers: () => void;
  formatOrg: (date: string, fmt: string) => string;
}

const WorkshopDetailHeader = React.memo(function WorkshopDetailHeader({
  workshop, metrics, participantsData, participantsLoading,
  isSyncing, hasWhatsAppGroup, syncMembers, formatOrg,
}: WorkshopDetailHeaderProps) {
  const navigate = useNavigate();

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/workshops")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">{workshop.title}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                {workshop.start_date 
                  ? formatOrg(workshop.start_date, "MMM dd, yyyy 'at' h:mm a") 
                  : "No date set"}
              </span>
              <Badge className={statusColors[workshop.status || 'planned']}>
                {workshop.status || 'planned'}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Registration */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-3xl font-bold">
                  {participantsData?.totalRegistered || metrics?.registration_count || 0}
                </p>
                <p className="text-sm text-muted-foreground">Registered</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp Group - 2 columns */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <MessageSquare className="h-4 w-4 text-emerald-600" />
                </div>
                <CardTitle className="text-base font-semibold">WhatsApp Group</CardTitle>
              </div>
              {isSyncing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                <span className="text-sm text-muted-foreground">Total in Group</span>
                <span className="text-lg font-semibold">
                  {participantsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : participantsData?.totalInGroupRaw || 0}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-destructive/5">
                <span className="text-sm text-destructive">Missing</span>
                <span className="text-lg font-semibold text-destructive">
                  {participantsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : participantsData?.totalMissing || 0}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/10">
                <span className="text-sm text-amber-600">Unregistered</span>
                <span className="text-lg font-semibold text-amber-600">
                  {participantsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : participantsData?.totalUnregistered || 0}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                <span className="text-sm text-muted-foreground">Left Group</span>
                <span className="text-lg font-semibold text-muted-foreground">
                  {participantsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : participantsData?.leftGroup?.length || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Join Rate */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-primary">
                    {participantsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : `${participantsData?.joinRate?.toFixed(0) || 0}%`}
                  </p>
                  <p className="text-sm text-muted-foreground">Join Rate</p>
                </div>
              </div>
              <Progress value={participantsData?.joinRate || 0} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {participantsData?.totalInGroupRaw || 0} of {participantsData?.totalRegistered || 0} joined
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      {hasWhatsAppGroup && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Group Join Progress</span>
                  {participantsData?.groupName && (
                    <Badge variant="outline">{participantsData.groupName}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {participantsData?.lastSynced && (
                    <span>Last synced: {format(participantsData.lastSynced, 'h:mm:ss a')}</span>
                  )}
                  <Button variant="outline" size="sm" onClick={syncMembers} disabled={isSyncing}>
                    <RefreshCw className={`h-4 w-4 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing...' : 'Sync Members'}
                  </Button>
                </div>
              </div>
              <Progress value={participantsData?.joinRate || 0} className="h-3" />
              <p className="text-xs text-muted-foreground text-center">
                {participantsData?.totalInGroupRaw || 0} of {participantsData?.totalRegistered || 0} registered members have joined the WhatsApp group
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No WhatsApp Group Warning */}
      {!hasWhatsAppGroup && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-200">No WhatsApp Group Linked</p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Link a WhatsApp group to this workshop to track member participation.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
});

export default WorkshopDetailHeader;
