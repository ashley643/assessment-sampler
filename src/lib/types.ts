// ─── Data Types ───────────────────────────────────────────────────────────────

export type ColumnType = "number" | "string" | "date" | "boolean" | "percent";

export interface Column {
  key: string;
  label: string;
  type: ColumnType;
}

export interface DataSource {
  id: string;
  name: string;
  sheetUrl: string;
  columns: Column[];
  rows: Record<string, string | number | null>[];
  loadedAt: Date;
}

// ─── Chart Types ──────────────────────────────────────────────────────────────

export type ChartType =
  | "bar"
  | "horizontalBar"
  | "line"
  | "area"
  | "pie"
  | "donut"
  | "scatter"
  | "stat"
  | "table";

export interface ChartConfig {
  id: string;
  type: ChartType;
  title: string;
  description?: string;
  dataSourceId: string;
  xKey?: string;
  yKeys: string[];
  colors: string[];
  showLegend: boolean;
  showGrid: boolean;
}

// ─── Report / Slide Types ─────────────────────────────────────────────────────

export type WidgetType = "chart" | "text" | "image" | "stat" | "divider" | "spacer";

export interface BaseWidget {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  w: number;  // grid columns (1-12)
  h: number;  // pixel height
  locked?: boolean;
}

export interface ChartWidget extends BaseWidget {
  type: "chart";
  chartConfig: ChartConfig;
}

export interface TextWidget extends BaseWidget {
  type: "text";
  content: string;       // HTML/markdown content
  fontSize: number;
  fontWeight: "normal" | "bold" | "semibold";
  align: "left" | "center" | "right";
  color: string;
  isHeading?: boolean;
}

export interface ImageWidget extends BaseWidget {
  type: "image";
  src: string;           // data URL or remote URL
  alt: string;
  objectFit: "cover" | "contain" | "fill";
}

export interface StatWidget extends BaseWidget {
  type: "stat";
  label: string;
  value: string;
  change?: string;
  changeDir?: "up" | "down" | "neutral";
  color: string;
}

export interface DividerWidget extends BaseWidget {
  type: "divider";
  color: string;
}

export interface SpacerWidget extends BaseWidget {
  type: "spacer";
}

export type Widget =
  | ChartWidget
  | TextWidget
  | ImageWidget
  | StatWidget
  | DividerWidget
  | SpacerWidget;

export interface Slide {
  id: string;
  title: string;
  template: SlideTemplate;
  background: string;
  widgets: Widget[];
}

export type SlideTemplate =
  | "blank"
  | "title"
  | "two-column"
  | "full-width-chart"
  | "dashboard"
  | "text-chart";

export interface Report {
  id: string;
  title: string;
  subtitle?: string;
  organization: string;
  coverImage?: string;
  theme: ReportTheme;
  slides: Slide[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  logoUrl?: string;
}

// ─── Store Types ──────────────────────────────────────────────────────────────

export interface AppState {
  // Data
  dataSources: DataSource[];
  activeDataSourceId: string | null;

  // Chart suggestions
  chartSuggestions: ChartConfig[];

  // Report
  report: Report;
  activeSlideId: string | null;

  // UI
  selectedWidgetId: string | null;
  isDragging: boolean;
  isAiPanelOpen: boolean;
  isSaving: boolean;
}
