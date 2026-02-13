import { useState } from "react";
import { useMessageTemplates, CreateTemplateInput } from "@/hooks/useMessageTemplates";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { Plus, Pencil, Trash2 } from "lucide-react";

const Templates = () => {
  const { templates, templatesLoading, createTemplate, isCreating, updateTemplate, isUpdating, deleteTemplate, isDeleting } = useMessageTemplates();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateTemplateInput>({ name: "", content: "" });

  const openNew = () => {
    setEditingId(null);
    setForm({ name: "", content: "", description: "", media_url: "" });
    setDialogOpen(true);
  };

  const openEdit = (id: string) => {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    setEditingId(id);
    setForm({ name: tpl.name, content: tpl.content, description: tpl.description || "", media_url: tpl.media_url || "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (editingId) {
      updateTemplate({ id: editingId, ...form });
    } else {
      await createTemplate(form);
    }
    setDialogOpen(false);
  };

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
        <Button onClick={openNew} className="gap-2">
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
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
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
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(t.id)}>
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Template" : "New Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="tpl-name">Name</Label>
              <Input id="tpl-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="tpl-content">Content</Label>
              <Textarea id="tpl-content" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="min-h-[100px]" />
            </div>
            <div>
              <Label htmlFor="tpl-media">Media URL (optional)</Label>
              <Input id="tpl-media" value={form.media_url || ""} onChange={(e) => setForm({ ...form, media_url: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.content || isCreating || isUpdating}>
              {editingId ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
