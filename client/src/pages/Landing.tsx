import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  Store,
  Users,
  TrendingUp,
  Zap,
  MessageSquare,
  Gift,
  BarChart3,
  Shield,
  Check,
  ArrowRight,
  Sparkles,
  Building2,
  RefreshCw,
  Database,
  Link2,
  ChevronRight,
  Star,
  Phone,
  Mail,
  Calendar,
  Target,
  Rocket,
  Award,
  Globe,
  Clock,
  HeartHandshake,
  Loader2,
  Send
} from "lucide-react";
import zippiLogo from "@assets/generated_images/zippi_crm_modern_logo.png";

const integrations = [
  {
    name: "Microvix",
    logo: "M",
    color: "from-cyan-500 to-blue-600",
    description: "Integração completa com ERP Microvix para sincronização de vendas, estoque e clientes em tempo real.",
    features: ["Sincronização de vendas", "Gestão de estoque", "Cadastro de clientes", "Pedidos automáticos"]
  },
  {
    name: "Zippi CRM",
    logo: "Z",
    color: "from-emerald-500 to-teal-600",
    description: "Integração completa com Zippi CRM para gestão de relacionamento e vendas.",
    features: ["Gestão de leads", "Pipeline de vendas", "Automação de marketing", "Relatórios avançados"]
  },
  {
    name: "LinxPOS",
    logo: "L",
    color: "from-orange-500 to-amber-600",
    description: "Integração nativa com LinxPOS para operações de PDV e gestão de loja física.",
    features: ["PDV integrado", "Vendas em tempo real", "Gestão de caixa", "Multi-lojas"]
  }
];

const features = [
  {
    icon: Users,
    title: "Visão 360° do Cliente",
    description: "Histórico completo, preferências, comportamento de compra e segmentação inteligente.",
    color: "from-cyan-500 to-blue-500"
  },
  {
    icon: Gift,
    title: "Cashback & Fidelidade",
    description: "Programa de pontos e cashback configurável para aumentar retenção e ticket médio.",
    color: "from-pink-500 to-rose-500"
  },
  {
    icon: MessageSquare,
    title: "Campanhas Multicanal",
    description: "WhatsApp, SMS e Email integrados para comunicação personalizada com clientes.",
    color: "from-emerald-500 to-teal-500"
  },
  {
    icon: Zap,
    title: "Automações Inteligentes",
    description: "Regras automáticas para aniversários, pós-venda, reativação e muito mais.",
    color: "from-amber-500 to-orange-500"
  },
  {
    icon: Calendar,
    title: "Agenda do Vendedor",
    description: "Tarefas diárias, follow-ups e clienteling para vendedores mais produtivos.",
    color: "from-violet-500 to-purple-500"
  },
  {
    icon: BarChart3,
    title: "Relatórios Avançados",
    description: "Dashboards em tempo real com métricas de vendas, performance e ROI de campanhas.",
    color: "from-blue-500 to-indigo-500"
  }
];

const plans = [
  {
    name: "Starter",
    price: "297",
    description: "Para lojas iniciando no CRM",
    features: [
      "Até 1.000 clientes",
      "1 usuário",
      "Campanhas por email",
      "Relatórios básicos",
      "Suporte por email"
    ],
    highlighted: false
  },
  {
    name: "Professional",
    price: "597",
    description: "Para lojas em crescimento",
    features: [
      "Até 10.000 clientes",
      "5 usuários",
      "WhatsApp + Email + SMS",
      "Automações ilimitadas",
      "Integrações ERP",
      "Suporte prioritário"
    ],
    highlighted: true
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    description: "Para redes e franquias",
    features: [
      "Clientes ilimitados",
      "Usuários ilimitados",
      "Multi-lojas",
      "API personalizada",
      "Gerente de sucesso dedicado",
      "SLA garantido"
    ],
    highlighted: false
  }
];

