import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  Users,
  TrendingUp,
  Zap,
  MessageSquare,
  Gift,
  BarChart3,
  Check,
  Sparkles,
  Database,
  Link2,
  Phone,
  Calendar,
  Rocket,
  HeartHandshake,
  Loader2,
  Send,
  DollarSign,
  ShoppingBag,
  Tags,
  ArrowUpRight,
} from "lucide-react";
import zippiLogo from "@assets/generated_images/zippi_crm_modern_logo.png";

const features = [
  {
    icon: Users,
    title: "Visão 360° do Cliente",
    description:
      "Cadastro, histórico de pedidos e interações disponíveis em uma visão central do cliente.",
    color: "from-cyan-500 to-blue-500",
  },
  {
    icon: Gift,
    title: "Cashback & Fidelidade",
    description: "Regras e lançamentos de cashback com saldo e movimentações rastreáveis.",
    color: "from-pink-500 to-rose-500",
  },
  {
    icon: MessageSquare,
    title: "Rascunhos de Campanhas",
    description:
      "Configuração de campanhas e templates; o envio depende de provedor ainda não integrado.",
    color: "from-emerald-500 to-teal-500",
  },
  {
    icon: Zap,
    title: "Configuração de Automações",
    description: "Cadastro de regras de automação; o motor de execução ainda não está disponível.",
    color: "from-amber-500 to-orange-500",
  },
  {
    icon: Calendar,
    title: "Agenda do Vendedor",
    description: "Tarefas, interações e atalhos para acompanhar o trabalho do vendedor.",
    color: "from-violet-500 to-purple-500",
  },
  {
    icon: BarChart3,
    title: "Visão Operacional",
    description:
      "Consultas de clientes, produtos, pedidos e dados operacionais registrados no sistema.",
    color: "from-blue-500 to-indigo-500",
  },
];

