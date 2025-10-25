
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, ImageIcon, Search, Brain, Globe, Calculator } from "lucide-react";
import { BRAND_NAME } from "@/lib/constants";

interface AIModel {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const Explore = () => {
  const navigate = useNavigate();

  const aiModels: AIModel[] = [
    {
      id: "chat",
      name: "Chat Assistant",
      description: "Your intelligent conversational AI for everyday tasks and questions",
      icon: <Sparkles className="h-6 w-6" />,
      color: "from-blue-500 to-cyan-500"
    },
    {
      id: "image-generator",
      name: "Image Generator",
      description: "Create stunning images from text descriptions",
      icon: <ImageIcon className="h-6 w-6" />,
      color: "from-purple-500 to-pink-500"
    },
    {
      id: "research-assistant",
      name: "Research Assistant",
      description: "Search the web and find current information with citations",
      icon: <Search className="h-6 w-6" />,
      color: "from-green-500 to-emerald-500"
    },
    {
      id: "problem-solver",
      name: "Problem Solver",
      description: "Advanced reasoning for complex problems with step-by-step solutions",
      icon: <Brain className="h-6 w-6" />,
      color: "from-orange-500 to-red-500"
    },
    {
      id: "website-analyzer",
      name: "Website Analyzer",
      description: "Visit and analyze any website URL with detailed insights",
      icon: <Globe className="h-6 w-6" />,
      color: "from-cyan-500 to-blue-500"
    },
    {
      id: "deep-research",
      name: "Deep Research",
      description: "Comprehensive multi-source research with parallel browsing",
      icon: <Search className="h-6 w-6" />,
      color: "from-indigo-500 to-purple-500"
    },
    {
      id: "math-solver",
      name: "Math Solver",
      description: "Solve mathematical and scientific problems with Wolfram Alpha",
      icon: <Calculator className="h-6 w-6" />,
      color: "from-pink-500 to-rose-500"
    }
  ];

  const handleSelectModel = (modelId: string) => {
    navigate(`/chat?model=${modelId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/chat")}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Chat
          </Button>
          <h1 className="text-4xl font-bold mb-2">Explore AI Models</h1>
          <p className="text-muted-foreground">
            Discover specialized AI assistants for different tasks
          </p>
        </div>

        {/* Models Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {aiModels.map((model) => (
            <button
              key={model.id}
              onClick={() => handleSelectModel(model.id)}
              className="group relative overflow-hidden rounded-xl border bg-card p-6 text-left transition-all hover:shadow-lg hover:border-primary"
            >
              {/* Icon */}
              <div className={`inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${model.color} text-white mb-4`}>
                {model.icon}
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                {model.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {model.description}
              </p>

              {/* Hover Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Explore;