const testimonials = [
  {
    name: "Maria Santos",
    role: "Proprietária",
    company: "Boutique Elegance",
    text: "O Moda CRM transformou nossa loja. Aumentamos o ticket médio em 35% com as campanhas de cashback!",
    rating: 5,
    metric: "+35%",
    metricLabel: "Ticket Médio"
  },
  {
    name: "Roberto Lima",
    role: "Gerente",
    company: "Fashion Store",
    text: "A integração com Microvix foi perfeita. Agora temos visão completa do cliente em um só lugar.",
    rating: 5,
    metric: "2x",
    metricLabel: "Produtividade"
  },
  {
    name: "Ana Paula",
    role: "Diretora",
    company: "Rede ModaPlus",
    text: "Com a Agenda do Vendedor, nossos consultores ficaram muito mais produtivos e engajados.",
    rating: 5,
    metric: "+50%",
    metricLabel: "Engajamento"
  }
];


export default function Landing() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [demoForm, setDemoForm] = useState({ name: "", email: "", phone: "", company: "", storeCount: "", preferredDate: "", message: "" });

  const contactMutation = useMutation({
    mutationFn: async (data: typeof contactForm) => {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Erro ao enviar mensagem");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Mensagem enviada!", description: "Entraremos em contato em breve." });
      setIsContactOpen(false);
      setContactForm({ name: "", email: "", phone: "", message: "" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível enviar sua mensagem.", variant: "destructive" });
    },
  });

  const demoMutation = useMutation({
    mutationFn: async (data: typeof demoForm) => {
      const response = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Erro ao agendar demo");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Demo agendada!", description: "Nossa equipe entrará em contato para confirmar." });
      setIsDemoOpen(false);
      setDemoForm({ name: "", email: "", phone: "", company: "", storeCount: "", preferredDate: "", message: "" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Não foi possível agendar sua demo.", variant: "destructive" });
    },
  });

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    contactMutation.mutate(contactForm);
  };

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    demoMutation.mutate(demoForm);
  };

  return (
    <div className="min-h-screen bg-[#050A1A] text-white">
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#050A1A]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <img 
                src={zippiLogo} 
                alt="Zippi CRM" 
                className="h-10 w-auto object-contain bg-[#050A1A] rounded"
                data-testid="header-logo"
              />
            </div>
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">Recursos</a>
              <a href="#integrations" className="text-sm text-gray-400 hover:text-white transition-colors">Integrações</a>
              <a href="#pricing" className="text-sm text-gray-400 hover:text-white transition-colors">Planos</a>
              <a href="#testimonials" className="text-sm text-gray-400 hover:text-white transition-colors">Cases</a>
            </nav>
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost"
                className="text-gray-300 hover:text-white hover:bg-white/10"
                data-testid="button-header-contact"
                onClick={() => setIsContactOpen(true)}
              >
                <Phone className="w-4 h-4 mr-2" />
                Contato
              </Button>
              <Button 
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 shadow-lg shadow-cyan-500/25"
                data-testid="button-header-demo"
                onClick={() => setIsDemoOpen(true)}
              >
                Agendar Demo
              </Button>
            </div>
          </div>
        </div>
      </header>

      <section className="pt-32 pb-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl" />
        
        <div className="max-w-7xl mx-auto relative">
          <motion.div 
            className="text-center max-w-4xl mx-auto"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge className="mb-6 bg-cyan-500/10 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/20" data-testid="badge-hero">
              <Sparkles className="w-3 h-3 mr-1" />
              Plataforma #1 para Varejo
            </Badge>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              Transforme dados em{" "}
              <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                vendas recorrentes
              </span>
            </h1>
            <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              CRM completo para varejo de moda com integração nativa aos principais ERPs. 
              Aumente vendas, fidelize clientes e potencialize sua equipe com inteligência de dados.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-lg px-8 shadow-xl shadow-cyan-500/25"
                data-testid="button-hero-demo"
                onClick={() => setIsDemoOpen(true)}
              >
                <Rocket className="w-5 h-5 mr-2" />
                Começar Agora
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg px-8 border-gray-700 text-gray-300 hover:bg-white/5 hover:border-gray-600"
                data-testid="button-hero-contact"
                onClick={() => setIsContactOpen(true)}
              >
                <Phone className="w-5 h-5 mr-2" />
                Falar com Especialista
              </Button>
            </div>
          </motion.div>

          <motion.div 
            className="mt-20 relative"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <div className="relative mx-auto max-w-5xl">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 rounded-3xl blur-3xl" />
              <div className="relative bg-[#0F172A]/80 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                <div className="bg-[#1F2937]/50 px-4 py-3 flex items-center gap-2 border-b border-white/5">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                  </div>
                  <div className="flex-1 text-center">
                    <span className="text-xs text-gray-500">app.zippicrm.com.br</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    {[
                      { label: "Vendas Hoje", value: "R$ 12.450", trend: "+18%", color: "cyan" },
                      { label: "Clientes Ativos", value: "2.847", trend: "+5%", color: "emerald" },
                      { label: "Ticket Médio", value: "R$ 389", trend: "+12%", color: "amber" },
                      { label: "Conversão", value: "34%", trend: "+8%", color: "pink" }
                    ].map((stat, i) => (
                      <div key={i} className="bg-[#1F2937]/50 rounded-xl p-4 border border-white/5">
                        <p className="text-xs text-gray-500">{stat.label}</p>
                        <p className="text-xl font-bold mt-1 text-white">{stat.value}</p>
                        <p className={`text-xs mt-1 text-${stat.color}-400`}>↑ {stat.trend}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 bg-[#1F2937]/50 rounded-xl p-4 border border-white/5 h-48">
                      <p className="text-sm font-medium mb-2 text-gray-300">Performance Semanal</p>
                      <div className="flex items-end justify-between h-32 px-2">
                        {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                          <div 
                            key={i} 
                            className="w-8 bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t-md opacity-80 hover:opacity-100 transition-opacity"
                            style={{ height: `${h}%` }}
                          ></div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-[#1F2937]/50 rounded-xl p-4 border border-white/5">
                      <p className="text-sm font-medium mb-3 text-gray-300">Top Clientes</p>
                      {["Ana M.", "João S.", "Maria L."].map((name, i) => (
                        <div key={i} className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600"></div>
                          <span className="text-xs text-gray-400">{name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>


      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <Badge className="mb-4 bg-blue-500/10 text-blue-400 border-blue-500/20">
              <Zap className="w-3 h-3 mr-1" />
              Recursos Poderosos
            </Badge>
            <h2 className="text-4xl font-bold mb-4">
              Tudo que você precisa para{" "}
              <span className="text-cyan-400">crescer</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Ferramentas completas para conhecer, engajar e fidelizar seus clientes
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full bg-[#0F172A]/50 border-white/5 hover:border-white/10 transition-all hover:bg-[#0F172A]/80 group" data-testid={`card-feature-${index}`}>
                  <CardHeader>
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-white">{feature.title}</CardTitle>
                    <CardDescription className="text-gray-400 text-base">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="integrations" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#0F172A]/50">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <Badge className="mb-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              <Link2 className="w-3 h-3 mr-1" />
              Integrações Nativas
            </Badge>
            <h2 className="text-4xl font-bold mb-4">
              Conectado aos principais{" "}
              <span className="text-emerald-400">ERPs do Brasil</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Integração plug-and-play com os sistemas que você já usa
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {integrations.map((integration, index) => (
              <motion.div
                key={integration.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full bg-[#0F172A]/80 border-white/5 hover:border-white/10 transition-all" data-testid={`card-integration-${integration.name.toLowerCase().replace(' ', '-')}`}>
                  <CardHeader>
                    <div className="flex items-center gap-4 mb-2">
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${integration.color} flex items-center justify-center text-white text-2xl font-bold shadow-lg`}>
                        {integration.logo}
                      </div>
                      <div>
                        <CardTitle className="text-xl text-white">{integration.name}</CardTitle>
                        <Badge variant="secondary" className="mt-1 bg-white/5 text-gray-400 border-white/10">Certificado</Badge>
                      </div>
                    </div>
                    <CardDescription className="text-gray-400 text-base">
                      {integration.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {integration.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                          <Check className="w-4 h-4 text-emerald-400" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-gray-500 mb-4">E muitas outras integrações disponíveis</p>
            <div className="flex justify-center gap-8 opacity-40">
              <Database className="w-8 h-8 text-gray-500" />
              <RefreshCw className="w-8 h-8 text-gray-500" />
              <Building2 className="w-8 h-8 text-gray-500" />
              <Globe className="w-8 h-8 text-gray-500" />
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <Badge className="mb-4 bg-amber-500/10 text-amber-400 border-amber-500/20">
              <TrendingUp className="w-3 h-3 mr-1" />
              Planos Flexíveis
            </Badge>
            <h2 className="text-4xl font-bold mb-4">
              Escolha o plano ideal para{" "}
              <span className="text-amber-400">sua loja</span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Comece agora e escale conforme seu negócio cresce
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card 
                  className={`h-full relative bg-[#0F172A]/80 border-white/5 ${plan.highlighted ? 'border-cyan-500/50 shadow-xl shadow-cyan-500/10 scale-105' : ''}`}
                  data-testid={`card-plan-${plan.name.toLowerCase()}`}
                >
                  {plan.highlighted && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-0">
                        <Star className="w-3 h-3 mr-1" />
                        Mais Popular
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-xl text-white">{plan.name}</CardTitle>
                    <CardDescription className="text-gray-400">{plan.description}</CardDescription>
                    <div className="mt-4">
                      {plan.price === "Sob consulta" ? (
                        <span className="text-3xl font-bold text-white">{plan.price}</span>
                      ) : (
                        <>
                          <span className="text-sm text-gray-500">R$</span>
                          <span className="text-5xl font-bold text-white">{plan.price}</span>
                          <span className="text-gray-500">/mês</span>
                        </>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3 mb-6">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-gray-300">
                          <Check className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button 
                      className={`w-full ${plan.highlighted ? 'bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25' : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'}`}
                      variant={plan.highlighted ? "default" : "ghost"}
                    >
                      {plan.price === "Sob consulta" ? "Falar com Vendas" : "Começar Agora"}
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="testimonials" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#0F172A]/50">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="text-center mb-16"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <Badge className="mb-4 bg-pink-500/10 text-pink-400 border-pink-500/20">
              <Award className="w-3 h-3 mr-1" />
              Cases de Sucesso
            </Badge>
            <h2 className="text-4xl font-bold mb-4">
              Resultados que{" "}
              <span className="text-pink-400">falam por si</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full bg-[#0F172A]/80 border-white/5" data-testid={`card-testimonial-${index}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex gap-1">
                        {[...Array(testimonial.rating)].map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-cyan-400">{testimonial.metric}</div>
                        <div className="text-xs text-gray-500">{testimonial.metricLabel}</div>
                      </div>
                    </div>
                    <p className="text-gray-300 mb-6 italic">"{testimonial.text}"</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600"></div>
                      <div>
                        <p className="font-medium text-white">{testimonial.name}</p>
                        <p className="text-sm text-gray-500">{testimonial.role}, {testimonial.company}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/20 to-blue-600/20" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl" />
        
        <div className="max-w-4xl mx-auto text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              Pronto para transformar{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">sua loja?</span>
            </h2>
            <p className="text-xl text-gray-300 mb-10">
              Junte-se a mais de 500 lojas que já usam o Zippi CRM para crescer de forma inteligente
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-white text-gray-900 hover:bg-gray-100 text-lg px-8 shadow-xl"
                data-testid="button-cta-demo"
                onClick={() => setIsDemoOpen(true)}
              >
                <Rocket className="w-5 h-5 mr-2" />
                Agendar Demonstração Gratuita
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10 text-lg px-8"
                data-testid="button-cta-contact"
                onClick={() => setIsContactOpen(true)}
              >
                <HeartHandshake className="w-5 h-5 mr-2" />
                Falar com Consultor
              </Button>
            </div>
            <div className="flex items-center justify-center gap-8 mt-10 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                Demo personalizada
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                Suporte em português
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                Implantação assistida
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-white/5 bg-[#050A1A]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <img 
                src={zippiLogo} 
                alt="Zippi CRM" 
                className="h-8 w-auto object-contain bg-[#050A1A] rounded"
                data-testid="footer-logo"
              />
            </div>
            <div className="flex items-center gap-8 text-sm text-gray-500">
              <a href="#" className="hover:text-white transition-colors">Termos de Uso</a>
              <a href="#" className="hover:text-white transition-colors">Privacidade</a>
              <a href="#" className="hover:text-white transition-colors">Suporte</a>
            </div>
            <p className="text-sm text-gray-600">
              © 2024 Zippi CRM. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>

      <Dialog open={isContactOpen} onOpenChange={setIsContactOpen}>
        <DialogContent className="bg-[#0F172A] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Entre em Contato</DialogTitle>
            <DialogDescription className="text-gray-400">
              Preencha o formulário e nossa equipe entrará em contato.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleContactSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact-name">Nome *</Label>
              <Input
                id="contact-name"
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                placeholder="Seu nome"
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                data-testid="input-contact-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email">Email *</Label>
              <Input
                id="contact-email"
                type="email"
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                placeholder="seu@email.com"
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                data-testid="input-contact-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-phone">Telefone</Label>
              <Input
                id="contact-phone"
                value={contactForm.phone}
                onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                placeholder="(11) 99999-9999"
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                data-testid="input-contact-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-message">Mensagem *</Label>
              <Textarea
                id="contact-message"
                value={contactForm.message}
                onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                placeholder="Como podemos ajudar?"
                required
                rows={4}
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                data-testid="input-contact-message"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600"
              disabled={contactMutation.isPending}
              data-testid="button-submit-contact"
            >
              {contactMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
              ) : (
                <><Send className="w-4 h-4 mr-2" /> Enviar Mensagem</>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDemoOpen} onOpenChange={setIsDemoOpen}>
        <DialogContent className="bg-[#0F172A] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Agendar Demonstração</DialogTitle>
            <DialogDescription className="text-gray-400">
              Veja o Zippi CRM em ação. Agende uma demo personalizada.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDemoSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="demo-name">Nome *</Label>
                <Input
                  id="demo-name"
                  value={demoForm.name}
                  onChange={(e) => setDemoForm({ ...demoForm, name: e.target.value })}
                  placeholder="Seu nome"
                  required
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                  data-testid="input-demo-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="demo-phone">Telefone</Label>
                <Input
                  id="demo-phone"
                  value={demoForm.phone}
                  onChange={(e) => setDemoForm({ ...demoForm, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                  data-testid="input-demo-phone"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-email">Email *</Label>
              <Input
                id="demo-email"
                type="email"
                value={demoForm.email}
                onChange={(e) => setDemoForm({ ...demoForm, email: e.target.value })}
                placeholder="seu@email.com"
                required
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                data-testid="input-demo-email"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="demo-company">Empresa *</Label>
                <Input
                  id="demo-company"
                  value={demoForm.company}
                  onChange={(e) => setDemoForm({ ...demoForm, company: e.target.value })}
                  placeholder="Nome da loja"
                  required
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                  data-testid="input-demo-company"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="demo-stores">Nº de Lojas</Label>
                <Input
                  id="demo-stores"
                  value={demoForm.storeCount}
                  onChange={(e) => setDemoForm({ ...demoForm, storeCount: e.target.value })}
                  placeholder="Ex: 3"
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                  data-testid="input-demo-stores"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-date">Data Preferencial</Label>
              <Input
                id="demo-date"
                value={demoForm.preferredDate}
                onChange={(e) => setDemoForm({ ...demoForm, preferredDate: e.target.value })}
                placeholder="Ex: Próxima semana, manhã"
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                data-testid="input-demo-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-message">Observações</Label>
              <Textarea
                id="demo-message"
                value={demoForm.message}
                onChange={(e) => setDemoForm({ ...demoForm, message: e.target.value })}
                placeholder="Algo específico que gostaria de ver?"
                rows={2}
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                data-testid="input-demo-message"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600"
              disabled={demoMutation.isPending}
              data-testid="button-submit-demo"
            >
              {demoMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Agendando...</>
              ) : (
                <><Calendar className="w-4 h-4 mr-2" /> Agendar Demo</>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
