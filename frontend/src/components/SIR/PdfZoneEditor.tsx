/**
 * ABBYY FlexiCapture-style PDF zone editor.
 * Shows PDF with extraction zones overlaid. Adjust zones to tune extraction.
 * PDF page coordinate system: points (A4 ≈ 595×842).
 */
import React, { useState, useCallback } from 'react';

export interface ZoneConfig {
  header_top: number;
  data_bottom: number;
  margin_left: number;
  margin_right: number;
  cards_per_row: number;
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;

interface PdfZoneEditorProps {
  /** PDF URL (from folder) or blob URL (from upload) */
  pdfUrl: string | null;
  /** Current zone config - controls overlay */
  config: ZoneConfig;
  /** Called when user adjusts zones (e.g. drag) */
  onConfigChange?: (config: Partial<ZoneConfig>) => void;
  /** Page number to show (1-based) */
  page?: number;
  /** Enable interactive zone adjustment */
  editable?: boolean;
  className?: string;
}

const PdfZoneEditor: React.FC<PdfZoneEditorProps> = ({
  pdfUrl,
  config,
  onConfigChange,
  page = 1,
  editable = true,
  className = '',
}) => {
  const [scale, setScale] = useState(0.85);
  const [dragMode, setDragMode] = useState<'header' | 'data_bottom' | null>(null);
  const [dragStartY, setDragStartY] = useState(0);
  const [configSnapshot, setConfigSnapshot] = useState<ZoneConfig>(config);

  const containerRef = React.useRef<HTMLDivElement>(null);

  // Sync config from parent
  React.useEffect(() => {
    setConfigSnapshot(config);
  }, [config.header_top, config.data_bottom, config.margin_left, config.margin_right, config.cards_per_row]);

  const toDisplayY = useCallback(
    (points: number) => points * scale,
    [scale]
  );

  const handleMouseDown = (mode: 'header' | 'data_bottom') => (e: React.MouseEvent) => {
    if (!editable || !onConfigChange) return;
    e.preventDefault();
    setDragMode(mode);
    setDragStartY(e.clientY);
  };

  React.useEffect(() => {
    if (!dragMode) return;
    const onMove = (e: MouseEvent) => {
      const dyPx = e.clientY - dragStartY;
      const pointsDy = Math.round(dyPx / scale);
      if (dragMode === 'header') {
        const newTop = Math.max(50, Math.min(configSnapshot.data_bottom - 80, configSnapshot.header_top + pointsDy));
        setConfigSnapshot((c) => ({ ...c, header_top: newTop }));
        onConfigChange?.({ header_top: newTop });
      } else {
        const newBottom = Math.max(configSnapshot.header_top + 80, Math.min(800, configSnapshot.data_bottom + pointsDy));
        setConfigSnapshot((c) => ({ ...c, data_bottom: newBottom }));
        onConfigChange?.({ data_bottom: newBottom });
      }
      setDragStartY(e.clientY);
    };
    const onUp = () => setDragMode(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragMode, dragStartY, configSnapshot, onConfigChange, scale]);

  if (!pdfUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 ${className}`}
        style={{ minHeight: 400 }}
      >
        <p className="text-gray-500 dark:text-gray-400 text-sm">Select a PDF to preview zones</p>
      </div>
    );
  }

  const c = configSnapshot;
  const w = PAGE_WIDTH * scale;
  const h = PAGE_HEIGHT * scale;

  return (
    <div ref={containerRef} className={`flex flex-col ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">Zoom:</span>
        <input
          type="range"
          min="0.4"
          max="1.5"
          step="0.05"
          value={scale}
          onChange={(e) => setScale(parseFloat(e.target.value))}
          className="w-24"
        />
        <span className="text-xs text-gray-600 dark:text-gray-300">{Math.round(scale * 100)}%</span>
      </div>
      <div className="relative overflow-auto rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900" style={{ maxHeight: '70vh' }}>
        <div style={{ width: w, height: h, position: 'relative', margin: 'auto' }}>
          {/* PDF */}
          <iframe
            src={`${pdfUrl}#page=${page}`}
            title="PDF preview"
            className="absolute inset-0 w-full h-full border-0"
            style={{ width: w, height: h }}
          />
          {/* Zone overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ width: w, height: h }}
          >
            {editable && <div className="absolute inset-0 pointer-events-auto" style={{ width: w, height: h }} />}
            {/* Header zone - skip */}
            <div
              className="absolute left-0 right-0 bg-red-500/20 border-b-2 border-red-500"
              style={{
                top: 0,
                height: toDisplayY(c.header_top),
                pointerEvents: editable ? 'auto' : 'none',
              }}
            >
              <span className="absolute bottom-1 left-2 text-xs font-medium text-red-700 dark:text-red-400 bg-white/80 dark:bg-gray-900/80 px-1 rounded">
                Skip — Header
              </span>
            </div>
            {/* Header drag handle */}
            {editable && onConfigChange && (
              <div
                className="absolute left-0 right-0 cursor-ns-resize hover:bg-red-400/30 border-t-2 border-b-2 border-red-500 z-10"
                style={{
                  top: toDisplayY(c.header_top) - 4,
                  height: 8,
                  pointerEvents: 'auto',
                }}
                onMouseDown={handleMouseDown('header')}
              />
            )}
            {/* Data zone - extract */}
            <div
              className="absolute left-0 right-0 bg-emerald-500/15 border border-emerald-500/50"
              style={{
                top: toDisplayY(c.header_top),
                height: toDisplayY(c.data_bottom - c.header_top),
                pointerEvents: 'none',
              }}
            >
              <span className="absolute top-1 left-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-white/80 dark:bg-gray-900/80 px-1 rounded">
                Extract — Voter cards
              </span>
              {/* Column dividers */}
              {c.cards_per_row > 1 &&
                Array.from({ length: c.cards_per_row - 1 }).map((_, i) => {
                  const colW = (PAGE_WIDTH - (c.margin_left || 0) - (c.margin_right || 0)) / c.cards_per_row;
                  const x = (c.margin_left || 0) + colW * (i + 1);
                  return (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 w-px bg-emerald-400/50"
                      style={{ left: (x / PAGE_WIDTH) * w }}
                    />
                  );
                })}
            </div>
            {/* Data bottom drag handle */}
            {editable && onConfigChange && (
              <div
                className="absolute left-0 right-0 cursor-ns-resize hover:bg-red-400/30 border-t-2 border-b-2 border-red-500 z-10"
                style={{
                  top: toDisplayY(c.data_bottom) - 4,
                  height: 8,
                  pointerEvents: 'auto',
                }}
                onMouseDown={handleMouseDown('data_bottom')}
              />
            )}
            {/* Footer zone - skip */}
            <div
              className="absolute left-0 right-0 bottom-0 bg-red-500/20 border-t-2 border-red-500"
              style={{
                height: toDisplayY(PAGE_HEIGHT - c.data_bottom),
                pointerEvents: 'none',
              }}
            >
              <span className="absolute top-1 left-2 text-xs font-medium text-red-700 dark:text-red-400 bg-white/80 dark:bg-gray-900/80 px-1 rounded">
                Skip — Footer
              </span>
            </div>
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        Drag the red borders to adjust extraction boundaries. Header top: {c.header_top}pt, Data bottom: {c.data_bottom}pt
      </p>
    </div>
  );
};

export default PdfZoneEditor;
