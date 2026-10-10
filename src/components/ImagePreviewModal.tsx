import { useEffect, useRef, useState } from "react";
import type { TouchList, TouchEvent, WheelEvent, MouseEvent } from "react";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

type Props = { imageUrl: string; onClose: () => void };

function touchDistance(touches: TouchList) {
  if (touches.length < 2) return 0;
  return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
}

export default function ImagePreviewModal({ imageUrl, onClose }: Props) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "+" || event.key === "=") setZoom(z => Math.min(5, z + 0.25));
      if (event.key === "-") setZoom(z => Math.max(1, z - 0.25));
    };
    window.addEventListener("keydown", keyHandler);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", keyHandler);
    };
  }, [onClose]);

  const reset = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };
  const touchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      pinchStart.current = { distance: touchDistance(event.touches), zoom };
      dragStart.current = null;
    } else if (event.touches.length === 1 && zoom > 1) {
      dragStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY, offsetX: offset.x, offsetY: offset.y };
    }
  };
  const touchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2 && pinchStart.current) {
      event.preventDefault();
      const start = pinchStart.current;
      setZoom(Math.max(1, Math.min(5, start.zoom * touchDistance(event.touches) / Math.max(1, start.distance))));
    } else if (event.touches.length === 1 && dragStart.current && zoom > 1) {
      event.preventDefault();
      const start = dragStart.current;
      setOffset({ x: start.offsetX + event.touches[0].clientX - start.x, y: start.offsetY + event.touches[0].clientY - start.y });
    }
  };
  const touchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length < 2) pinchStart.current = null;
    if (event.touches.length === 0) dragStart.current = null;
  };
  const wheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    setZoom(z => Math.max(1, Math.min(5, z + (event.deltaY < 0 ? 0.2 : -0.2))));
  };
  const mouseDown = (event: MouseEvent<HTMLImageElement>) => {
    if (zoom <= 1) return;
    dragging.current = true;
    dragStart.current = { x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y };
    event.preventDefault();
  };
  const mouseMove = (event: React.MouseEvent<HTMLImageElement>) => {
    if (!dragging.current || !dragStart.current || zoom <= 1) return;
    setOffset({ x: dragStart.current.offsetX + event.clientX - dragStart.current.x, y: dragStart.current.offsetY + event.clientY - dragStart.current.y });
  };
  const mouseUp = () => { dragging.current = false; dragStart.current = null; };

  return (
    <div className="social-image-modal" role="dialog" aria-modal="true" aria-label="Image preview" onClick={onClose}>
      <header className="social-image-modal-header" onClick={event => event.stopPropagation()}>
        <div>
          <div className="social-image-modal-title">Image preview</div>
          <div className="social-image-modal-subtitle">Pinch to zoom · Drag to move · {Math.round(zoom * 100)}%</div>
        </div>
        <button type="button" className="social-image-modal-close" onClick={onClose} aria-label="Close image preview" title="Close preview">Close</button>
      </header>
      <div className="social-image-modal-stage" onClick={event => event.stopPropagation()} onTouchStart={touchStart} onTouchMove={touchMove} onTouchEnd={touchEnd} onWheel={wheel}>
        <img src={imageUrl} alt="Full-size post image" draggable={false} onMouseDown={mouseDown} onMouseMove={mouseMove} onMouseUp={mouseUp} onMouseLeave={mouseUp} style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`, cursor: zoom > 1 ? (dragging.current ? "grabbing" : "grab") : "zoom-in", transition: pinchStart.current ? "none" : "transform 80ms ease-out" }} />
      </div>
      <footer className="social-image-modal-controls" onClick={event => event.stopPropagation()}>
        <button type="button" onClick={() => setZoom(z => Math.max(1, z - 0.25))} aria-label="Zoom out" disabled={zoom <= 1} style={{ opacity: zoom <= 1 ? .4 : 1 }}><ZoomOut size={19} /></button>
        <button type="button" className="social-image-modal-reset" onClick={reset} aria-label="Reset zoom"><RotateCcw size={16} /><span>Reset</span></button>
        <button type="button" onClick={() => setZoom(z => Math.min(5, z + 0.25))} aria-label="Zoom in" disabled={zoom >= 5} style={{ opacity: zoom >= 5 ? .4 : 1 }}><ZoomIn size={19} /></button>
      </footer>
    </div>
  );
}
