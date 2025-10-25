import React, { useRef, useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  ScatterChart,
  Scatter,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChartSpec, ChartDataset } from '@/types/chart';
import { useToast } from '@/hooks/use-toast';

interface ChartRendererProps {
  spec: ChartSpec;
}

const CHART_COLORS = [
  '#8B5CF6',
  '#EC4899', 
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#EF4444',
  '#8B5CF6',
  '#F97316',
];

const mergeDatasets = (datasets: ChartDataset[]) => {
  const allXValues = new Set<string | number>();
  const xValueMap: { [key: string]: string | number } = {};
  
  datasets.forEach((dataset) => {
    dataset.data.forEach((point) => {
      const key = String(point.x);
      allXValues.add(point.x);
      xValueMap[key] = point.x;
    });
  });
  
  const merged: { [key: string]: any } = {};
  
  allXValues.forEach((xValue) => {
    const key = String(xValue);
    merged[key] = { x: xValueMap[key] };
    
    datasets.forEach((dataset) => {
      const dataPoint = dataset.data.find((p) => String(p.x) === key);
      merged[key][dataset.label] = dataPoint ? dataPoint.y : undefined;
    });
  });
  
  const mergedArray = Object.values(merged);
  
  mergedArray.sort((a, b) => {
    if (typeof a.x === 'number' && typeof b.x === 'number') {
      return a.x - b.x;
    }
    return String(a.x).localeCompare(String(b.x));
  });
  
  return mergedArray;
};

