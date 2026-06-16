/** Consistent stroke-icon set (24 viewBox, 1.8 stroke, round caps). */
import type { JSX } from 'react';

export type IconName =
  | 'select'
  | 'hand'
  | 'frame'
  | 'rectangle'
  | 'diamond'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'freehand'
  | 'text'
  | 'undo'
  | 'redo'
  | 'trash'
  | 'broom'
  | 'grid'
  | 'magnet'
  | 'sun'
  | 'moon'
  | 'folder'
  | 'export'
  | 'imageCopy'
  | 'fit'
  | 'help'
  | 'sparkles'
  | 'library'
  | 'plus'
  | 'close'
  | 'chevronDown'
  | 'check'
  | 'dots'
  | 'lock'
  | 'unlock'
  | 'link'
  | 'eye'
  | 'eyeOff'
  | 'alignLeft'
  | 'alignCenterX'
  | 'alignRight'
  | 'alignTop'
  | 'alignCenterY'
  | 'alignBottom'
  | 'distributeH'
  | 'distributeV'
  | 'pencilEdit'
  | 'canvasDoc';

const paths: Record<IconName, JSX.Element> = {
  select: <path d="M5 3l14 8-6.5 1.5L9 19 5 3z" />,
  hand: (
    <path d="M8.5 11.5V5.75a1.25 1.25 0 0 1 2.5 0v4.75m0-5.5a1.25 1.25 0 0 1 2.5 0v5.5m0-4.5a1.25 1.25 0 0 1 2.5 0V13m0-2a1.25 1.25 0 0 1 2.5 0v4a6.5 6.5 0 0 1-6.5 6.5h-.9a6.5 6.5 0 0 1-5.2-2.6l-2.5-3.33a1.4 1.4 0 0 1 2.1-1.84L8.5 16V11.5z" />
  ),
  frame: <path d="M7 2v20M17 2v20M2 7h20M2 17h20" />,
  rectangle: <rect x="4" y="5" width="16" height="14" rx="2" />,
  diamond: <path d="M12 3l8.5 9-8.5 9-8.5-9L12 3z" />,
  ellipse: <circle cx="12" cy="12" r="8.5" />,
  line: <path d="M5 19L19 5" />,
  arrow: <path d="M5 19L18 6m0 0h-7m7 0v7" />,
  freehand: <path d="M3.5 20.5c4-1 4.5-2 3-4s-1-4.5 1.5-5.5 4 .5 5-2 .5-4.5 3.5-5.5" />,
  text: <path d="M5 6V4h14v2M12 4v16m-3 0h6" />,
  undo: <path d="M8 5L3.5 9.5 8 14M3.5 9.5H15a5.5 5.5 0 0 1 0 11h-3" />,
  redo: <path d="M16 5l4.5 4.5L16 14m4.5-4.5H9a5.5 5.5 0 0 0 0 11h3" />,
  trash: <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13.5h9l1-13.5M10 11v6m4-6v6" />,
  broom: <path d="M14 4l6 6M9.5 8.5L4 14c-1.5 1.5-1.5 4.5 0 6s4.5 1.5 6 0l5.5-5.5M9.5 8.5l6 6" />,
  grid: (
    <>
      <circle cx="5" cy="5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="5" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="19" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="19" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  magnet: <path d="M5 4v7a7 7 0 0 0 14 0V4m-14 0h5v7a2 2 0 0 0 4 0V4h5M5 8h5m4 0h5" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2m0 15v2m9.5-9.5h-2m-15 0h-2m16.3-6.8l-1.5 1.5M6.7 17.3l-1.5 1.5m14.1 0l-1.5-1.5M6.7 6.7L5.2 5.2" />
    </>
  ),
  moon: <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z" />,
  folder: <path d="M3 7.5V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-8L9.5 4.5H5a2 2 0 0 0-2 2v1z" />,
  export: <path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />,
  imageCopy: (
    <>
      <rect x="3" y="3" width="14" height="14" rx="2.5" />
      <path d="M8 21h9a4 4 0 0 0 4-4V8M6.5 13.5l3-3 4.5 4.5m-2-6.5h.01" />
    </>
  ),
  fit: <path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9m6 0h3.5A1.5 1.5 0 0 1 20 5.5V9m0 6v3.5a1.5 1.5 0 0 1-1.5 1.5H15m-6 0H5.5A1.5 1.5 0 0 1 4 18.5V15" />,
  help: <path d="M9 9.2A3.2 3.2 0 0 1 12.2 6c1.7 0 3.1 1.3 3.1 3 0 2.3-3 2.5-3 4.8M12.2 18h.01" />,
  sparkles: (
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16zM5 16.5l.7 1.8 1.8.7-1.8.7L5 21.5l-.7-1.8-1.8-.7 1.8-.7.7-1.8z" />
  ),
  library: <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zm0 0A2.5 2.5 0 0 0 6.5 22H20v-5M9 7.5h7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  chevronDown: <path d="M6 9.5l6 6 6-6" />,
  check: <path d="M4.5 12.5l5 5L19.5 7" />,
  dots: (
    <>
      <circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9.5" rx="2" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
    </>
  ),
  unlock: (
    <>
      <rect x="5" y="11" width="14" height="9.5" rx="2" />
      <path d="M8 11V7.5a4 4 0 0 1 7.8-1.3" />
    </>
  ),
  link: <path d="M9.5 14.5l5-5m-7.2 2.2l-2 2a3.9 3.9 0 0 0 5.5 5.5l2-2m3.4-3.4l2-2a3.9 3.9 0 0 0-5.5-5.5l-2 2" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: <path d="M3 3l18 18M10.5 5.8A9.8 9.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17.5 17.5 0 0 1-2.4 3.2M6.2 6.2C3.9 7.9 2.5 12 2.5 12S6 18.5 12 18.5c1.3 0 2.5-.3 3.6-.8M9.9 9.9a3 3 0 0 0 4.2 4.2" />,
  alignLeft: <path d="M4 3v18M8 7h11v3.5H8M8 13.5h7V17H8" />,
  alignCenterX: <path d="M12 3v18M6 7h12v3.5H6M8 13.5h8V17H8" />,
  alignRight: <path d="M20 3v18M16 7H5v3.5h11M16 13.5H9V17h7" />,
  alignTop: <path d="M3 4h18M7 8v11h3.5V8M13.5 8v7H17V8" />,
  alignCenterY: <path d="M3 12h18M7 6v12h3.5V6M13.5 8v8H17V8" />,
  alignBottom: <path d="M3 20h18M7 16V5h3.5v11M13.5 16V9H17v7" />,
  distributeH: <path d="M4 4v16M20 4v16M9.5 8h5v8h-5z" />,
  distributeV: <path d="M4 4h16M4 20h16M8 9.5h8v5H8z" />,
  pencilEdit: <path d="M14.5 5.5l4 4L8 20H4v-4L14.5 5.5zm2-2l1.6-1.6a1.4 1.4 0 0 1 2 0l2 2a1.4 1.4 0 0 1 0 2L20.5 7.5" />,
  canvasDoc: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M8 14.5c2-4 5.5-6 8-5.5" />
      <circle cx="15.5" cy="15" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
};

interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function Icon({ name, size = 18, strokeWidth = 1.8, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
