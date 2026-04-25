import { useState, useRef, useCallback, useEffect, type PointerEvent as RPointerEvent } from "react";
import DeshTooltip from "@/components/ui/DeshTooltip";
import {
  Pen, Eraser, Highlighter, Square, Circle, ArrowRight, Minus,
  Type, Undo2, Redo2, Trash2, Download, Maximize2, Minimize2, X,
  Palette, ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/* ─────────────── Types ─────────────── */
type Tool = "pen" | "highlighter" | "eraser" | "rect" | "circle" | "arrow" | "line" | "text";

interface Point { x: number; y: number }

interface Stroke {
  tool: Tool;
  color: string;
  width: number;
  opacity: number;
  points: Point[];
}

interface ShapeObj {
  tool: "rect" | "circle" | "arrow" | "line";
  color: string;
  width: number;
  start: Point;
  end: Point;
}

interface TextObj {
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
}

type DrawAction = { type: "stroke"; data: Stroke } | { type: "shape"; data: ShapeObj } | { type: "text"; data: TextObj };

interface DrawingCanvasProps {
  initialData?: string; // JSON stringified drawing data
  onSave: (dataUrl: string, jsonData: string) => void;
  onClose: () => void;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  width?: number;
  height?: number;
}

/* ─────────────── Color palette ─────────────── */
const COLORS = [
  "hsl(var(--foreground))",
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#6b7280",
  "hsl(var(--background))", // white/eraser-like
];

const WIDTHS = [1, 2, 4, 6, 10];

/* ─────────────── Component ─────────────── */
export function DrawingCanvas({
  initialData,
  onSave,
  onClose,
  fullscreen = false,
  onToggleFullscreen,
  width: propWidth,
  height: propHeight,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [actions, setActions] = useState<DrawAction[]>([]);
  const [redoStack, setRedoStack] = useState<DrawAction[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [shapeStart, setShapeStart] = useState<Point | null>(null);
  const [shapePreview, setShapePreview] = useState<Point | null>(null);
  const [textInput, setTextInput] = useState<{ x: number; y: number } | null>(null);
  const [textValue, setTextValue] = useState("");
  const [canvasSize, setCanvasSize] = useState({ w: propWidth || 800, h: propHeight || 400 });

  const isShapeTool = tool === "rect" || tool === "circle" || tool === "arrow" || tool === "line";

  // Load initial data
  useEffect(() => {
    if (initialData) {
      try {
        const parsed = JSON.parse(initialData);
        if (Array.isArray(parsed.actions)) setActions(parsed.actions);
      } catch { /* ignore */ }
    }
  }, [initialData]);

  // Resize canvas to container
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([e]) => {
      const { width: w, height: h } = e.contentRect;
      if (w > 0 && h > 0) setCanvasSize({ w: Math.round(w), h: Math.round(h) });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Redraw canvas on actions/size change
  useEffect(() => {
    redrawCanvas();
  }, [actions, canvasSize, shapePreview, shapeStart, currentPoints, tool, color, strokeWidth]);

  const getCanvasPoint = useCallback((e: RPointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }, []);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = canvasSize.w * 2; // Retina
    canvas.height = canvasSize.h * 2;
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);

    // Fill background
    ctx.fillStyle = "transparent";
    ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);

    // Draw grid dots
    ctx.fillStyle = "hsl(var(--border) / 0.3)";
    for (let x = 20; x < canvasSize.w; x += 20) {
      for (let y = 20; y < canvasSize.h; y += 20) {
        ctx.beginPath();
        ctx.arc(x, y, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Render all actions
    for (const action of actions) {
      if (action.type === "stroke") renderStroke(ctx, action.data);
      else if (action.type === "shape") renderShape(ctx, action.data);
      else if (action.type === "text") renderText(ctx, action.data);
    }

    // Render current stroke in progress
    if (currentPoints.length > 1 && !isShapeTool) {
      renderStroke(ctx, {
        tool,
        color: tool === "eraser" ? "hsl(var(--background))" : color,
        width: tool === "eraser" ? strokeWidth * 4 : strokeWidth,
        opacity: tool === "highlighter" ? 0.35 : 1,
        points: currentPoints,
      });
    }

    // Render shape preview
    if (isShapeTool && shapeStart && shapePreview) {
      renderShape(ctx, {
        tool: tool as "rect" | "circle" | "arrow" | "line",
        color,
        width: strokeWidth,
        start: shapeStart,
        end: shapePreview,
      });
    }
  }, [actions, canvasSize, currentPoints, shapeStart, shapePreview, tool, color, strokeWidth, isShapeTool]);

  /* ── Rendering helpers ─────────────── */

  function renderStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
    if (s.points.length < 2) return;
    ctx.save();
    ctx.globalAlpha = s.opacity;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (s.tool === "eraser") ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    for (let i = 1; i < s.points.length; i++) {
      const p = s.points[i];
      const prev = s.points[i - 1];
      const mx = (prev.x + p.x) / 2;
      const my = (prev.y + p.y) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
    }
    ctx.stroke();
    ctx.restore();
  }

  function renderShape(ctx: CanvasRenderingContext2D, s: ShapeObj) {
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const { start, end } = s;

    if (s.tool === "rect") {
      ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
    } else if (s.tool === "circle") {
      const rx = Math.abs(end.x - start.x) / 2;
      const ry = Math.abs(end.y - start.y) / 2;
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (s.tool === "line") {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    } else if (s.tool === "arrow") {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      // Arrow head
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const headLen = 12 + s.width * 2;
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - headLen * Math.cos(angle - 0.4), end.y - headLen * Math.sin(angle - 0.4));
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - headLen * Math.cos(angle + 0.4), end.y - headLen * Math.sin(angle + 0.4));
      ctx.stroke();
    }
    ctx.restore();
  }

  function renderText(ctx: CanvasRenderingContext2D, t: TextObj) {
    ctx.save();
    ctx.font = `${t.fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = t.color;
    ctx.textBaseline = "top";
    const lines = t.text.split("\n");
    lines.forEach((line, i) => {
      ctx.fillText(line, t.x, t.y + i * (t.fontSize * 1.3));
    });
    ctx.restore();
  }

  /* ── Pointer handlers ─────────────── */

  const handlePointerDown = (e: RPointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const p = getCanvasPoint(e);

    if (tool === "text") {
      setTextInput(p);
      setTextValue("");
      return;
    }

    setIsDrawing(true);
    setRedoStack([]);

    if (isShapeTool) {
      setShapeStart(p);
      setShapePreview(p);
    } else {
      setCurrentPoints([p]);
    }
  };

  const handlePointerMove = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const p = getCanvasPoint(e);

    if (isShapeTool) {
      setShapePreview(p);
    } else {
      setCurrentPoints(prev => [...prev, p]);
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (isShapeTool && shapeStart && shapePreview) {
      const dist = Math.hypot(shapePreview.x - shapeStart.x, shapePreview.y - shapeStart.y);
      if (dist > 3) {
        setActions(prev => [...prev, {
          type: "shape",
          data: { tool: tool as "rect" | "circle" | "arrow" | "line", color, width: strokeWidth, start: shapeStart, end: shapePreview },
        }]);
      }
      setShapeStart(null);
      setShapePreview(null);
    } else if (currentPoints.length > 1) {
      setActions(prev => [...prev, {
        type: "stroke",
        data: {
          tool,
          color: tool === "eraser" ? "hsl(var(--background))" : color,
          width: tool === "eraser" ? strokeWidth * 4 : strokeWidth,
          opacity: tool === "highlighter" ? 0.35 : 1,
          points: [...currentPoints],
        },
      }]);
      setCurrentPoints([]);
    }
  };

  const handleTextSubmit = () => {
    if (textInput && textValue.trim()) {
      setActions(prev => [...prev, {
        type: "text",
        data: { x: textInput.x, y: textInput.y, text: textValue, color, fontSize: 14 + strokeWidth * 2 },
      }]);
      setRedoStack([]);
    }
    setTextInput(null);
    setTextValue("");
  };

  /* ── Undo / Redo / Clear ─────────────── */
  const MAX_UNDO_STACK = 200;

  const undo = useCallback(() => {
    setActions(prev => {
      if (!prev.length) return prev;
      setRedoStack(r => [...r, prev[prev.length - 1]].slice(-MAX_UNDO_STACK));
      return prev.slice(0, -1);
    });
  }, []);

  const redo = useCallback(() => {
    setRedoStack(prev => {
      if (!prev.length) return prev;
      setActions(a => [...a, prev[prev.length - 1]]);
      return prev.slice(0, -1);
    });
  }, []);

  const clear = useCallback(() => {
    setActions(prev => {
      if (!prev.length) return prev;
      // Save all current actions as a batch to redo stack so clear can be undone
      setRedoStack(r => [...r, ...prev].slice(-MAX_UNDO_STACK));
      return [];
    });
  }, []);

  // Keyboard shortcuts: Ctrl+Z / Ctrl+Shift+Z
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  /* ── Save / Export ─────────────── */

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Export image
    const dataUrl = canvas.toDataURL("image/png");
    // Export JSON data for re-editing
    const jsonData = JSON.stringify({ actions, width: canvasSize.w, height: canvasSize.h });
    onSave(dataUrl, jsonData);
  };

  const handleExportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `desenho-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  /* ── Tool button ─────────────── */

  const ToolButton = ({ t, icon, label }: { t: Tool; icon: React.ReactNode; label: string }) => (
    <button
      onClick={() => setTool(t)}
      title={label}
      className={`p-2 rounded-xl transition-colors ${
        tool === t
          ? "bg-primary/15 text-primary shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      }`}
    >
      {icon}
    </button>
  );

  return (
    <div className={`flex flex-col ${fullscreen ? "fixed inset-0 z-50 bg-background" : "rounded-xl border border-border/30 overflow-hidden"}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border/20 bg-foreground/5 flex-wrap flex-shrink-0">
        {/* Drawing tools */}
        <ToolButton t="pen" icon={<Pen className="w-4 h-4" />} label="Caneta" />
        <ToolButton t="highlighter" icon={<Highlighter className="w-4 h-4" />} label="Marcador" />
        <ToolButton t="eraser" icon={<Eraser className="w-4 h-4" />} label="Borracha" />

        <span className="w-px h-5 bg-border/30 mx-1" />

        {/* Shape tools */}
        <ToolButton t="rect" icon={<Square className="w-4 h-4" />} label="Retângulo" />
        <ToolButton t="circle" icon={<Circle className="w-4 h-4" />} label="Círculo" />
        <ToolButton t="arrow" icon={<ArrowRight className="w-4 h-4" />} label="Seta" />
        <ToolButton t="line" icon={<Minus className="w-4 h-4" />} label="Linha" />
        <ToolButton t="text" icon={<Type className="w-4 h-4" />} label="Texto" />

        <span className="w-px h-5 bg-border/30 mx-1" />

        {/* Color picker */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1 p-1.5 rounded-xl hover:bg-muted/50 transition-colors">
              <div className="w-5 h-5 rounded-full border-2 border-border/50" style={{ background: color }} />
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" side="bottom">
            <div className="grid grid-cols-6 gap-1.5">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    color === c ? "border-primary ring-2 ring-primary/30 scale-110" : "border-border/30"
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Stroke width */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex items-center gap-1 px-2 py-1.5 rounded-xl hover:bg-muted/50 transition-colors text-xs text-muted-foreground">
              <div className="flex items-center gap-0.5">
                <div className="rounded-full bg-foreground" style={{ width: strokeWidth * 2 + 4, height: strokeWidth * 2 + 4 }} />
              </div>
              <ChevronDown className="w-3 h-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" side="bottom">
            <div className="flex items-end gap-2">
              {WIDTHS.map(w => (
                <button
                  key={w}
                  onClick={() => setStrokeWidth(w)}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded-lg transition-colors ${
                    strokeWidth === w ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <div className="rounded-full bg-current" style={{ width: w * 2 + 4, height: w * 2 + 4 }} />
                  <span className="text-[10px]">{w}px</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <span className="w-px h-5 bg-border/30 mx-1" />

        {/* Undo / Redo / Clear */}
        <DeshTooltip label="Desfazer (⌘Z)">
          <button onClick={undo} disabled={!actions.length} className="p-2 rounded-xl text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors">
            <Undo2 className="w-4 h-4" />
          </button>
        </DeshTooltip>
        <DeshTooltip label="Refazer (⌘⇧Z)">
          <button onClick={redo} disabled={!redoStack.length} className="p-2 rounded-xl text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors">
            <Redo2 className="w-4 h-4" />
          </button>
        </DeshTooltip>
        <DeshTooltip label="Limpar tudo (pode desfazer)">
          <button onClick={clear} disabled={!actions.length} className="p-2 rounded-xl text-muted-foreground hover:text-destructive disabled:opacity-20 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </DeshTooltip>

        <span className="w-px h-5 bg-border/30 mx-1" />

        {/* Export PNG */}
        <button onClick={handleExportPng} disabled={!actions.length} className="p-2 rounded-xl text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors" title="Exportar PNG">
          <Download className="w-4 h-4" />
        </button>

        {/* Fullscreen toggle */}
        {onToggleFullscreen && (
          <button onClick={onToggleFullscreen} className="p-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors" title={fullscreen ? "Minimizar" : "Tela cheia"}>
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        )}

        {/* Save & Close */}
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" onClick={handleSave} className="rounded-xl gap-1.5 text-xs">
            <Palette className="w-3.5 h-3.5" /> Salvar desenho
          </Button>
          <button onClick={onClose} className="p-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors" title="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        className={`relative flex-1 ${fullscreen ? "" : "min-h-[300px]"} bg-background overflow-hidden`}
        style={fullscreen ? {} : { height: propHeight || 400 }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: canvasSize.w, height: canvasSize.h, touchAction: "none", cursor: tool === "text" ? "text" : "crosshair" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />

        {/* Inline text input */}
        {textInput && (
          <div
            className="absolute"
            style={{ left: textInput.x / 2, top: textInput.y / 2 }}
          >
            <textarea
              autoFocus
              value={textValue}
              onChange={e => setTextValue(e.target.value)}
              onBlur={handleTextSubmit}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleTextSubmit(); } if (e.key === "Escape") { setTextInput(null); setTextValue(""); } }}
              className="min-w-[120px] min-h-[32px] p-1 bg-transparent border border-primary/50 rounded-lg text-sm outline-none resize-none"
              style={{ color, fontSize: 14 + strokeWidth * 2 }}
              placeholder="Digite aqui..."
            />
          </div>
        )}
      </div>
    </div>
  );
}
