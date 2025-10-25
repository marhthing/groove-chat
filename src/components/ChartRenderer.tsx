import React from 'react';
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
import { ChartSpec, ChartDataset } from '@/types/chart';

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
  if (!spec || !spec.datasets || spec.datasets.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground bg-muted/30 rounded-lg">
        No chart data available
      </div>
    );
  }

  const { type, title, description, xAxis, yAxis, datasets } = spec;

  const renderLineChart = () => {
    const mergedData = mergeDatasets(datasets);
    
    return (
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={mergedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="x" 
            label={xAxis?.label ? { value: xAxis.label, position: 'insideBottom', offset: -5 } : undefined}
            className="text-xs"
          />
          <YAxis 
            label={yAxis?.label ? { value: yAxis.label, angle: -90, position: 'insideLeft' } : undefined}
            className="text-xs"
          />
          <Tooltip 
            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <Legend />
          {datasets.map((dataset, idx) => (
            <Line
              key={idx}
              type="monotone"
              dataKey={dataset.label}
              stroke={dataset.color || CHART_COLORS[idx % CHART_COLORS.length]}
              name={dataset.label}
              strokeWidth={2}
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
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={mergedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="x"
            label={xAxis?.label ? { value: xAxis.label, position: 'insideBottom', offset: -5 } : undefined}
            className="text-xs"
          />
          <YAxis 
            label={yAxis?.label ? { value: yAxis.label, angle: -90, position: 'insideLeft' } : undefined}
            className="text-xs"
          />
          <Tooltip 
            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <Legend />
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
      <ResponsiveContainer width="100%" height={400}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={(entry) => `${entry.name}: ${entry.value}`}
            outerRadius={120}
            dataKey="value"
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  const renderScatterChart = () => (
    <ResponsiveContainer width="100%" height={400}>
      <ScatterChart margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis 
          dataKey="x" 
          type="number"
          label={xAxis?.label ? { value: xAxis.label, position: 'insideBottom', offset: -5 } : undefined}
          className="text-xs"
        />
        <YAxis 
          dataKey="y"
          label={yAxis?.label ? { value: yAxis.label, angle: -90, position: 'insideLeft' } : undefined}
          className="text-xs"
        />
        <Tooltip 
          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
          cursor={{ strokeDasharray: '3 3' }}
        />
        <Legend />
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
      <ResponsiveContainer width="100%" height={400}>
        <AreaChart data={mergedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="x"
            label={xAxis?.label ? { value: xAxis.label, position: 'insideBottom', offset: -5 } : undefined}
            className="text-xs"
          />
          <YAxis 
            label={yAxis?.label ? { value: yAxis.label, angle: -90, position: 'insideLeft' } : undefined}
            className="text-xs"
          />
          <Tooltip 
            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <Legend />
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
      {title && (
        <h3 className="text-lg font-semibold">{title}</h3>
      )}
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      <div className="rounded-lg border border-border p-4 bg-card">
        {renderChart()}
      </div>
    </div>
  );
};
