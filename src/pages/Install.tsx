import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, Share, Plus, Check, Monitor, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detect platform
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    const isAndroidDevice = /android/.test(userAgent);
    
    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);

    // Check if app is already installed (running in standalone mode)
    const isInStandaloneMode = 
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    
    setIsStandalone(isInStandaloneMode);
    setIsInstalled(isInStandaloneMode);

    // Listen for the beforeinstallprompt event (Chrome/Edge/Samsung Browser)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (isStandalone) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Check className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Already Installed!</CardTitle>
            <CardDescription>
              You're already using Nikist CRM as an installed app. Enjoy the full experience!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/")} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="font-semibold text-foreground">Install App</h1>
          <div className="w-16" /> {/* Spacer for centering */}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Smartphone className="h-10 w-10" />
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-3">
            Install Nikist CRM
          </h2>
          <p className="text-muted-foreground text-lg">
            Get quick access from your home screen. Works offline and feels like a native app!
          </p>
        </div>

        {/* Benefits */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Why Install?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Download className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Quick Access</p>
                <p className="text-sm text-muted-foreground">Launch directly from your home screen with one tap</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Monitor className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Full Screen Experience</p>
                <p className="text-sm text-muted-foreground">No browser bars - enjoy the complete app experience</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Smartphone className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Works Offline</p>
                <p className="text-sm text-muted-foreground">Access cached data even without internet connection</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Installation Instructions */}
        {isInstalled ? (
          <Card className="border-primary">
            <CardContent className="pt-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Check className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                Successfully Installed!
              </h3>
              <p className="text-muted-foreground mb-4">
                Nikist CRM is now on your home screen. You can close this browser and use the app directly.
              </p>
              <Button onClick={() => navigate("/")} className="w-full">
                Open Dashboard
              </Button>
            </CardContent>
          </Card>
        ) : deferredPrompt ? (
          <Card className="border-primary">
            <CardContent className="pt-6">
              <Button onClick={handleInstallClick} className="w-full" size="lg">
                <Download className="mr-2 h-5 w-5" />
                Install Nikist CRM
              </Button>
              <p className="text-center text-sm text-muted-foreground mt-3">
                Click the button above to add the app to your device
              </p>
            </CardContent>
          </Card>
        ) : isIOS ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share className="h-5 w-5" />
                Install on iPhone/iPad
              </CardTitle>
              <CardDescription>
                Follow these simple steps to install the app
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                  1
                </div>
                <div>
                  <p className="font-medium text-foreground">Tap the Share button</p>
                  <p className="text-sm text-muted-foreground">
                    Look for the <Share className="inline h-4 w-4" /> icon at the bottom of Safari
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                  2
                </div>
                <div>
                  <p className="font-medium text-foreground">Scroll down and tap "Add to Home Screen"</p>
                  <p className="text-sm text-muted-foreground">
                    Look for the <Plus className="inline h-4 w-4" /> icon in the menu
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                  3
                </div>
                <div>
                  <p className="font-medium text-foreground">Tap "Add" to confirm</p>
                  <p className="text-sm text-muted-foreground">
                    The app icon will appear on your home screen
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : isAndroid ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Install on Android
              </CardTitle>
              <CardDescription>
                Follow these simple steps to install the app
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                  1
                </div>
                <div>
                  <p className="font-medium text-foreground">Tap the menu button</p>
                  <p className="text-sm text-muted-foreground">
                    Look for the three dots (⋮) in Chrome's top right corner
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                  2
                </div>
                <div>
                  <p className="font-medium text-foreground">Tap "Add to Home screen"</p>
                  <p className="text-sm text-muted-foreground">
                    Or look for "Install app" if available
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                  3
                </div>
                <div>
                  <p className="font-medium text-foreground">Tap "Add" to confirm</p>
                  <p className="text-sm text-muted-foreground">
                    The app will be added to your home screen
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Install on Desktop
              </CardTitle>
              <CardDescription>
                Add Nikist CRM to your desktop for quick access
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                  1
                </div>
                <div>
                  <p className="font-medium text-foreground">Look for the install icon</p>
                  <p className="text-sm text-muted-foreground">
                    In Chrome, click the <Download className="inline h-4 w-4" /> icon in the address bar
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                  2
                </div>
                <div>
                  <p className="font-medium text-foreground">Click "Install"</p>
                  <p className="text-sm text-muted-foreground">
                    Confirm the installation in the popup dialog
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                  3
                </div>
                <div>
                  <p className="font-medium text-foreground">Launch from your desktop</p>
                  <p className="text-sm text-muted-foreground">
                    Find Nikist CRM in your applications or desktop
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Install;
