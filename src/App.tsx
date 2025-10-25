import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Chat from "./pages/Chat";
import Onboarding from "./pages/Onboarding";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import SharedChat from "./pages/SharedChat";
import Explore from "./pages/Explore";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/chat/:conversationId" element={<Chat />} />
            <Route path="/image-generation" element={<Chat />} />
            <Route path="/image-generation/:conversationId" element={<Chat />} />
            <Route path="/chart-generation" element={<Chat />} />
            <Route path="/chart-generation/:conversationId" element={<Chat />} />
            <Route path="/research" element={<Chat />} />
            <Route path="/research/:conversationId" element={<Chat />} />
            <Route path="/problem-solver" element={<Chat />} />
            <Route path="/problem-solver/:conversationId" element={<Chat />} />
            <Route path="/website-analyzer" element={<Chat />} />
            <Route path="/website-analyzer/:conversationId" element={<Chat />} />
            <Route path="/deep-research" element={<Chat />} />
            <Route path="/deep-research/:conversationId" element={<Chat />} />
            <Route path="/math-solver" element={<Chat />} />
            <Route path="/math-solver/:conversationId" element={<Chat />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/share/:shareableId" element={<SharedChat />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;