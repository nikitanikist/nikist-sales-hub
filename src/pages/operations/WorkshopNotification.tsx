import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Search, RefreshCw, Eye, CheckCircle2, Circle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/skeletons';
import { PageIntro } from '@/components/PageIntro';
import { useWorkshopNotification, WorkshopWithDetails } from '@/hooks/useWorkshopNotification';
import { WorkshopTagBadge, WorkshopDetailSheet } from '@/components/operations';
import { Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function WorkshopNotification() {
  const { workshops, workshopsLoading } = useWorkshopNotification();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkshop, setSelectedWorkshop] = useState<WorkshopWithDetails | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Keep selectedWorkshop in sync with fresh query data after mutations
  useEffect(() => {
    if (selectedWorkshop && workshops.length > 0) {
      const freshData = workshops.find(w => w.id === selectedWorkshop.id);
      if (freshData) {
        setSelectedWorkshop(freshData);
      }
    }
  }, [workshops]);

  // Filter workshops by search query
  const filteredWorkshops = workshops.filter((w) =>
    w.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleViewWorkshop = (workshop: WorkshopWithDetails) => {
    setSelectedWorkshop(workshop);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-6 p-6">
      <PageIntro
        icon={Activity}
        tagline="Operations"
        description="Manage workshop notifications and automated messaging."
        variant="violet"
      />

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search workshops..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Workshops Table */}
      {workshopsLoading ? (
        <TableSkeleton columns={5} rows={5} />
      ) : filteredWorkshops.length === 0 ? (
        <div className="text-center py-12">
          <Activity className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">No workshops found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {searchQuery ? 'Try a different search term' : 'Workshops will appear here once created'}
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Workshop Name</TableHead>
                <TableHead>Tag</TableHead>
                <TableHead className="text-center">Registrations</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWorkshops.map((workshop) => {
                const automationStatus = workshop.automation_status || {
                  whatsapp_group_linked: false,
                  messages_scheduled: false,
                };
                const isFullySetup = automationStatus.whatsapp_group_linked && automationStatus.messages_scheduled;

                return (
                  <TableRow key={workshop.id}>
                    <TableCell className="font-medium">
                      <div>
                        {(() => {
                          // Extract date portion to prevent timezone shifting
                          const datePart = workshop.start_date.split('T')[0];
                          const workshopDate = new Date(datePart + 'T12:00:00');
                          return (
                            <>
                              <div className="font-medium">
                                {format(workshopDate, 'MMM d')}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(workshopDate, 'yyyy')}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate font-medium">
                        {workshop.title}
                      </div>
                    </TableCell>
                    <TableCell>
                      {workshop.tag ? (
                        <WorkshopTagBadge
                          name={workshop.tag.name}
                          color={workshop.tag.color}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">
                        {workshop.registrations_count || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {isFullySetup ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Ready
                          </Badge>
                        ) : automationStatus.whatsapp_group_linked ? (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            <Circle className="h-3 w-3 mr-1" />
                            Partial
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground">
                            <Circle className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewWorkshop(workshop)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Workshop Detail Sheet */}
      <WorkshopDetailSheet
        workshop={selectedWorkshop}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  );
}
