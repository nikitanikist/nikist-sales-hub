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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Message Templates" />
        <Button onClick={() => navigate("/whatsapp/templates/new")} className="gap-2">
          <Plus className="h-4 w-4" /> New Template
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Content</TableHead>
                <TableHead className="text-center">Media</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No templates yet. Create your first template.
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((t) => (
                  <TableRow key={t.id}>
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
  );
};

export default Templates;
