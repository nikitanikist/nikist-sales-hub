import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Upload, Trash2, Image, Plus, Edit2, Check, X, Info } from 'lucide-react';
import { useWorkshopTags } from '@/hooks/useWorkshopTags';
import { useCommunityTemplates, COMMUNITY_TEMPLATE_VARIABLES } from '@/hooks/useCommunityTemplates';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { WorkshopTagBadge } from '@/components/operations/WorkshopTagBadge';

export function CommunityTemplateEditor() {
  const { tags, tagsLoading } = useWorkshopTags();
  const { 
    templates, 
    templatesLoading, 
    createTemplate, 
    updateTemplate, 
    deleteTemplate,
    isCreating,
    isUpdating,
    isDeleting,
  } = useCommunityTemplates();

  const [selectedTagId, setSelectedTagId] = useState<string>('');
  const [descriptionTemplate, setDescriptionTemplate] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tags that don't have a template yet
  const availableTags = tags.filter(
    tag => !templates.some(t => t.tag_id === tag.id)
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 2MB for profile pictures)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `profile-pictures/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('community-templates')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('community-templates')
        .getPublicUrl(filePath);

      setProfilePictureUrl(publicUrl);
      toast.success('Image uploaded');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = () => {
    if (!selectedTagId) {
      toast.error('Please select a tag');
      return;
    }
    if (!descriptionTemplate.trim()) {
      toast.error('Please enter a description template');
      return;
    }

    if (editingTemplateId) {
      updateTemplate({
        id: editingTemplateId,
        description_template: descriptionTemplate,
        profile_picture_url: profilePictureUrl,
      });
    } else {
      createTemplate({
        tag_id: selectedTagId,
        description_template: descriptionTemplate,
        profile_picture_url: profilePictureUrl,
      });
    }

    // Reset form
    setSelectedTagId('');
    setDescriptionTemplate('');
    setProfilePictureUrl(null);
    setEditingTemplateId(null);
  };

  const handleEdit = (template: typeof templates[0]) => {
    setEditingTemplateId(template.id);
    setSelectedTagId(template.tag_id);
    setDescriptionTemplate(template.description_template);
    setProfilePictureUrl(template.profile_picture_url);
  };

  const handleCancel = () => {
    setEditingTemplateId(null);
    setSelectedTagId('');
    setDescriptionTemplate('');
    setProfilePictureUrl(null);
  };

  const handleDelete = (templateId: string) => {
    deleteTemplate(templateId);
  };

  const insertVariable = (variable: string) => {
    setDescriptionTemplate(prev => prev + variable);
  };

  const isLoading = templatesLoading || tagsLoading;
  const isSaving = isCreating || isUpdating;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5" />
          Community Creation Templates
        </CardTitle>
        <CardDescription>
          Define profile pictures and descriptions for WhatsApp groups created for each workshop tag.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Template Editor Form */}
        <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">
              {editingTemplateId ? 'Edit Template' : 'New Template'}
            </h4>
            {editingTemplateId && (
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tag</Label>
              <Select
                value={selectedTagId}
                onValueChange={setSelectedTagId}
                disabled={!!editingTemplateId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a tag" />
                </SelectTrigger>
                <SelectContent>
                  {editingTemplateId ? (
                    // Show the current tag when editing
                    tags
                      .filter(t => t.id === selectedTagId)
                      .map(tag => (
                        <SelectItem key={tag.id} value={tag.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: tag.color || '#8B5CF6' }}
                            />
                            {tag.name}
                          </div>
                        </SelectItem>
                      ))
                  ) : (
                    availableTags.map(tag => (
                      <SelectItem key={tag.id} value={tag.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: tag.color || '#8B5CF6' }}
                          />
                          {tag.name}
                        </div>
                      </SelectItem>
                    ))
                  )}
                  {!editingTemplateId && availableTags.length === 0 && (
                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                      All tags have templates
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Profile Picture</Label>
              <div className="flex items-center gap-3">
                {profilePictureUrl ? (
                  <div className="relative">
                    <img
                      src={profilePictureUrl}
                      alt="Profile"
                      className="h-16 w-16 rounded-full object-cover border"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-1 -right-1 h-5 w-5"
                      onClick={() => setProfilePictureUrl(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Upload Image
                  </Button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Square image recommended. Max 2MB.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Group Description Template</Label>
            <Textarea
              value={descriptionTemplate}
              onChange={(e) => setDescriptionTemplate(e.target.value)}
              placeholder="Welcome to {workshop_title}!&#10;&#10;📅 {workshop_date}&#10;⏰ {start_time}&#10;&#10;Stay tuned for updates!"
              rows={5}
            />
            <div className="flex flex-wrap gap-1 mt-2">
              <span className="text-xs text-muted-foreground mr-1">Variables:</span>
              {COMMUNITY_TEMPLATE_VARIABLES.map((v) => (
                <Badge
                  key={v.key}
                  variant="secondary"
                  className="text-xs cursor-pointer hover:bg-secondary/80"
                  onClick={() => insertVariable(v.key)}
                  title={v.description}
                >
                  {v.key}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving || !selectedTagId}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingTemplateId ? 'Update Template' : 'Save Template'}
            </Button>
          </div>
        </div>

        {/* VPS Note */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Note:</strong> Profile picture support requires VPS update. The description template is applied immediately; profile pictures will be applied once VPS is updated.
          </AlertDescription>
        </Alert>

        {/* Existing Templates List */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm text-muted-foreground">Existing Templates</h4>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border rounded-lg">
              <Image className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No community templates yet</p>
              <p className="text-sm">Create a template above to define group settings per tag</p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {template.profile_picture_url ? (
                      <img
                        src={template.profile_picture_url}
                        alt="Profile"
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <Image className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      {template.tag && (
                        <WorkshopTagBadge
                          name={template.tag.name}
                          color={template.tag.color}
                        />
                      )}
                      <p className="text-sm text-muted-foreground mt-1 max-w-md truncate">
                        {template.description_template.slice(0, 60)}
                        {template.description_template.length > 60 && '...'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(template)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(template.id)}
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
