import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center animate-fade-in">
        <div className="relative mb-6 inline-block">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-[hsl(280,83%,58%)]/20 rounded-full blur-xl" />
          <div className="relative p-5 bg-gradient-to-br from-violet-100 to-violet-50 rounded-2xl border border-violet-200">
            <FileQuestion className="h-12 w-12 text-violet-600" />
          </div>
        </div>
        <h1 className="mb-2 text-6xl font-bold gradient-text">404</h1>
        <p className="mb-2 text-xl font-semibold">Page Not Found</p>
        <p className="mb-6 text-muted-foreground max-w-md mx-auto">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Button asChild variant="gradient">
          <Link to="/">Return to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
