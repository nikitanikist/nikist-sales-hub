import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Copy, Edit2, Trash2, ExternalLink, MessageCircle, Link as LinkIcon, MousePointerClick } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { useDynamicLinks, DynamicLink } from '@/hooks/useDynamicLinks';
import { toast } from 'sonner';

interface LinkCardProps {
  link: DynamicLink;
  onEdit: () => void;
}

export function LinkCard({ link, onEdit }: LinkCardProps) {
  const { deleteLink, isDeleting } = useDynamicLinks();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Build the full URL based on current location
  const baseUrl = window.location.origin;
  const fullUrl = `${baseUrl}/link/${link.slug}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleDelete = () => {
    deleteLink(link.id);
    setShowDeleteDialog(false);
  };

  // Check if it's a WhatsApp link by checking if destination_url contains chat.whatsapp.com
  const isWhatsAppLink = link.destination_url?.includes('chat.whatsapp.com') || false;
  const destinationDisplay = link.destination_url;

  return (
    <>
      <Card className={!link.is_active ? 'opacity-60' : undefined}>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            {/* Left side: Link info */}
            <div className="flex-1 min-w-0 space-y-2">
              {/* Slug */}
              <div className="flex items-center gap-2 flex-wrap">
                <code className="text-sm sm:text-base font-mono font-semibold text-foreground bg-muted px-2 py-0.5 rounded">
                  /link/{link.slug}
                </code>
                {!link.is_active && (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </div>

              {/* Destination */}
              <div className="flex items-center gap-2 text-muted-foreground">
                {isWhatsAppLink ? (
                  <MessageCircle className="h-4 w-4 flex-shrink-0 text-primary" />
                ) : (
                  <LinkIcon className="h-4 w-4 flex-shrink-0" />
                )}
                <span className="truncate text-sm">
                  {isWhatsAppLink ? (
                    <span className="text-primary">
                      WhatsApp: {destinationDisplay}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{destinationDisplay}</span>
                  )}
                </span>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MousePointerClick className="h-3.5 w-3.5" />
                  {link.click_count.toLocaleString()} clicks
                </span>
                <span>
                  Created {formatDistanceToNow(new Date(link.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>

            {/* Right side: Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyLink}
                className="gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Copy</span>
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.open(fullUrl, '_blank')}
                title="Test link"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={onEdit}
                title="Edit link"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteDialog(true)}
                title="Delete link"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
        title="Delete Dynamic Link"
        description={`Are you sure you want to delete "/link/${link.slug}"? This action cannot be undone and all click data will be lost.`}
      />
    </>
  );
}
