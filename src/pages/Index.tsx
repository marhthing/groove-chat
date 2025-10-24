import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageSquare, Zap, Lock, ArrowRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-muted-foreground text-sm">
            <Zap className="h-4 w-4" />
            Powered by AI
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Welcome to Groove AI
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Experience fast, intelligent conversations with Groove AI. 
            Get instant answers and helpful insights.
          </p>

          <div className="flex gap-4 justify-center pt-4">
            <Button size="lg" onClick={() => navigate("/auth")}>
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="text-center space-y-4 p-6">
            <div className="mx-auto w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">Lightning Fast</h3>
            <p className="text-muted-foreground">
              Get instant responses powered by advanced AI technology
            </p>
          </div>

          <div className="text-center space-y-4 p-6">
            <div className="mx-auto w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">Conversation History</h3>
            <p className="text-muted-foreground">
              Access all your previous conversations anytime
            </p>
          </div>

          <div className="text-center space-y-4 p-6">
            <div className="mx-auto w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">Secure & Private</h3>
            <p className="text-muted-foreground">
              Your conversations are encrypted and protected
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8 mt-20">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>© 2025 Groove AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
