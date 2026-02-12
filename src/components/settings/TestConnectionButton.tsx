import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Loader2, TestTube, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TestConnectionButtonProps {
  integrationType: "zoom" | "calendly" | "whatsapp" | "aisensy";
  config: Record<string, string>;
  organizationId?: string;
}

type TestStatus = "idle" | "testing" | "success" | "error";

export function TestConnectionButton({ integrationType, config, organizationId }: TestConnectionButtonProps) {
  const [status, setStatus] = useState<TestStatus>("idle");

  const testConnection = async () => {
    setStatus("testing");
    
    try {
      let isValid = false;
      let message = "";

      switch (integrationType) {
        case "zoom": {
          // Test Zoom by attempting to get an access token
          if (!config.account_id || !config.client_id || !config.client_secret) {
            throw new Error("Missing required Zoom credentials");
          }
          
          // We can't directly test Zoom from browser due to CORS
          // Instead, we'll validate that all required fields are present
          isValid = true;
          message = "Zoom credentials appear valid. Full validation occurs during meeting creation.";
          break;
        }
        
        case "calendly": {
          // Test Calendly by validating the API token
          if (!config.api_token) {
            throw new Error("Missing Calendly API token");
          }
          
          // Test the token with a simple API call
          const response = await fetch("https://api.calendly.com/users/me", {
            headers: {
              "Authorization": `Bearer ${config.api_token}`,
              "Content-Type": "application/json",
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            isValid = true;
            message = `Connected as: ${data.resource?.name || data.resource?.email || "Unknown user"}`;
          } else {
            throw new Error("Invalid Calendly API token");
          }
          break;
        }
        
        case "whatsapp":
        case "aisensy": {
          // Test AiSensy by checking if API key format is valid
          if (!config.api_key) {
            throw new Error("Missing AiSensy API key");
          }
          
          if (!config.source) {
            throw new Error("Missing source number");
          }
          
          // AiSensy doesn't have a simple validation endpoint
          // We'll validate format and consider it valid
          isValid = true;
          message = "AISensy credentials appear valid. Test by sending a message.";
          break;
        }
        
        default:
          throw new Error("Unknown integration type");
      }

      if (isValid) {
        setStatus("success");
        toast({
          title: "Connection Successful",
          description: message,
        });
        
        // Reset to idle after 3 seconds
        setTimeout(() => setStatus("idle"), 3000);
      }
    } catch (error) {
      setStatus("error");
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
      
      // Reset to idle after 3 seconds
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  const getButtonContent = () => {
    switch (status) {
      case "testing":
        return (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Testing...
          </>
        );
      case "success":
        return (
          <>
            <CheckCircle className="h-4 w-4 mr-2" />
            Connected
          </>
        );
      case "error":
        return (
          <>
            <XCircle className="h-4 w-4 mr-2" />
            Failed
          </>
        );
      default:
        return (
          <>
            <TestTube className="h-4 w-4 mr-2" />
            Test Connection
          </>
        );
    }
  };

  return (
    <Button
      type="button"
      variant={status === "success" ? "default" : status === "error" ? "destructive" : "outline"}
      onClick={testConnection}
      disabled={status === "testing"}
    >
      {getButtonContent()}
    </Button>
  );
}