export const ChartRenderer: React.FC<ChartRendererProps> = ({ spec }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!spec || !spec.datasets || spec.datasets.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground bg-muted/30 rounded-lg">
        No chart data available
      </div>
    );
  }

  const { type, title, description, xAxis, yAxis, datasets } = spec;

  // Responsive dimensions
  const chartHeight = isMobile ? 280 : 400;
  const chartMargin = isMobile 
    ? { top: 10, right: 5, left: -15, bottom: 20 } 
    : { top: 5, right: 30, left: 20, bottom: 5 };
  const pieRadius = isMobile ? 70 : 120;
  const pieInnerRadius = isMobile ? 35 : 0;

  const downloadChart = async () => {
    if (!chartRef.current) return;

    try {
      const svgElement = chartRef.current.querySelector('svg');
      if (!svgElement) {
        toast({
          title: "Error",
          description: "Chart not found",
          variant: "destructive",
        });
        return;
      }

      // Clone the SVG to avoid modifying the original
      const clonedSvg = svgElement.cloneNode(true) as SVGElement;
      
      // Set white background
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('width', '100%');
      rect.setAttribute('height', '100%');
      rect.setAttribute('fill', 'white');
      clonedSvg.insertBefore(rect, clonedSvg.firstChild);

      // Get SVG dimensions
      const bbox = svgElement.getBoundingClientRect();
      clonedSvg.setAttribute('width', bbox.width.toString());
      clonedSvg.setAttribute('height', bbox.height.toString());

      // Convert SVG to string
      const svgData = new XMLSerializer().serializeToString(clonedSvg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });

      // Create canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        canvas.width = bbox.width * 2; // Higher resolution
        canvas.height = bbox.height * 2;
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        // Convert to PNG and download
        canvas.toBlob((blob) => {
          if (!blob) return;
          const downloadUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = `${title?.replace(/[^a-z0-9]/gi, '_') || 'chart'}.png`;
          link.click();
          URL.revokeObjectURL(downloadUrl);

          toast({
            title: "Success",
            description: "Chart downloaded successfully",
          });
        });
      };

      img.src = url;
    } catch (error) {
      console.error('Error downloading chart:', error);
      toast({
        title: "Error",
        description: "Failed to download chart",
        variant: "destructive",
      });
    }
  };

  const renderLineChart = () => {
    const mergedData = mergeDatasets(datasets);
    
    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <LineChart data={mergedData} margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="x" 
            label={!isMobile && xAxis?.label ? { value: xAxis.label, position: 'insideBottom', offset: -5 } : undefined}
            className="text-xs"
            angle={isMobile ? -45 : 0}
            textAnchor={isMobile ? 'end' : 'middle'}
            height={isMobile ? 60 : 30}
          />
          <YAxis 
            label={!isMobile && yAxis?.label ? { value: yAxis.label, angle: -90, position: 'insideLeft' } : undefined}
            className="text-xs"
            width={isMobile ? 40 : 60}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <Legend wrapperStyle={{ fontSize: isMobile ? '12px' : '14px' }} />
          {datasets.map((dataset, idx) => (
            <Line
              key={idx}
              type="monotone"
              dataKey={dataset.label}
              stroke={dataset.color || CHART_COLORS[idx % CHART_COLORS.length]}
              name={dataset.label}
              strokeWidth={isMobile ? 1.5 : 2}
              dot={{ fill: dataset.color || CHART_COLORS[idx % CHART_COLORS.length] }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const renderBarChart = () => {
    const mergedData = mergeDatasets(datasets);
    
    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={mergedData} margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="x"
            label={!isMobile && xAxis?.label ? { value: xAxis.label, position: 'insideBottom', offset: -5 } : undefined}
            className="text-xs"
            angle={isMobile ? -45 : 0}
            textAnchor={isMobile ? 'end' : 'middle'}
            height={isMobile ? 60 : 30}
            tick={{ fontSize: isMobile ? 10 : 12 }}
          />
          <YAxis 
            label={!isMobile && yAxis?.label ? { value: yAxis.label, angle: -90, position: 'insideLeft' } : undefined}
            className="text-xs"
            width={isMobile ? 45 : 60}
            tick={{ fontSize: isMobile ? 10 : 12 }}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <Legend 
            wrapperStyle={{ fontSize: isMobile ? '10px' : '14px' }}
            iconSize={isMobile ? 8 : 14}
          />
          {datasets.map((dataset, idx) => (
            <Bar
              key={idx}
              dataKey={dataset.label}
              fill={dataset.color || CHART_COLORS[idx % CHART_COLORS.length]}
              name={dataset.label}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const renderPieChart = () => {
    const pieData = datasets[0].data.map((point, idx) => ({
      name: point.x,
      value: point.y,
      fill: CHART_COLORS[idx % CHART_COLORS.length],
    }));

    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy={isMobile ? "40%" : "50%"}
            labelLine={!isMobile}
            label={isMobile ? false : (entry) => `${entry.name}: ${entry.value}`}
            outerRadius={pieRadius}
            innerRadius={pieInnerRadius}
            dataKey="value"
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
          />
          <Legend 
            wrapperStyle={{ fontSize: isMobile ? '10px' : '14px', paddingTop: isMobile ? '10px' : '0' }}
            iconSize={isMobile ? 8 : 14}
            layout={isMobile ? "horizontal" : "horizontal"}
            align="center"
            verticalAlign="bottom"
          />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  const renderScatterChart = () => (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <ScatterChart margin={chartMargin}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="x" 
          type="number"
          label={!isMobile && xAxis?.label ? { value: xAxis.label, position: 'insideBottom', offset: -5 } : undefined}
          className="text-xs"
          width={isMobile ? 40 : 60}
        />
        <YAxis 
          dataKey="y"
          label={!isMobile && yAxis?.label ? { value: yAxis.label, angle: -90, position: 'insideLeft' } : undefined}
          className="text-xs"
          width={isMobile ? 40 : 60}
        />
        <Tooltip 
          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
          cursor={{ strokeDasharray: '3 3' }}
        />
        <Legend wrapperStyle={{ fontSize: isMobile ? '12px' : '14px' }} />
        {datasets.map((dataset, idx) => (
          <Scatter
            key={idx}
            name={dataset.label}
            data={dataset.data}
            fill={dataset.color || CHART_COLORS[idx % CHART_COLORS.length]}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );

  const renderAreaChart = () => {
    const mergedData = mergeDatasets(datasets);
    
    return (
      <ResponsiveContainer width="100%" height={chartHeight}>
        <AreaChart data={mergedData} margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="x"
            label={!isMobile && xAxis?.label ? { value: xAxis.label, position: 'insideBottom', offset: -5 } : undefined}
            className="text-xs"
            angle={isMobile ? -45 : 0}
            textAnchor={isMobile ? 'end' : 'middle'}
            height={isMobile ? 60 : 30}
          />
          <YAxis 
            label={!isMobile && yAxis?.label ? { value: yAxis.label, angle: -90, position: 'insideLeft' } : undefined}
            className="text-xs"
            width={isMobile ? 40 : 60}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <Legend wrapperStyle={{ fontSize: isMobile ? '12px' : '14px' }} />
          {datasets.map((dataset, idx) => (
            <Area
              key={idx}
              type="monotone"
              dataKey={dataset.label}
              stroke={dataset.color || CHART_COLORS[idx % CHART_COLORS.length]}
              fill={dataset.color || CHART_COLORS[idx % CHART_COLORS.length]}
              fillOpacity={0.6}
              name={dataset.label}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  };

  const renderChart = () => {
    switch (type) {
      case 'line':
        return renderLineChart();
      case 'bar':
        return renderBarChart();
      case 'pie':
        return renderPieChart();
      case 'scatter':
        return renderScatterChart();
      case 'area':
        return renderAreaChart();
      default:
        return (
          <div className="p-4 text-sm text-muted-foreground">
            Unsupported chart type: {type}
          </div>
        );
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start sm:items-center justify-between gap-2 flex-col sm:flex-row">
        <div className="flex-1">
          {title && (
            <h3 className="text-base sm:text-lg font-semibold">{title}</h3>
          )}
          {description && (
            <p className="text-xs sm:text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={downloadChart}
          className="flex items-center gap-2 w-full sm:w-auto"
        >
          <Download className="h-4 w-4" />
          Download
        </Button>
      </div>
      <div ref={chartRef} className="rounded-lg border border-border p-1 sm:p-4 bg-card overflow-x-auto overflow-y-hidden">
        {renderChart()}
      </div>
    </div>
  );
};
