# Guia Visual Rápido - ZippiCRM Design System

> **Documento parcialmente histórico.** As referências ao drawer AITOPIA não fazem parte do produto atual; o recurso simulado foi removido em 2026-08-29. Confirme exemplos contra os componentes atuais.

> **5 minutos para dominar o novo design system**

---

## 🎨 Cores - Copie e Cole

### Botões

```tsx
// Primário (Roxo) - Use para ações principais
<Button>Salvar</Button>
<Button>Confirmar</Button>
<Button>Criar Novo</Button>

// Secundário (Cinza) - Use para ações menos importantes
<Button variant="secondary">Cancelar</Button>
<Button variant="secondary">Voltar</Button>

// Outline - Use para ações terciárias
<Button variant="outline">Filtrar</Button>
<Button variant="outline">Exportar</Button>

// Destrutivo (Vermelho) - Use APENAS para exclusões
<Button variant="destructive">Excluir</Button>
<Button variant="destructive">Remover</Button>
```

### Badges

```tsx
// Sucesso (Verde)
<Badge className="bg-[hsl(var(--color-success-500))] text-white">
  Ativo
</Badge>

// Aviso (Amarelo)
<Badge className="bg-[hsl(var(--color-warning-500))] text-white">
  Pendente
</Badge>

// Erro (Vermelho)
<Badge className="bg-[hsl(var(--color-danger-500))] text-white">
  Inativo
</Badge>

// Primário (Roxo)
<Badge className="bg-primary text-primary-foreground">
  VIP
</Badge>
```

---

## 📐 Layout - Templates Prontos

### Template 1: Dashboard Simples

```tsx
import { Layout } from "@/components/layout/Layout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  return (
    <Layout>
      <PageHeader title="Dashboard" description="Visão geral">
        <Button>Nova Ação</Button>
      </PageHeader>

      <div className="grid-responsive-cards">
        <Card>
          <CardHeader>
            <CardTitle>1.234</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>R$ 45K</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>89</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>4.8</CardTitle>
          </CardHeader>
        </Card>
      </div>
    </Layout>
  );
}
```

### Template 2: Lista com Tabela

```tsx
export default function Lista() {
  return (
    <Layout>
      <PageHeader title="Clientes">
        <Button>Novo Cliente</Button>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          <div className="table-responsive">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{/* Suas linhas aqui */}</TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </Layout>
  );
}
```

### Template 3: Formulário

```tsx
export default function Formulario() {
  return (
    <Layout>
      <PageHeader title="Novo Item" />

      <Card>
        <CardContent>
          <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Campo 1</Label>
              <Input placeholder="Digite..." />
            </div>
            <div className="space-y-2">
              <Label>Campo 2</Label>
              <Input placeholder="Digite..." />
            </div>
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button variant="outline">Cancelar</Button>
              <Button>Salvar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </Layout>
  );
}
```

---

## 📱 Responsividade - Regras de Ouro

### ✅ FAÇA

```tsx
// 1. Use classes responsivas do Tailwind
<div className="text-sm sm:text-base lg:text-lg">Texto</div>

// 2. Use nossas classes utilitárias
<div className="grid-responsive-cards">
  <Card>1</Card>
  <Card>2</Card>
  <Card>3</Card>
</div>

// 3. Esconda elementos em mobile quando necessário
<div className="hidden md:block">Visível apenas em desktop</div>
<div className="md:hidden">Visível apenas em mobile</div>

// 4. Use padding responsivo
<div className="p-3 sm:p-4 lg:p-6">Conteúdo</div>
```

### ❌ NÃO FAÇA

```tsx
// 1. NÃO use tamanhos fixos em pixels
<div className="w-[500px]">  // ❌ Ruim

// 2. NÃO use cores fixas
<div className="bg-purple-500">  // ❌ Ruim
<div className="bg-primary">     // ✅ Bom

// 3. NÃO esqueça de testar em mobile
// Sempre teste em 375px, 768px, 1280px
```

---

## 🎯 Espaçamento - Copie e Cole

```tsx
// Gap entre elementos
<div className="flex spacing-sm">      /* gap: 12px */
<div className="flex spacing-md">      /* gap: 16px */
<div className="flex spacing-lg">      /* gap: 24px */

// Padding do container
<div className="container-padding">    /* px-3 sm:px-4 lg:px-6 */

// Margins padrão
<div className="mb-4">  /* 16px */
<div className="mb-6">  /* 24px */
<div className="mb-8">  /* 32px */
```

---

## 🤖 Chat de IA - Como Usar

### Já está integrado!

```tsx
// O chat JÁ está disponível em TODAS as páginas
// Procure o botão roxo/cyan flutuante no canto inferior direito
```

### Para abrir programaticamente

```tsx
import { useAIDrawer } from "@/hooks/use-ai-drawer";

function MeuComponente() {
  const ai = useAIDrawer();

  return (
    <div>
      <Button onClick={ai.open}>Perguntar à IA</Button>
      <Button onClick={ai.close}>Fechar IA</Button>
      <Button onClick={ai.toggle}>Toggle IA</Button>
    </div>
  );
}
```

---

## 📊 Grids - Exemplos Visuais

### Grid de 4 colunas (responsivo)

