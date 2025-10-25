import { BarChart, PieChart, LineChart, ScatterChart, Activity, Box, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useState } from "react";

export type ChartType = "scatter" | "line" | "bar" | "pie" | "box" | "histogram";

interface ChartTypeSelectorProps {
  selectedType: ChartType;
  onSelectType: (type: ChartType) => void;
}

export const ChartTypeSelector = ({ selectedType, onSelectType }: ChartTypeSelectorProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const chartTypes: Array<{ id: ChartType; name: string; icon: JSX.Element }> = [
    { id: "scatter", name: "Scatter", icon: <ScatterChart className="h-4 w-4" /> },
    { id: "line", name: "Line", icon: <LineChart className="h-4 w-4" /> },
    { id: "bar", name: "Bar", icon: <BarChart className="h-4 w-4" /> },
    { id: "pie", name: "Pie", icon: <PieChart className="h-4 w-4" /> },
    { id: "box", name: "Box", icon: <Box className="h-4 w-4" /> },
    { id: "histogram", name: "Histogram", icon: <Activity className="h-4 w-4" /> },
  ];

  return (
    <div className="border border-border rounded-lg p-3 mb-3 bg-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium">Select Chart Type</span>
          {selectedType && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {chartTypes.find(t => t.id === selectedType)?.name}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </div>
      {isExpanded && (
        <div className="grid grid-cols-3 gap-2">
          {chartTypes.map((type) => (
            <Button
              key={type.id}
              type="button"
              variant={selectedType === type.id ? "default" : "outline"}
              size="sm"
              onClick={() => onSelectType(type.id)}
              className="flex items-center gap-2 justify-start"
            >
              {type.icon}
              <span className="text-xs">{type.name}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};