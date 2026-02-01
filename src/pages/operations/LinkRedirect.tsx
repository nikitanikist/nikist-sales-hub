import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, Link2Off, ArrowLeft } from 'lucide-react';
import { usePublicLinkRedirect } from '@/hooks/useDynamicLinks';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LinkRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const { data: destinationUrl, isLoading, error } = usePublicLinkRedirect(slug || '');

  useEffect(() => {
    if (destinationUrl) {
      // Redirect to the destination URL
      window.location.href = destinationUrl;
    }
  }, [destinationUrl]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="flex flex-col items-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Redirecting you...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Link not found or inactive
  if (!destinationUrl || error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <Link2Off className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Link Not Found</CardTitle>
            <CardDescription>
              This link doesn't exist or is no longer active.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button variant="outline" asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go to Homepage
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Waiting for redirect
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="flex flex-col items-center py-12">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Redirecting you...</p>
        </CardContent>
      </Card>
    </div>
  );
}