```
Mobile (375px):    Tablet (768px):    Desktop (1280px):
┌─────────────┐    ┌──────┬──────┐    ┌───┬───┬───┬───┐
│   Card 1    │    │ C1   │ C2   │    │C1 │C2 │C3 │C4 │
├─────────────┤    ├──────┼──────┤    └───┴───┴───┴───┘
│   Card 2    │    │ C3   │ C4   │
├─────────────┤    └──────┴──────┘
│   Card 3    │
├─────────────┤
│   Card 4    │
└─────────────┘
```

```tsx
<div className="grid-responsive-cards">
  <Card>Card 1</Card>
  <Card>Card 2</Card>
  <Card>Card 3</Card>
  <Card>Card 4</Card>
</div>
```

### Grid de 2 colunas (responsivo)

```
Mobile (375px):    Desktop (1024px):
┌─────────────┐    ┌──────────┬──────────┐
│   Coluna 1  │    │ Coluna 1 │ Coluna 2 │
├─────────────┤    └──────────┴──────────┘
│   Coluna 2  │
└─────────────┘
```

```tsx
<div className="grid-responsive-2col">
  <div>Coluna 1</div>
  <div>Coluna 2</div>
</div>
```

---

## 🔍 Busca Rápida - Tabela de Referência

| Preciso de...            | Use isto                                  |
| ------------------------ | ----------------------------------------- |
| Botão roxo (primário)    | `<Button>Texto</Button>`                  |
| Botão cinza (secundário) | `<Button variant="secondary">`            |
| Botão vermelho (excluir) | `<Button variant="destructive">`          |
| Grid de cards            | `<div className="grid-responsive-cards">` |
| Grid 2 colunas           | `<div className="grid-responsive-2col">`  |
| Texto responsivo grande  | `className="text-responsive-xl"`          |
| Tabela em mobile         | `<div className="table-responsive">`      |
| Badge verde              | `bg-[hsl(var(--color-success-500))]`      |
| Badge amarelo            | `bg-[hsl(var(--color-warning-500))]`      |
| Badge vermelho           | `bg-[hsl(var(--color-danger-500))]`       |
| Abrir chat de IA         | `useAIDrawer().open()`                    |
| Padding responsivo       | `className="container-padding"`           |
| Gap entre elementos      | `className="spacing-md"`                  |

---

## ⚡ Atalhos do Teclado (Planejado)

```
Ctrl/Cmd + K       → Abrir busca
Ctrl/Cmd + I       → Abrir chat de IA
Ctrl/Cmd + B       → Toggle sidebar
Esc               → Fechar modais/drawers
```

---

## 🎨 Paleta Visual

```
Primário (Roxo)    ████ #7c3aed  hsl(271 91% 55%)
Sucesso (Verde)    ████ #16a34a  hsl(142 76% 36%)
Aviso (Amarelo)    ████ #eab308  hsl(45 93% 47%)
Perigo (Vermelho)  ████ #dc2626  hsl(0 84% 60%)
Secundário (Cyan)  ████ #06b6d4  hsl(187 94% 43%)
```

---

## 📱 Breakpoints Visuais

```
375px ─────→ Mobile
         sm:640px ─────→ Tablet pequeno
                  md:768px ─────→ Tablet
                           lg:1024px ─────→ Desktop
                                     xl:1280px ─────→ Desktop grande
```

---

## ✅ Checklist Rápido - Nova Página

- [ ] Usa `Layout` como wrapper
- [ ] Usa `PageHeader` no topo
- [ ] Usa `grid-responsive-cards` para cards
- [ ] Usa `table-responsive` para tabelas
- [ ] Usa `text-responsive-*` para títulos
- [ ] Botões usam variante correta
- [ ] Cores usam variáveis CSS (não fixas)
- [ ] Testado em mobile (375px)
- [ ] Testado em tablet (768px)
- [ ] Testado em desktop (1280px)

---

## 🆘 Problemas Comuns - Soluções Rápidas

### Problema: Cores não aparecem

**Solução**: Use variáveis CSS, não cores fixas

```tsx
// ❌ Errado
<div className="bg-purple-500">

// ✅ Certo
<div className="bg-primary">
```

### Problema: Layout quebra em mobile

**Solução**: Use classes responsivas

```tsx
// ❌ Errado
<div className="grid grid-cols-4">

// ✅ Certo
<div className="grid-responsive-cards">
```

### Problema: Texto muito pequeno em mobile

**Solução**: Use classes responsivas de texto

```tsx
// ❌ Errado
<h1 className="text-3xl">

// ✅ Certo
<h1 className="text-responsive-xl">
```

### Problema: Chat de IA não aparece

**Solução**: Certifique-se que está usando Layout

```tsx
// ✅ Certo
export default function Page() {
  return <Layout>{/* Seu conteúdo */}</Layout>;
}
```

---

## 🚀 Começe Agora - 3 Passos

### 1. Copie um Template

Escolha um dos templates acima (Dashboard, Lista ou Formulário)

### 2. Personalize

Adicione seu conteúdo usando as classes utilitárias

### 3. Teste

Verifique em 375px, 768px e 1280px

---

## 📚 Quer Mais?

- 📖 Documentação completa: [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)
- 💻 Mais exemplos: [EXEMPLO_PAGINA_RESPONSIVA.tsx](./EXEMPLO_PAGINA_RESPONSIVA.tsx)
- ⭐ Guia geral: [UI_LAYOUT_README.md](./UI_LAYOUT_README.md)

---

**Última atualização**: 2025-12-17
**Versão**: 1.0.0

_Este guia é atualizado constantemente. Favorita-o!_
