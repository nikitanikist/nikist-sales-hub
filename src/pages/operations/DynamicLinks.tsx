import { useState } from 'react';
import { Plus, Link as LinkIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/PageHeader';
import { PageIntro } from '@/components/PageIntro';
import { useDynamicLinks, DynamicLink } from '@/hooks/useDynamicLinks';
import { LinkCard } from '@/components/operations/LinkCard';
import { CreateLinkDialog } from '@/components/operations/CreateLinkDialog';
import { EmptyState } from '@/components/EmptyState';

export default function DynamicLinks() {
  const { links, isLoading } = useDynamicLinks();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<DynamicLink | null>(null);

  const handleEdit = (link: DynamicLink) => {
    setEditingLink(link);
    setIsCreateDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsCreateDialogOpen(false);
    setEditingLink(null);
  };

  return (
    <div className="container mx-auto py-4 sm:py-6 px-4">
      <PageHeader
        title="Dynamic Links"
        subtitle="Create shareable links that you can update anytime"
      />
      
      <PageIntro
        tagline="URL Redirection Made Simple"
        description="Create permanent links like /link/whatsapp-group that redirect to any destination. Perfect for WhatsApp group invites that change with each workshop — update the destination without changing the link you share."
        icon={LinkIcon}
      />

      <div className="flex justify-end mb-6">
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create New Link
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !links || links.length === 0 ? (
        <EmptyState
          icon={LinkIcon}
          title="No dynamic links yet"
          description="Create your first dynamic link to start redirecting users to your WhatsApp groups or any URL."
          actionLabel="Create Link"
          onAction={() => setIsCreateDialogOpen(true)}
        />
      ) : (
        <div className="grid gap-4">
          {links.map((link) => (
            <LinkCard 
              key={link.id} 
              link={link} 
              onEdit={() => handleEdit(link)}
            />
          ))}
        </div>
      )}

      <CreateLinkDialog
        open={isCreateDialogOpen}
        onOpenChange={handleCloseDialog}
        editingLink={editingLink}
      />
    </div>
  );
}
