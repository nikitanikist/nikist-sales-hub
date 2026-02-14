import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMessageTemplates } from "@/hooks/useMessageTemplates";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { Plus, Pencil, Trash2, FileText } from "lucide-react";

const Templates = () => {
  const navigate = useNavigate();
  const { templates, templatesLoading, deleteTemplate, isDeleting } = useMessageTemplates();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (templatesLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50/50 -mx-4 -mt-2 px-4 pt-2 sm:-mx-6 sm:px-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <PageHeader title="Message Templates" />
          <Button
            onClick={() => navigate("/whatsapp/templates/new")}
            className="gap-2 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
          >
            <Plus className="h-4 w-4" /> New Template
          </Button>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="text-slate-500 font-medium">Name</TableHead>
                  <TableHead className="text-slate-500 font-medium">Content</TableHead>
                  <TableHead className="text-center text-slate-500 font-medium">Media</TableHead>
                  <TableHead className="w-24 text-slate-500 font-medium">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-16">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                          <FileText className="h-8 w-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-1">No templates yet</h3>
                        <p className="text-sm text-slate-500 max-w-sm mb-4">
                          Create reusable message templates to speed up your notification workflow.
                        </p>
                        <Button
                          onClick={() => navigate("/whatsapp/templates/new")}
                          className="gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Create First Template
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  templates.map((t) => (
                    <TableRow key={t.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0">
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                        {t.content}
                      </TableCell>
                      <TableCell className="text-center">
                        {t.media_url ? (
                          <Badge variant="outline" className="text-xs">Has media</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/whatsapp/templates/${t.id}/edit`)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(t.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Delete confirmation */}
        <ConfirmDeleteDialog
          open={!!deleteId}
          onOpenChange={(open) => !open && setDeleteId(null)}
          onConfirm={() => { if (deleteId) { deleteTemplate(deleteId); setDeleteId(null); } }}
          title="Delete Template"
          description="Are you sure you want to delete this template? This action cannot be undone."
        />
      </div>
    </div>
  );
};

export default Templates;
