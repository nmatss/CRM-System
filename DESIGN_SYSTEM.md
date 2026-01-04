# ZippiCRM Design System

## Visão Geral
Sistema de design padronizado do ZippiCRM com foco em consistência visual, responsividade mobile-first e acessibilidade.

---

## 🎨 Cores

### Cor Primária
- **Purple**: `#7c3aed` (271 91% 55%)
- Uso: Botões principais, links, elementos interativos importantes
- Variantes:
  - `--color-purple-400`: Lighter
  - `--color-purple-500`: Base
  - `--color-purple-600`: Darker
  - `--color-purple-700`: Darkest

### Cores Secundárias
- **Cyan**: `hsl(187 94% 43%)` - Accent color
- **Blue**: `hsl(199 89% 48%)` - Complementary

### Cores de Status

#### Success (Verde)
```css
--color-success-50: hsl(142 76% 96%)
--color-success-500: hsl(142 76% 36%)
--color-success-700: hsl(142 76% 24%)
```

#### Warning (Amarelo)
```css
--color-warning-50: hsl(48 100% 96%)
--color-warning-500: hsl(45 93% 47%)
--color-warning-700: hsl(42 96% 35%)
```

#### Danger (Vermelho)
```css
--color-danger-50: hsl(0 86% 97%)
--color-danger-500: hsl(0 84% 60%)
--color-danger-700: hsl(0 74% 42%)
```

### Uso de Cores

```tsx
// Botão primário (roxo)
<Button>Ação Principal</Button>

// Botão secundário (cinza)
<Button variant="secondary">Ação Secundária</Button>

// Botão destrutivo (vermelho)
<Button variant="destructive">Excluir</Button>

// Badge de sucesso
<Badge className="bg-[hsl(var(--color-success-500))]">Ativo</Badge>
```

---

## 📏 Espaçamento

### Escala de Espaçamento
```css
--spacing-xs: 0.5rem    /* 8px */
--spacing-sm: 0.75rem   /* 12px */
--spacing-md: 1rem      /* 16px */
--spacing-lg: 1.5rem    /* 24px */
--spacing-xl: 2rem      /* 32px */
--spacing-2xl: 3rem     /* 48px */
--spacing-3xl: 4rem     /* 64px */
```

### Classes Utilitárias
```tsx
// Gap entre elementos
<div className="spacing-md">  // gap: 1rem
<div className="spacing-lg">  // gap: 1.5rem

// Padding responsivo
<div className="container-padding">  // px-3 sm:px-4 lg:px-6
```

---

## 📝 Tipografia

### Escala de Tamanhos
```css
--text-xs: 0.75rem      /* 12px */
--text-sm: 0.875rem     /* 14px */
--text-base: 1rem       /* 16px */
--text-lg: 1.125rem     /* 18px */
--text-xl: 1.25rem      /* 20px */
--text-2xl: 1.5rem      /* 24px */
--text-3xl: 1.875rem    /* 30px */
--text-4xl: 2.25rem     /* 36px */
```

### Fontes
- **Sans Serif**: Inter (corpo de texto)
- **Display**: Outfit (títulos)

### Classes Responsivas
```tsx
// Título responsivo
<h1 className="text-responsive-xl">Título Grande</h1>
// Mobile: text-xl, Tablet: text-2xl, Desktop: text-3xl

<h2 className="text-responsive-lg">Título Médio</h2>
// Mobile: text-lg, Tablet: text-xl, Desktop: text-2xl

<p className="text-responsive-base">Texto</p>
// Mobile: text-sm, Tablet: text-base
```

---

## 📱 Breakpoints

### Tailwind Breakpoints
```css
sm: 640px   /* Tablets */
md: 768px   /* Tablets grandes */
lg: 1024px  /* Desktops */
xl: 1280px  /* Desktops grandes */
2xl: 1536px /* Telas muito grandes */
```

### Uso Mobile-First
```tsx
// Sempre comece com mobile, depois adicione breakpoints maiores
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
  {/* Cards */}
</div>

// Padding responsivo
<div className="p-3 sm:p-4 lg:p-6">
  {/* Conteúdo */}
</div>

// Texto responsivo
<h1 className="text-xl sm:text-2xl lg:text-3xl">Título</h1>
```

---

## 🎯 Componentes

### Botões

#### Variantes
```tsx
// Primary (roxo - padrão)
<Button>Ação Principal</Button>

// Secondary (cinza)
<Button variant="secondary">Secundária</Button>

// Outline
<Button variant="outline">Contornado</Button>

// Ghost
<Button variant="ghost">Transparente</Button>

// Destructive
<Button variant="destructive">Excluir</Button>
```

#### Tamanhos
```tsx
<Button size="sm">Pequeno</Button>
<Button size="default">Padrão</Button>
<Button size="lg">Grande</Button>
<Button size="icon">Ícone</Button>
```

### Cards

```tsx
// Card padrão
<Card>
  <CardHeader>
    <CardTitle>Título</CardTitle>
    <CardDescription>Descrição</CardDescription>
  </CardHeader>
  <CardContent>
    Conteúdo
  </CardContent>
</Card>

// Card com elevação
<div className="card-elevated">
  {/* Conteúdo */}
</div>
```

