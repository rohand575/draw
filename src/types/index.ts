/** Shared types for Mind Canvas. */

export type ElementType =
  | 'rectangle'
  | 'diamond'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'freehand'
  | 'text'
  | 'image'
  | 'frame'
  | 'embed';

export type Tool =
  | 'select'
  | 'hand'
  | 'frame'
  | 'rectangle'
  | 'diamond'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'freehand'
  | 'text';

export interface Point {
  x: number;
  y: number;
}

export type StrokeStyle = 'solid' | 'dashed' | 'dotted';
export type FillStyle = 'solid' | 'hachure' | 'cross-hatch';
export type ConnectorStyle = 'straight' | 'elbow';
export type ConnectionPointName = 'n' | 's' | 'e' | 'w' | 'center';
export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';
export type Theme = 'light' | 'dark';

export interface ConnectorBinding {
  elementId: string;
  point: ConnectionPointName;
}

export interface CanvasElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  /** line/arrow (2 pts) and freehand (N pts); relative to {x, y}. */
  points?: Point[];
  text?: string;
  fontSize?: number;
  textWrap?: boolean;
  isCode?: boolean;
  codeLanguage?: string;
  imageData?: string;
  embedUrl?: string;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  roughness: number;
  opacity: number;
  strokeStyle: StrokeStyle;
  fillStyle: FillStyle;
  edgeRoundness: number;
  /** Reserved for future rotation support; always 0 currently. */
  rotation: number;
  zIndex: number;
  createdAt: number;
  updatedAt: number;
  locked?: boolean;
  groupId?: string;
  hyperlink?: string;
  startBinding?: ConnectorBinding;
  endBinding?: ConnectorBinding;
  connectorStyle?: ConnectorStyle;
  connectorLabel?: string;
  frameName?: string;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasState {
  offsetX: number;
  offsetY: number;
  zoom: number;
  theme?: Theme;
  showGrid?: boolean;
}

export interface CanvasDocument {
  id: string;
  name: string;
  elements: CanvasElement[];
  canvasState: CanvasState;
  createdAt: number;
  updatedAt: number;
}

export interface CanvasDocumentMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface HistoryEntry {
  elements: CanvasElement[];
  timestamp: number;
}

export interface LibraryItem {
  id: string;
  name: string;
  elements: CanvasElement[];
}

export interface AlignmentGuide {
  type: 'vertical' | 'horizontal';
  position: number;
  start: number;
  end: number;
}

export type AlignType = 'left' | 'right' | 'centerX' | 'top' | 'bottom' | 'centerY';
export type DistributeAxis = 'horizontal' | 'vertical';

export interface FindMatch {
  elementId: string;
  start: number;
  end: number;
}

/** Style settings carried by the tool store / element factory. */
export interface StyleSettings {
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  roughness: number;
  opacity: number;
  fontSize: number;
  strokeStyle: StrokeStyle;
  fillStyle: FillStyle;
  edgeRoundness: number;
}
