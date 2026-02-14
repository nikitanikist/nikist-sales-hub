import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Search, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface WorkshopParticipantTabsProps {
  hasWhatsAppGroup: boolean;
  participantsLoading: boolean;
  // Missing
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  filteredMissing: any[];
  downloadMissingCSV: () => void;
  missingCount: number;
  // Left
  leftSearchQuery: string;
  setLeftSearchQuery: (v: string) => void;
  filteredLeftGroup: any[];
  downloadLeftGroupCSV: () => void;
  leftCount: number;
  // Unregistered
  unregisteredSearchQuery: string;
  setUnregisteredSearchQuery: (v: string) => void;
  filteredUnregistered: any[];
  downloadUnregisteredCSV: () => void;
  unregisteredCount: number;
}

const WorkshopParticipantTabs = React.memo(function WorkshopParticipantTabs({
  hasWhatsAppGroup, participantsLoading,
  searchQuery, setSearchQuery, filteredMissing, downloadMissingCSV, missingCount,
  leftSearchQuery, setLeftSearchQuery, filteredLeftGroup, downloadLeftGroupCSV, leftCount,
  unregisteredSearchQuery, setUnregisteredSearchQuery, filteredUnregistered, downloadUnregisteredCSV, unregisteredCount,
}: WorkshopParticipantTabsProps) {
  return (
    <>
      {/* Missing Members Tab */}
      <TabsContent value="missing" className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Missing Members</CardTitle>
                <CardDescription>People who registered but haven't joined the WhatsApp group</CardDescription>
              </div>
              <Button onClick={downloadMissingCSV} disabled={!missingCount} variant="outline">
                <Download className="h-4 w-4 mr-2" />Download CSV
              </Button>
            </div>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name, email, or phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
          </CardHeader>
          <CardContent>
            {participantsLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : !hasWhatsAppGroup ? (
              <div className="text-center py-8 text-muted-foreground">Link a WhatsApp group to see missing members</div>
            ) : filteredMissing.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "No matching members found" : "All registered members are in the WhatsApp group! 🎉"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Registered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMissing.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.contact_name || 'N/A'}</TableCell>
                      <TableCell>{lead.phone || 'N/A'}</TableCell>
                      <TableCell className="text-muted-foreground">{lead.email || 'N/A'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {lead.created_at ? format(new Date(lead.created_at), 'MMM dd, yyyy') : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Left Group Tab */}
      <TabsContent value="left" className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Left Group Members</CardTitle>
                <CardDescription>People who joined the WhatsApp group but have since left</CardDescription>
              </div>
              <Button onClick={downloadLeftGroupCSV} disabled={!leftCount} variant="outline">
                <Download className="h-4 w-4 mr-2" />Download CSV
              </Button>
            </div>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by name, phone, or email..." value={leftSearchQuery} onChange={(e) => setLeftSearchQuery(e.target.value)} className="pl-10" />
            </div>
          </CardHeader>
          <CardContent>
            {participantsLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : !hasWhatsAppGroup ? (
              <div className="text-center py-8 text-muted-foreground">Link a WhatsApp group to track members who left</div>
            ) : filteredLeftGroup.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {leftSearchQuery ? "No matching members found" : "No one has left the group yet 🎉"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Left</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeftGroup.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.contact_name || 'Unknown'}</TableCell>
                      <TableCell>{member.full_phone || member.phone_number || 'N/A'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.joined_at ? format(new Date(member.joined_at), 'MMM dd, yyyy') : 'N/A'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.left_at ? format(new Date(member.left_at), 'MMM dd, yyyy HH:mm') : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Unregistered Members Tab */}
      <TabsContent value="unregistered" className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Unregistered Members</CardTitle>
                <CardDescription>People in the WhatsApp group who didn't register (admins excluded)</CardDescription>
              </div>
              <Button onClick={downloadUnregisteredCSV} disabled={!unregisteredCount} variant="outline">
                <Download className="h-4 w-4 mr-2" />Download CSV
              </Button>
            </div>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by phone..." value={unregisteredSearchQuery} onChange={(e) => setUnregisteredSearchQuery(e.target.value)} className="pl-10" />
            </div>
          </CardHeader>
          <CardContent>
            {participantsLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : !hasWhatsAppGroup ? (
              <div className="text-center py-8 text-muted-foreground">Link a WhatsApp group to see unregistered members</div>
            ) : filteredUnregistered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {unregisteredSearchQuery ? "No matching members found" : "All group members are registered! 🎉"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Phone Number</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUnregistered.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.fullPhone || member.phone || 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </>
  );
});

export default WorkshopParticipantTabs;
