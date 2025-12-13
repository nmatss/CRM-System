import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MessageSquare, 
  Mail, 
  Smartphone, 
  Send,
  Calendar
} from "lucide-react";
import { useState, useEffect } from "react";
import type { Campaign } from "@shared/schema";

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCampaigns() {
      try {
        const response = await fetch("/api/campaigns");
        if (response.ok) {
          const data = await response.json();
          setCampaigns(data);
        }
      } catch (error) {
        console.error("Failed to fetch campaigns:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchCampaigns();
  }, []);

  const filterCampaigns = (channel?: string) => {
    if (!channel) return campaigns;
    return campaigns.filter(c => c.channel === channel);
  };

  const renderCampaignList = (filteredCampaigns: Campaign[]) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando campanhas...</p>
        </div>
      );
    }

    if (filteredCampaigns.length === 0) {
      return (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Nenhuma campanha encontrada.</p>
        </div>
      );
    }

    return (
      <div className="grid gap-6">
        {filteredCampaigns.map((campaign) => (
          <Card key={campaign.id} className="overflow-hidden" data-testid={`card-campaign-${campaign.id}`}>
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
                      <h3 className="font-semibold text-lg" data-testid={`text-name-${campaign.id}`}>{campaign.name}</h3>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <Badge variant="outline" className="font-normal" data-testid={`badge-audience-${campaign.id}`}>
                          {campaign.audience}
                        </Badge>
                        <span>•</span>
                        <span data-testid={`text-date-${campaign.id}`}>{campaign.date}</span>
                      </div>
                    </div>
                  </div>
                  <Badge 
                    variant={campaign.status === "Ativo" ? "default" : campaign.status === "Concluído" ? "secondary" : "outline"}
                    data-testid={`badge-status-${campaign.id}`}
                  >
                    {campaign.status}
                  </Badge>
                </div>
              </div>
              
              <div className="bg-muted/30 p-4 sm:p-6 grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-8 border-t md:border-t-0 md:border-l md:min-w-[350px]">
                <div className="space-y-1 text-center sm:text-left">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold">Enviados</p>
                  <p className="text-sm sm:text-xl font-bold" data-testid={`text-sent-${campaign.id}`}>{campaign.sent}</p>
                </div>
                <div className="space-y-1 text-center sm:text-left">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold">Abertura</p>
                  <p className="text-sm sm:text-xl font-bold" data-testid={`text-open-rate-${campaign.id}`}>{campaign.openRate}</p>
                </div>
                <div className="space-y-1 text-center sm:text-left">
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider font-semibold">Receita</p>
                  <p className="text-sm sm:text-xl font-bold text-emerald-600" data-testid={`text-revenue-${campaign.id}`}>{campaign.revenue}</p>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Campanhas e Comunicação</h1>
            <p className="text-sm text-muted-foreground">Orquestre mensagens omnichannel estilo Dito & Otto.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 text-xs sm:text-sm flex-1 sm:flex-none" data-testid="button-calendar">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Calendário</span>
            </Button>
            <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-xs sm:text-sm flex-1 sm:flex-none" data-testid="button-new-campaign">
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Criar Campanha</span>
              <span className="sm:hidden">Criar</span>
            </Button>
          </div>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full sm:w-auto flex overflow-x-auto">
            <TabsTrigger value="all" className="text-xs sm:text-sm flex-1 sm:flex-none" data-testid="tab-all">
              <span className="hidden sm:inline">Todas as Campanhas</span>
              <span className="sm:hidden">Todas</span>
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="text-xs sm:text-sm flex-1 sm:flex-none" data-testid="tab-whatsapp">WhatsApp</TabsTrigger>
            <TabsTrigger value="sms" className="text-xs sm:text-sm flex-1 sm:flex-none" data-testid="tab-sms">SMS</TabsTrigger>
            <TabsTrigger value="email" className="text-xs sm:text-sm flex-1 sm:flex-none" data-testid="tab-email">Email</TabsTrigger>
          </TabsList>
          
          <TabsContent value="all" className="mt-6">
            {renderCampaignList(filterCampaigns())}
          </TabsContent>
          <TabsContent value="whatsapp" className="mt-6">
            {renderCampaignList(filterCampaigns("WhatsApp"))}
          </TabsContent>
          <TabsContent value="sms" className="mt-6">
            {renderCampaignList(filterCampaigns("SMS"))}
          </TabsContent>
          <TabsContent value="email" className="mt-6">
            {renderCampaignList(filterCampaigns("Email"))}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
