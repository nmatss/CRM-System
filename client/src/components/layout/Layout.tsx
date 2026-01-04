import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { AIChatDrawer } from "@/components/ui/AIChatDrawer";
import { useAIDrawer } from "@/hooks/use-ai-drawer";
import { Button } from "@/components/ui/button";
import { Bot, Sparkles } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const aiDrawer = useAIDrawer();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>

      {/* AI Chat Drawer */}
      <AIChatDrawer isOpen={aiDrawer.isOpen} onClose={aiDrawer.close} />

      {/* Floating AI Button */}
      {!aiDrawer.isOpen && (
        <Button
          onClick={aiDrawer.open}
          size="icon"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 border-0 z-40"
          data-testid="button-open-ai-chat"
        >
          <div className="relative">
            <Bot className="h-6 w-6 text-white" />
            <Sparkles className="h-3 w-3 text-white absolute -top-1 -right-1 animate-pulse" />
          </div>
          <span className="sr-only">Abrir AITOPIA</span>
        </Button>
      )}
    </div>
  );
}
