import { Activity, Users, MessageCircle, Smartphone, Phone } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageIntro } from '@/components/PageIntro';
import { useWorkshopNotification } from '@/hooks/useWorkshopNotification';
import { WhatsAppGroupTab, ComingSoonPlaceholder } from '@/components/operations/notification-channels';

export default function WorkshopNotification() {
  const { 
    workshops, 
    workshopsLoading, 
    orgTimezone,
    isRunningMessaging,
    subscribeToMessages,
    deleteWorkshop,
    isDeletingWorkshop,
  } = useWorkshopNotification();

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <PageIntro
        icon={Activity}
        tagline="Operations"
        description="Manage workshop notifications across multiple channels."
        variant="violet"
      />

      <Tabs defaultValue="whatsapp-group" className="space-y-4 sm:space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid h-auto gap-0.5 sm:gap-1">
          <TabsTrigger value="whatsapp-group" className="gap-1 sm:gap-2 py-2 sm:py-2.5 px-1.5 sm:px-3 flex-col sm:flex-row">
            <Users className="h-4 w-4" />
            <span className="text-[10px] sm:text-sm">Groups</span>
          </TabsTrigger>
          <TabsTrigger value="whatsapp-personal" className="gap-1 sm:gap-2 py-2 sm:py-2.5 px-1.5 sm:px-3 flex-col sm:flex-row">
            <MessageCircle className="h-4 w-4" />
            <span className="text-[10px] sm:text-sm">Personal</span>
          </TabsTrigger>
          <TabsTrigger value="sms" className="gap-1 sm:gap-2 py-2 sm:py-2.5 px-1.5 sm:px-3 flex-col sm:flex-row">
            <Smartphone className="h-4 w-4" />
            <span className="text-[10px] sm:text-sm">SMS</span>
          </TabsTrigger>
          <TabsTrigger value="ivr" className="gap-1 sm:gap-2 py-2 sm:py-2.5 px-1.5 sm:px-3 flex-col sm:flex-row">
            <Phone className="h-4 w-4" />
            <span className="text-[10px] sm:text-sm">IVR</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp-group">
          <WhatsAppGroupTab
            workshops={workshops}
            workshopsLoading={workshopsLoading}
            orgTimezone={orgTimezone}
            subscribeToMessages={subscribeToMessages}
            isRunningMessaging={isRunningMessaging}
            onDeleteWorkshop={deleteWorkshop}
            isDeletingWorkshop={isDeletingWorkshop}
          />
        </TabsContent>

        <TabsContent value="whatsapp-personal">
          <ComingSoonPlaceholder
            channel="WhatsApp Personal"
            provider="AiSensy"
            icon={MessageCircle}
            description="Send individual WhatsApp messages to each workshop registrant using AiSensy templates."
          />
        </TabsContent>

        <TabsContent value="sms">
          <ComingSoonPlaceholder
            channel="SMS"
            provider="Fast2SMS"
            icon={Smartphone}
            description="Send SMS notifications to workshop registrants. Ideal for users who may not have WhatsApp."
          />
        </TabsContent>

        <TabsContent value="ivr">
          <ComingSoonPlaceholder
            channel="IVR Call"
            provider="TBD"
            icon={Phone}
            description="Automated voice calls for high-priority reminders, such as 10 minutes before a workshop starts."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