### Grids Responsivos

```tsx
// Grid de cards (1-2-3-4 colunas)
<div className="grid-responsive-cards">
  <Card>Card 1</Card>
  <Card>Card 2</Card>
  <Card>Card 3</Card>
  <Card>Card 4</Card>
</div>

// Grid de 2 colunas
<div className="grid-responsive-2col">
  <div>Coluna 1</div>
  <div>Coluna 2</div>
</div>
```

### Tabelas Responsivas

```tsx
// Wrapper para scroll horizontal em mobile
<div className="table-responsive">
  <Table>
    {/* Conteúdo da tabela */}
  </Table>
</div>
```

---

## 🤖 AI Chat Drawer (AITOPIA)

### Uso
O chat de IA está disponível em todas as páginas através de um botão flutuante no canto inferior direito.

```tsx
// O componente já está integrado no Layout
// Não precisa adicionar manualmente em cada página

// Hook para controlar o drawer programaticamente
import { useAIDrawer } from '@/hooks/use-ai-drawer';

function MyComponent() {
  const aiDrawer = useAIDrawer();

  return (
    <Button onClick={aiDrawer.open}>
      Abrir Assistente IA
    </Button>
  );
}
```

### Características
- Estado persistido em localStorage
- Painel lateral direito colapsável
- Botão flutuante quando fechado
- Responsivo: full width em mobile, 400-450px em desktop
- Overlay escuro em mobile

---

## 🎨 Tema Escuro

O sistema suporta tema claro e escuro automaticamente. Todas as cores usam variáveis CSS que se adaptam ao tema:

```tsx
// Sempre use variáveis de tema ao invés de cores fixas
className="bg-background text-foreground"
className="bg-card text-card-foreground"
className="bg-primary text-primary-foreground"

// Evite:
className="bg-white text-black"  // ❌ Não se adapta ao tema escuro
```

---

## ✅ Checklist de Responsividade

Ao criar novos componentes, verifique:

- [ ] Funciona em 375px (mobile pequeno)
- [ ] Funciona em 768px (tablet)
- [ ] Funciona em 1280px (desktop)
- [ ] Texto é legível em todos os tamanhos
- [ ] Botões têm tamanho mínimo de toque (44x44px)
- [ ] Imagens têm width/height ou aspect-ratio
- [ ] Tabelas têm scroll horizontal em mobile
- [ ] Formulários empilham em mobile
- [ ] Modais/drawers ocupam full width em mobile

---

## 📦 Classes Utilitárias Personalizadas

### Grid Responsivo
- `grid-responsive-cards`: Grid 1-2-3-4 colunas
- `grid-responsive-2col`: Grid 1-2 colunas

### Espaçamento
- `spacing-xs`, `spacing-sm`, `spacing-md`, `spacing-lg`, `spacing-xl`

### Texto
- `text-responsive-xl`, `text-responsive-lg`, `text-responsive-base`

### Container
- `container-padding`: Padding lateral responsivo

### Outros
- `card-elevated`: Card com sombra e hover
- `table-responsive`: Wrapper para tabelas
- `scrollbar-hide`: Esconde scrollbar mantendo funcionalidade

---

## 🚀 Exemplos Práticos

### Página com Grid de Cards
```tsx
import { Layout } from "@/components/layout/Layout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function MyPage() {
  return (
    <Layout>
      <PageHeader
        title="Minha Página"
        description="Descrição da página"
      >
        <Button>Nova Ação</Button>
      </PageHeader>

      <div className="grid-responsive-cards">
        <Card>
          <CardHeader>
            <CardTitle>Card 1</CardTitle>
          </CardHeader>
          <CardContent>
            Conteúdo do card
          </CardContent>
        </Card>
        {/* Mais cards... */}
      </div>
    </Layout>
  );
}
```

### Formulário Responsivo
```tsx
<form className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <div className="space-y-2">
    <Label>Nome</Label>
    <Input placeholder="Digite o nome" />
  </div>
  <div className="space-y-2">
    <Label>Email</Label>
    <Input type="email" placeholder="Digite o email" />
  </div>
  <div className="md:col-span-2 flex justify-end gap-2">
    <Button variant="outline">Cancelar</Button>
    <Button>Salvar</Button>
  </div>
</form>
```

### Tabela Responsiva
```tsx
<div className="table-responsive">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Nome</TableHead>
        <TableHead className="hidden sm:table-cell">Email</TableHead>
        <TableHead className="hidden md:table-cell">Telefone</TableHead>
        <TableHead>Ações</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {/* Linhas da tabela */}
    </TableBody>
  </Table>
</div>
```

---

## 📚 Referências

- **Tailwind CSS**: https://tailwindcss.com/docs
- **Radix UI**: https://www.radix-ui.com/
- **Lucide Icons**: https://lucide.dev/

---

**Última atualização**: 2025-12-17
**Versão**: 1.0.0