export default function Landing() {
  const { toast } = useToast();
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const contactTriggerRef = useRef<HTMLElement | null>(null);
  const demoTriggerRef = useRef<HTMLElement | null>(null);
  const [contactForm, setContactForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [demoForm, setDemoForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    storeCount: "",
    preferredDate: "",
    message: "",
  });

  const openDialogFromCurrentFocus = (
    triggerRef: { current: HTMLElement | null },
    setOpen: (open: boolean) => void,
  ) => {
    triggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  };

  const restoreDialogTriggerFocus = (event: Event, triggerRef: { current: HTMLElement | null }) => {
    if (!triggerRef.current) return;
    event.preventDefault();
    triggerRef.current.focus();
    triggerRef.current = null;
  };

  const contactMutation = useMutation({
    mutationFn: async (data: typeof contactForm) => {
      const response = await fetch("/api/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Não foi possível enviar sua mensagem.");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Mensagem enviada!", description: "Entraremos em contato em breve." });
      setIsContactOpen(false);
      setContactForm({ name: "", email: "", phone: "", message: "" });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível enviar sua mensagem.",
        variant: "destructive",
      });
    },
  });

  const demoMutation = useMutation({
    mutationFn: async (data: typeof demoForm) => {
      const response = await fetch("/api/v1/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Não foi possível agendar a demo.");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Solicitação recebida!",
        description: "A demonstração depende de confirmação da equipe.",
      });
      setIsDemoOpen(false);
      setDemoForm({
        name: "",
        email: "",
        phone: "",
        company: "",
        storeCount: "",
        preferredDate: "",
        message: "",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível agendar sua demo.",
        variant: "destructive",
      });
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
              <a
                href="#features"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Recursos
              </a>
              <a
                href="#integrations"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Integrações
              </a>
              <a
                href="#pricing"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Planos
              </a>
              <a
                href="#contact"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Contato
              </a>
            </nav>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                className="text-gray-300 hover:text-white hover:bg-white/10"
                data-testid="button-header-contact"
                onClick={() => openDialogFromCurrentFocus(contactTriggerRef, setIsContactOpen)}
              >
                <Phone className="w-4 h-4 mr-2" />
                Contato
              </Button>
              <Button
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 shadow-lg shadow-cyan-500/25"
                data-testid="button-header-demo"
                onClick={() => openDialogFromCurrentFocus(demoTriggerRef, setIsDemoOpen)}
              >
                Solicitar Demo
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
            <Badge
              className="mb-6 bg-cyan-500/10 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/20"
              data-testid="badge-hero"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              CRM operacional para varejo
            </Badge>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              Organize dados e{" "}
              <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent">
                rotinas comerciais
              </span>
            </h1>
            <p className="mx-auto mb-10 w-full min-w-0 max-w-[42rem] text-xl leading-relaxed text-gray-400">
              Centralize clientes, produtos, pedidos, cashback e rotinas comerciais em um único
              ambiente. Integrações e recursos em evolução são confirmados durante a demonstração.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-lg px-8 shadow-xl shadow-cyan-500/25"
                data-testid="button-hero-demo"
                onClick={() => openDialogFromCurrentFocus(demoTriggerRef, setIsDemoOpen)}
              >
                <Rocket className="w-5 h-5 mr-2" />
                Solicitar demonstração
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8 border-gray-700 text-gray-300 hover:bg-white/5 hover:border-gray-600"
                data-testid="button-hero-contact"
                onClick={() => openDialogFromCurrentFocus(contactTriggerRef, setIsContactOpen)}
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
                    <span className="text-xs text-gray-500">Prévia ilustrativa do produto</span>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Exemplo de interface</h3>
                      <p className="text-xs text-gray-500">
                        Dados fictícios usados somente para demonstração visual
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <div className="px-3 py-1.5 rounded-md bg-[#1F2937]/80 border border-white/10 text-xs text-gray-400">
                        Baixar Relatório
                      </div>
                      <div className="px-3 py-1.5 rounded-md bg-cyan-600 text-xs text-white">
                        Novo Pedido
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3 mb-6">
                    {[
                      {
                        label: "Vendas Totais",
                        value: "R$ 145.231",
                        trend: "+20.1% vs mês anterior",
                        icon: DollarSign,
                      },
                      {
                        label: "Ticket Médio",
                        value: "R$ 450,00",
                        trend: "+12.5% vs mês anterior",
                        icon: Tags,
                      },
                      {
                        label: "Total de Pedidos",
                        value: "324",
                        trend: "+19% vs mês anterior",
                        icon: ShoppingBag,
                      },
                      {
                        label: "Novos Clientes VIP",
                        value: "+12",
                        trend: "+4 nesta semana",
                        icon: Users,
                      },
                    ].map((stat, i) => (
                      <div key={i} className="bg-[#1F2937]/50 rounded-xl p-4 border border-white/5">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
                          <stat.icon className="w-4 h-4 text-gray-500" />
                        </div>
                        <p className="text-xl font-bold text-white">{stat.value}</p>
                        <p className="text-xs mt-1 text-emerald-400 flex items-center gap-1">
                          <ArrowUpRight className="w-3 h-3" />
                          {stat.trend}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-4">
                    <div className="col-span-4 bg-[#1F2937]/50 rounded-xl p-4 border border-white/5">
                      <p className="text-sm font-medium mb-4 text-white">Receita Semanal</p>
                      <div className="flex items-end justify-between h-36 px-2 relative">
                        <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-[10px] text-gray-500 pr-2">
                          <span>R$12k</span>
                          <span>R$8k</span>
                          <span>R$4k</span>
                          <span>R$0</span>
                        </div>
                        <div className="flex items-end justify-between flex-1 ml-8 h-full pb-6">
                          {[
                            { day: "Seg", h: 34 },
                            { day: "Ter", h: 25 },
                            { day: "Qua", h: 46 },
                            { day: "Qui", h: 35 },
                            { day: "Sex", h: 70 },
                            { day: "Sab", h: 100 },
                            { day: "Dom", h: 76 },
                          ].map((bar, i) => (
                            <div key={i} className="flex flex-col items-center gap-1">
                              <div
                                className="w-6 bg-cyan-500 rounded-t-sm"
                                style={{ height: `${bar.h}%` }}
                              ></div>
                              <span className="text-[10px] text-gray-500">{bar.day}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="col-span-3 bg-[#1F2937]/50 rounded-xl p-4 border border-white/5">
                      <div className="mb-1">
                        <p className="text-sm font-medium text-white">Vendas Recentes</p>
                        <p className="text-[10px] text-gray-500">Exemplo ilustrativo</p>
                      </div>
                      <div className="space-y-3 mt-3">
                        {[
                          {
                            name: "Mariana Costa",
                            email: "mariana@email.com",
                            value: "R$ 1.250,00",
                            initials: "MC",
                          },
                          {
                            name: "João Pedro Silva",
                            email: "joao.silva@gmail.com",
                            value: "R$ 890,00",
                            initials: "JP",
                          },
                          {
                            name: "Ana Beatriz",
                            email: "ana.b@outlook.com",
                            value: "R$ 2.100,00",
                            initials: "AB",
                          },
                          {
                            name: "Carlos Eduardo",
                            email: "carlos.e@email.com",
                            value: "R$ 650,00",
                            initials: "CE",
                          },
                        ].map((sale, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-[10px] font-medium text-white">
                              {sale.initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-white truncate">{sale.name}</p>
                              <p className="text-[10px] text-gray-500 truncate">{sale.email}</p>
                            </div>
                            <span className="text-xs font-medium text-white">{sale.value}</span>
                          </div>
                        ))}
                      </div>
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
              Recursos disponíveis para a <span className="text-cyan-400">operação comercial</span>
            </h2>
            <p className="mx-auto w-full min-w-0 max-w-[42rem] text-xl text-gray-400">
              Conheça o escopo atual e as limitações de cada módulo antes da contratação.
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
                <Card
                  className="h-full bg-[#0F172A]/50 border-white/5 hover:border-white/10 transition-all hover:bg-[#0F172A]/80 group"
                  data-testid={`card-feature-${index}`}
                >
                  <CardHeader>
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}
                    >
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

      <section
        id="integrations"
        className="overflow-hidden py-24 px-4 sm:px-6 lg:px-8 bg-[#0F172A]/50"
      >
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <Badge className="mb-4 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              <Link2 className="w-3 h-3 mr-1" />
              Integrações
            </Badge>
            <h2 className="text-4xl font-bold mb-4">
              Conectores sob <span className="text-emerald-400">avaliação técnica</span>
            </h2>
            <p className="mx-auto w-full min-w-0 max-w-[42rem] text-xl text-gray-400">
              Não anunciamos integração nativa sem contrato e validação. Fale conosco para verificar
              a disponibilidade para o seu sistema.
            </p>
          </motion.div>
          <div className="mx-auto w-full min-w-0 max-w-[42rem] overflow-hidden rounded-2xl border border-white/10 bg-[#0F172A]/80 p-4 text-center sm:p-8">
            <Database className="mx-auto mb-4 h-10 w-10 text-emerald-400" />
            <p className="mb-6 text-gray-300">
              O escopo, a origem dos dados, a frequência de sincronização e os requisitos de
              segurança precisam ser analisados antes de qualquer compromisso de integração.
            </p>
            <Button
              variant="outline"
              className="h-auto w-full min-w-0 max-w-full whitespace-normal break-words sm:w-auto"
              onClick={() => openDialogFromCurrentFocus(contactTriggerRef, setIsContactOpen)}
            >
              Consultar compatibilidade
            </Button>
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
              Condições comerciais
            </Badge>
            <h2 className="text-4xl font-bold mb-4">
              Planos em <span className="text-amber-400">definição comercial</span>
            </h2>
            <p className="mx-auto w-full min-w-0 max-w-[42rem] text-xl text-gray-400">
              Preços, limites, SLA e serviços ainda dependem de aprovação comercial formal.
            </p>
          </motion.div>

          <Card className="mx-auto w-full min-w-0 max-w-[42rem] overflow-hidden bg-[#0F172A]/80 border-white/10">
            <CardContent className="grid min-w-0 grid-cols-1 gap-5 p-4 text-center sm:p-8">
              <p className="min-w-0 break-words text-gray-300">
                Solicite uma conversa para entender o estado atual do produto. Nenhum preço, limite
                de uso ou nível de serviço é oferecido nesta página.
              </p>
              <Button
                className="h-auto w-full min-w-0 max-w-full whitespace-normal break-words"
                onClick={() => openDialogFromCurrentFocus(contactTriggerRef, setIsContactOpen)}
              >
                Solicitar informações comerciais
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="contact" className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
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
              Quer conhecer o estado atual do{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                produto?
              </span>
            </h2>
            <p className="text-xl text-gray-300 mb-10">
              Solicite uma demonstração. A equipe apresentará apenas os módulos disponíveis e as
              limitações conhecidas.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-white text-gray-900 hover:bg-gray-100 text-lg px-8 shadow-xl"
                data-testid="button-cta-demo"
                onClick={() => openDialogFromCurrentFocus(demoTriggerRef, setIsDemoOpen)}
              >
                <Rocket className="w-5 h-5 mr-2" />
                Solicitar demonstração
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10 text-lg px-8"
                data-testid="button-cta-contact"
                onClick={() => openDialogFromCurrentFocus(contactTriggerRef, setIsContactOpen)}
              >
                <HeartHandshake className="w-5 h-5 mr-2" />
                Falar com Consultor
              </Button>
            </div>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 text-sm text-gray-400 md:flex-row md:gap-8">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                Escopo confirmado na conversa
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                Sem promessa de integração não validada
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                Condições comerciais sob aprovação
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
            <div className="flex flex-col items-center gap-2 text-sm text-gray-500 md:items-end">
              <p>
                Termos de uso e política de privacidade: conteúdo jurídico pendente de aprovação.
              </p>
              <button
                type="button"
                className="hover:text-white transition-colors underline underline-offset-4"
                onClick={() => openDialogFromCurrentFocus(contactTriggerRef, setIsContactOpen)}
              >
                Contatar suporte
              </button>
            </div>
            <p className="text-sm text-gray-600">
              © {new Date().getFullYear()} Zippi CRM. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>

      <Dialog open={isContactOpen} onOpenChange={setIsContactOpen}>
        <DialogContent
          className="bg-[#0F172A] border-white/10 text-white max-w-md"
          onCloseAutoFocus={(event) => restoreDialogTriggerFocus(event, contactTriggerRef)}
        >
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
                autoComplete="name"
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
                autoComplete="email"
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
                autoComplete="tel"
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
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" /> Enviar Mensagem
                </>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDemoOpen} onOpenChange={setIsDemoOpen}>
        <DialogContent
          className="bg-[#0F172A] border-white/10 text-white max-w-md"
          onCloseAutoFocus={(event) => restoreDialogTriggerFocus(event, demoTriggerRef)}
        >
          <DialogHeader>
            <DialogTitle className="text-xl">Solicitar Demonstração</DialogTitle>
            <DialogDescription className="text-gray-400">
              Envie sua preferência. A data somente será confirmada após contato da equipe.
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
                  autoComplete="name"
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
                  autoComplete="tel"
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
                autoComplete="email"
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
                  autoComplete="organization"
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
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4 mr-2" /> Solicitar Demo
                </>
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
