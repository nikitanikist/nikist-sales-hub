import { Settings2, LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface ComingSoonPlaceholderProps {
  channel: string;
  provider: string;
  icon?: LucideIcon;
  description?: string;
}

export function ComingSoonPlaceholder({ 
  channel, 
  provider, 
  icon: Icon,
  description 
}: ComingSoonPlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        {Icon ? (
          <Icon className="h-8 w-8 text-muted-foreground" />
        ) : (
          <Settings2 className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      <h3 className="text-lg font-semibold">{channel} Notifications</h3>
      <p className="text-sm text-muted-foreground mt-2 max-w-md">
        {description || `Send individual ${channel.toLowerCase()} notifications to workshop registrants via ${provider}.`}
      </p>
      <Badge variant="secondary" className="mt-4">Coming Soon</Badge>
      <Button variant="link" asChild className="mt-4 text-muted-foreground">
        <Link to="/settings/organization">Configure in Settings</Link>
      </Button>
    </div>
  );
}
