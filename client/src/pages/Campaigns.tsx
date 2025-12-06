import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MessageSquare, 
  Mail, 
  Smartphone, 
  Users, 
  Send,
  Calendar,
  BarChart3,
  MoreHorizontal
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const campaigns = [
  {
    id: 1,
    name: "Summer Sale Early Access",
    channel: "WhatsApp",
    audience: "VIP Clients",
    sent: 1200,
    openRate: "92%",
    conversion: "15%",
    revenue: "R$ 45.000",
    status: "Completed",
    date: "2 days ago"
  },
  {
    id: 2,
    name: "Cashback Expiry Reminder",
    channel: "SMS",
    audience: "Expiring < 7 days",
    sent: 850,
    openRate: "98%",
    conversion: "8%",
    revenue: "R$ 12.400",
    status: "Active",
    date: "Running"
  },
  {
    id: 3,
    name: "New Collection Drop",
    channel: "Email",
    audience: "All Active",
    sent: 5000,
    openRate: "24%",
    conversion: "2%",
    revenue: "R$ 18.000",
    status: "Scheduled",
    date: "Tomorrow, 09:00"
  }
];

export default function Campaigns() {
  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Campaigns & Communication</h1>
            <p className="text-muted-foreground">Orchestrate omnichannel messages like Dito & Otto.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Calendar className="h-4 w-4" />
              Calendar
            </Button>
            <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700">
              <Send className="h-4 w-4" />
              Create Campaign
            </Button>
          </div>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">All Campaigns</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
            <TabsTrigger value="sms">SMS</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="mt-6">
            <div className="grid gap-6">
              {campaigns.map((campaign) => (
                <Card key={campaign.id} className="overflow-hidden">
                  <div className="flex flex-col md:flex-row">
                    <div className="flex-1 p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className={`
                            p-3 rounded-lg 
                            ${campaign.channel === 'WhatsApp' ? 'bg-green-100 text-green-600' : 
                              campaign.channel === 'SMS' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}
                          `}>
                            {campaign.channel === 'WhatsApp' ? <MessageSquare className="h-6 w-6" /> : 
                             campaign.channel === 'SMS' ? <Smartphone className="h-6 w-6" /> : <Mail className="h-6 w-6" />}
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">{campaign.name}</h3>
                            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                              <Badge variant="outline" className="font-normal">
                                {campaign.audience}
                              </Badge>
                              <span>•</span>
                              <span>{campaign.date}</span>
                            </div>
                          </div>
                        </div>
                        <Badge variant={campaign.status === "Active" ? "default" : campaign.status === "Completed" ? "secondary" : "outline"}>
                          {campaign.status}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="bg-muted/30 p-6 flex items-center gap-8 border-t md:border-t-0 md:border-l min-w-[350px]">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Sent</p>
                        <p className="text-xl font-bold">{campaign.sent}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Open Rate</p>
                        <p className="text-xl font-bold">{campaign.openRate}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Revenue</p>
                        <p className="text-xl font-bold text-emerald-600">{campaign.revenue}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
