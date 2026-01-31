import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Trash2, FileText, ListOrdered, Tag, Clock, Loader2, Image, Check, X } from 'lucide-react';
import { useMessageTemplates, TEMPLATE_VARIABLES, CreateTemplateInput } from '@/hooks/useMessageTemplates';
import { useTemplateSequences, CreateSequenceInput, CreateStepInput } from '@/hooks/useTemplateSequences';
import { useWorkshopTags, TAG_COLORS, CreateTagInput } from '@/hooks/useWorkshopTags';
import { WorkshopTagBadge } from '@/components/operations';
import { toast } from 'sonner';

// Template Editor Dialog
function TemplateEditorDialog({
  open,
  onOpenChange,
  template,
  onSave,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: { id: string; name: string; content: string; description?: string | null; media_url?: string | null } | null;
  onSave: (data: CreateTemplateInput & { id?: string }) => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(template?.name || '');
  const [content, setContent] = useState(template?.content || '');
  const [description, setDescription] = useState(template?.description || '');
  const [mediaUrl, setMediaUrl] = useState(template?.media_url || '');

  // Sync state when template prop changes
  useEffect(() => {
    if (template) {
      setName(template.name || '');
      setContent(template.content || '');
      setDescription(template.description || '');
      setMediaUrl(template.media_url || '');
    } else {
      setName('');
      setContent('');
      setDescription('');
      setMediaUrl('');
    }
  }, [template]);

  const handleSave = () => {
    if (!name.trim() || !content.trim()) {
      toast.error('Name and content are required');
      return;
    }
    onSave({ id: template?.id, name, content, description, media_url: mediaUrl.trim() || null });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? 'Edit Template' : 'Create Template'}</DialogTitle>
          <DialogDescription>
            Create message templates with variables for automated notifications.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Template Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Morning Reminder"
            />
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this template"
            />
          </div>
          <div className="space-y-2">
            <Label>Message Content</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your message..."
              rows={5}
            />
            <div className="flex flex-wrap gap-1 mt-2">
              <span className="text-xs text-muted-foreground">Variables:</span>
              {TEMPLATE_VARIABLES.map((v) => (
                <Badge
                  key={v.key}
                  variant="secondary"
                  className="text-xs cursor-pointer hover:bg-secondary/80"
                  onClick={() => setContent((prev) => prev + ' ' + v.key)}
                  title={v.description}
                >
                  {v.key}
                </Badge>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Media URL (Optional)</Label>
            <Input
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
            />
            {mediaUrl && (
              <img
                src={mediaUrl}
                alt="Preview"
                className="h-20 object-cover rounded border"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            )}
            <p className="text-xs text-muted-foreground">
              Enter an image or video URL to attach media to this template.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {template ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Sequence Editor Dialog
function SequenceEditorDialog({
  open,
  onOpenChange,
  sequence,
  templates,
  onSave,
  onAddStep,
  onDeleteStep,
  onUpdateStep,
  isSaving,
  isAddingStep,
  isUpdatingStep,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sequence?: { id: string; name: string; description?: string | null; steps?: any[] } | null;
  templates: Array<{ id: string; name: string }>;
  onSave: (data: CreateSequenceInput & { id?: string }) => Promise<any>;
  onAddStep: (data: CreateStepInput) => Promise<any>;
  onDeleteStep: (stepId: string, sequenceId: string, stepOrder: number) => Promise<void>;
  onUpdateStep: (data: { id: string; send_time?: string; template_id?: string; time_label?: string }) => Promise<any>;
  isSaving: boolean;
  isAddingStep: boolean;
  isUpdatingStep: boolean;
}) {
  const [name, setName] = useState(sequence?.name || '');
  const [description, setDescription] = useState(sequence?.description || '');
  const [newStepTime, setNewStepTime] = useState('11:00');
  const [newStepTemplate, setNewStepTemplate] = useState('');
  const [newStepLabel, setNewStepLabel] = useState('');
  const [showSaved, setShowSaved] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Inline editing state
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<{
    send_time: string;
    template_id: string;
    time_label: string;
  }>({ send_time: '', template_id: '', time_label: '' });

  // Sync state when sequence prop changes
  useEffect(() => {
    if (sequence) {
      setName(sequence.name || '');
      setDescription(sequence.description || '');
    } else {
      setName('');
      setDescription('');
    }
    // Reset step inputs when sequence changes
    setNewStepTime('11:00');
    setNewStepTemplate('');
    setNewStepLabel('');
    setShowSaved(false);
    // Don't reset editingStepId here - let handleSaveEdit control it
  }, [sequence]);

  // Reset edit state when dialog closes
  useEffect(() => {
    if (!open) {
      setEditingStepId(null);
      setEditingValues({ send_time: '', template_id: '', time_label: '' });
    }
  }, [open]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    await onSave({ id: sequence?.id, name, description });
    if (!sequence) {
      onOpenChange(false);
    }
  };

  // Calculate next step order based on MAX
  const getNextOrder = () => {
    if (!sequence?.steps || sequence.steps.length === 0) return 1;
    return Math.max(...sequence.steps.map((s: any) => s.step_order)) + 1;
  };

  const handleAddStep = async () => {
    if (!sequence?.id || !newStepTemplate) {
      toast.error('Please select a template');
      return;
    }
    await onAddStep({
      sequence_id: sequence.id,
      template_id: newStepTemplate,
      send_time: newStepTime + ':00',
      time_label: newStepLabel || undefined,
      step_order: getNextOrder(),
    });
    setNewStepTime('11:00');
    setNewStepTemplate('');
    setNewStepLabel('');
    // Show saved indicator
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  };

  const handleDeleteStep = async (stepId: string, stepOrder: number) => {
    if (!sequence?.id) return;
    setIsDeleting(true);
    try {
      await onDeleteStep(stepId, sequence.id, stepOrder);
    } finally {
      setIsDeleting(false);
    }
  };

  const startEditing = (step: any) => {
    setEditingStepId(step.id);
    setEditingValues({
      send_time: step.send_time?.slice(0, 5) || '',
      template_id: step.template_id || '',
      time_label: step.time_label || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingStepId) return;
    try {
      await onUpdateStep({
        id: editingStepId,
        send_time: editingValues.send_time + ':00',
        template_id: editingValues.template_id,
        time_label: editingValues.time_label || undefined,
      });
    } catch (error) {
      // Error handled by mutation
    } finally {
      // Always exit edit mode, regardless of success/failure
      setEditingStepId(null);
      setEditingValues({ send_time: '', template_id: '', time_label: '' });
    }
  };

  const cancelEditing = () => {
    setEditingStepId(null);
    setEditingValues({ send_time: '', template_id: '', time_label: '' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{sequence ? 'Edit Sequence' : 'Create Sequence'}</DialogTitle>
          <DialogDescription>
            {sequence 
              ? 'Click on a step to edit it. Changes are saved when you click Save.'
              : 'Define when each message template should be sent.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Sequence Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Evening Workshop Sequence"
                disabled={!!sequence}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description"
                disabled={!!sequence}
              />
            </div>
          </div>

          {sequence && (
            <>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">Time</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead className="w-32">Label</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(sequence.steps || []).map((step: any) => (
                      <TableRow key={step.id}>
                        {editingStepId === step.id ? (
                          <>
                            <TableCell>
                              <Input
                                type="time"
                                value={editingValues.send_time}
                                onChange={(e) => setEditingValues(prev => ({ ...prev, send_time: e.target.value }))}
                                className="w-24 h-8"
                              />
                            </TableCell>
                            <TableCell>
                              <Select value={editingValues.template_id} onValueChange={(v) => setEditingValues(prev => ({ ...prev, template_id: v }))}>
                                <SelectTrigger className="h-8">
                                  <SelectValue placeholder="Select..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {templates.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>
                                      {t.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                value={editingValues.time_label}
                                onChange={(e) => setEditingValues(prev => ({ ...prev, time_label: e.target.value }))}
                                placeholder="Label"
                                className="h-8"
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={handleSaveEdit}
                                  disabled={isUpdatingStep}
                                >
                                  {isUpdatingStep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-success" />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={cancelEditing}
                                  disabled={isUpdatingStep}
                                >
                                  <X className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </div>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="font-mono">
                              {step.send_time?.slice(0, 5)}
                            </TableCell>
                            <TableCell>{step.template?.name || '—'}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {step.time_label || '—'}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => startEditing(step)}
                                  disabled={isDeleting}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleDeleteStep(step.id, step.step_order)}
                                  disabled={isDeleting}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                    {(sequence.steps || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No steps added yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex gap-2 items-end">
                <div className="space-y-2">
                  <Label className="text-xs">Time</Label>
                  <Input
                    type="time"
                    value={newStepTime}
                    onChange={(e) => setNewStepTime(e.target.value)}
                    className="w-28"
                  />
                </div>
                <div className="space-y-2 flex-1">
                  <Label className="text-xs">Template</Label>
                  <Select value={newStepTemplate} onValueChange={setNewStepTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 w-36">
                  <Label className="text-xs">Label (optional)</Label>
                  <Input
                    value={newStepLabel}
                    onChange={(e) => setNewStepLabel(e.target.value)}
                    placeholder="e.g., Morning"
                  />
                </div>
                <Button onClick={handleAddStep} size="icon" disabled={isAddingStep || isDeleting}>
                  {isAddingStep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>

              {/* Saved indicator */}
              {showSaved && (
                <div className="flex items-center gap-2 text-sm text-success animate-in fade-in slide-in-from-bottom-2">
                  <Check className="h-4 w-4" />
                  <span>Step added and saved</span>
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          {sequence ? (
            // When editing, just show a Done button since changes auto-save
            <Button onClick={() => onOpenChange(false)}>
              Done
            </Button>
          ) : (
            // When creating, show Cancel and Create buttons
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create & Add Steps
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Tag Editor Dialog
function TagEditorDialog({
  open,
  onOpenChange,
  tag,
  sequences,
  onSave,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag?: { id: string; name: string; color?: string | null; description?: string | null; template_sequence_id?: string | null } | null;
  sequences: Array<{ id: string; name: string }>;
  onSave: (data: CreateTagInput & { id?: string }) => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(tag?.name || '');
  const [color, setColor] = useState(tag?.color || TAG_COLORS[0].value);
  const [description, setDescription] = useState(tag?.description || '');
  const [sequenceId, setSequenceId] = useState(tag?.template_sequence_id || '_none');

  // Sync state when tag prop changes
  useEffect(() => {
    if (tag) {
      setName(tag.name || '');
      setColor(tag.color || TAG_COLORS[0].value);
      setDescription(tag.description || '');
      setSequenceId(tag.template_sequence_id || '_none');
    } else {
      setName('');
      setColor(TAG_COLORS[0].value);
      setDescription('');
      setSequenceId('_none');
    }
  }, [tag]);

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    onSave({
      id: tag?.id,
      name,
      color,
      description,
      template_sequence_id: sequenceId === '_none' ? null : sequenceId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tag ? 'Edit Tag' : 'Create Tag'}</DialogTitle>
          <DialogDescription>
            Tags help organize workshops and link them to notification sequences.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tag Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Evening Workshop"
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {TAG_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`h-8 w-8 rounded-full border-2 transition-all ${
                    color === c.value ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Template Sequence</Label>
            <Select value={sequenceId} onValueChange={setSequenceId}>
              <SelectTrigger>
                <SelectValue placeholder="Select sequence..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">No sequence</SelectItem>
                {sequences.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description"
            />
          </div>
          {name && (
            <div className="pt-2">
              <Label className="text-xs text-muted-foreground">Preview</Label>
              <div className="mt-1">
                <WorkshopTagBadge name={name} color={color} />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {tag ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Main Settings Component
export function WorkshopNotificationSettings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { templates, templatesLoading, deleteTemplate } = useMessageTemplates();
  const { sequences, sequencesLoading, createSequence, deleteSequence, createStep, deleteStepAsync, updateStepAsync, isCreatingSequence, isCreatingStep, isUpdatingStep, useSequence } = useTemplateSequences();
  const { tags, tagsLoading, createTag, updateTag, deleteTag, isCreating: isCreatingTag, isUpdating: isUpdatingTag } = useWorkshopTags();

  // Get initial tab from URL params
  const initialTab = searchParams.get('tab') || 'templates';

  // Sequence dialog state - use ID-based approach for reactive updates
  const [sequenceDialogOpen, setSequenceDialogOpen] = useState(false);
  const [editingSequenceId, setEditingSequenceId] = useState<string | null>(null);
  const { data: editingSequence, isLoading: isLoadingEditingSequence } = useSequence(editingSequenceId);

  // Tag dialog state
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<any>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workshop Notifications</CardTitle>
        <CardDescription>
          Configure message templates, sequences, and tags for automated workshop notifications.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={initialTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="templates" className="gap-2">
              <FileText className="h-4 w-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="sequences" className="gap-2">
              <ListOrdered className="h-4 w-4" />
              Sequences
            </TabsTrigger>
            <TabsTrigger value="tags" className="gap-2">
              <Tag className="h-4 w-4" />
              Tags
            </TabsTrigger>
          </TabsList>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Create reusable message templates with variables.
              </p>
              <Button onClick={() => navigate('/settings/templates/new')}>
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </div>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Preview</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templatesLoading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : templates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        No templates yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    templates.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {t.media_url && <Image className="h-4 w-4 text-muted-foreground" />}
                            {t.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">
                          {t.content.slice(0, 80)}{t.content.length > 80 ? '...' : ''}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => navigate(`/settings/templates/${t.id}`)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteTemplate(t.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Sequences Tab */}
          <TabsContent value="sequences" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Define message schedules with specific times.
              </p>
              <Button onClick={() => { setEditingSequenceId(null); setSequenceDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                New Sequence
              </Button>
            </div>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Steps</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sequencesLoading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : sequences.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        No sequences yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    sequences.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {(s.steps || []).slice(0, 4).map((step: any) => (
                              <Badge key={step.id} variant="secondary" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                {step.send_time?.slice(0, 5)}
                              </Badge>
                            ))}
                            {(s.steps || []).length > 4 && (
                              <Badge variant="secondary" className="text-xs">
                                +{(s.steps || []).length - 4}
                              </Badge>
                            )}
                            {(s.steps || []).length === 0 && (
                              <span className="text-muted-foreground text-xs">No steps</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { setEditingSequenceId(s.id); setSequenceDialogOpen(true); }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteSequence(s.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Tags Tab */}
          <TabsContent value="tags" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Create tags to categorize workshops and link them to sequences.
              </p>
              <Button onClick={() => { setEditingTag(null); setTagDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                New Tag
              </Button>
            </div>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tag</TableHead>
                    <TableHead>Sequence</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tagsLoading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : tags.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        No tags yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    tags.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <WorkshopTagBadge name={t.name} color={t.color || '#8B5CF6'} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {t.template_sequence?.name || '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { setEditingTag(t); setTagDialogOpen(true); }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteTag(t.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        {/* Dialogs */}

        <SequenceEditorDialog
          open={sequenceDialogOpen}
          onOpenChange={(open) => {
            setSequenceDialogOpen(open);
            if (!open) {
              setEditingSequenceId(null);
            }
          }}
          sequence={editingSequence}
          templates={templates}
          onSave={async (data) => {
            if (data.id) {
              // Existing sequence - hook will handle refresh automatically
            } else {
              const newSeq = await createSequence(data);
              setEditingSequenceId(newSeq.id);
            }
          }}
          onAddStep={async (data) => {
            await createStep(data);
            // Hook automatically invalidates and refetches - no manual refresh needed
          }}
          onDeleteStep={async (stepId, sequenceId, stepOrder) => {
            await deleteStepAsync({ stepId, sequenceId, stepOrder });
            // Hook automatically invalidates and refetches - no manual refresh needed
          }}
          onUpdateStep={async (data) => {
            await updateStepAsync(data);
            // Hook automatically invalidates and refetches - no manual refresh needed
          }}
          isSaving={isCreatingSequence}
          isAddingStep={isCreatingStep}
          isUpdatingStep={isUpdatingStep}
        />

        <TagEditorDialog
          open={tagDialogOpen}
          onOpenChange={setTagDialogOpen}
          tag={editingTag}
          sequences={sequences}
          onSave={(data) => {
            if (data.id) {
              updateTag({ id: data.id, ...data });
            } else {
              createTag(data);
            }
            setTagDialogOpen(false);
          }}
          isSaving={isCreatingTag || isUpdatingTag}
        />
      </CardContent>
    </Card>
  );
}
