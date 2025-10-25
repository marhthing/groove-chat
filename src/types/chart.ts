export interface ChartDataPoint {
  x: string | number;
  y: number;
  [key: string]: string | number;
}

export interface ChartDataset {
  label: string;
  data: ChartDataPoint[];
  color?: string;
}

export interface ChartSpec {
  type: 'line' | 'bar' | 'pie' | 'scatter' | 'area';
  title?: string;
  description?: string;
  xAxis?: {
    label?: string;
    type?: 'category' | 'number';
  };
  yAxis?: {
    label?: string;
  };
  datasets: ChartDataset[];
}

export interface ChartMetadata {
  chartSpec?: ChartSpec;
  rawModelResponse?: string;
}
