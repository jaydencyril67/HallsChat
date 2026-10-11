import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Check, Minus, Plus, X } from "lucide-react";

type StoryImageCropModalProps = {
  imageUrl: string;
  onCancel: () => void;
  onDone: (file: File) => void | Promise<void>;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function StoryImageCropModal({ imageUrl, onCancel, onDone }: StoryImageCropModalProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<{ distance: number; zoom: number; offset: { x: number; y: number } } | null>(null);
  const dragRef = useRef<{ x: number; y: number; offset: { x: number; y: number } } | null>(null);
  const zoomRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const [frame, setFrame] = useState({ width: 320, height: 320 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    zoomRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setReady(false);
  }, [imageUrl]);

  const baseScale = () => {
    const image = imageRef.current;
    if (!image?.naturalWidth || !image.naturalHeight) return 1;
    return Math.max(frame.width / image.naturalWidth, frame.height / image.naturalHeight);
  };

  const geometry = (activeZoom = zoomRef.current) => {
    const image = imageRef.current;
    if (!image?.naturalWidth || !image.naturalHeight) return null;
    const scale = baseScale() * activeZoom;
    return { width: image.naturalWidth * scale, height: image.naturalHeight * scale };
  };

  const constrainOffset = (next: { x: number; y: number }, nextZoom = zoomRef.current) => {
    const image = imageRef.current;
    if (!image?.naturalWidth || !image.naturalHeight) return next;
    const scale = baseScale() * nextZoom;
    return {
      x: clamp(next.x, frame.width - image.naturalWidth * scale, 0),
      y: clamp(next.y, frame.height - image.naturalHeight * scale, 0),
    };
  };

  const changeZoom = (next: number) => {
    const image = imageRef.current;
    if (!image?.naturalWidth || !image.naturalHeight) return;
    const nextZoom = clamp(next, 1, 5);
    const currentScale = baseScale() * zoomRef.current;
    const nextScale = baseScale() * nextZoom;
    const centerX = frame.width / 2;
    const centerY = frame.height / 2;
    const imagePointX = (centerX - offsetRef.current.x) / currentScale;
    const imagePointY = (centerY - offsetRef.current.y) / currentScale;
    const nextOffset = constrainOffset({
      x: centerX - imagePointX * nextScale,
      y: centerY - imagePointY * nextScale,
    }, nextZoom);
    zoomRef.current = nextZoom;
    offsetRef.current = nextOffset;
    setZoom(nextZoom);
    setOffset(nextOffset);
  };

  const handleImageLoad = () => {
    const image = imageRef.current;
    if (!image?.naturalWidth || !image.naturalHeight) return;
    const maxWidth = Math.max(200, Math.min(window.innerWidth * 0.92, 900));
    const maxHeight = Math.max(180, Math.min(window.innerHeight * 0.62, 720));
    const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
    const width = Math.max(1, image.naturalWidth * scale);
    const height = Math.max(1, image.naturalHeight * scale);
    setFrame({ width, height });
    zoomRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setReady(true);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!ready || saving) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const bounds = event.currentTarget.getBoundingClientRect();
    pointersRef.current.set(event.pointerId, { x: event.clientX - bounds.left, y: event.clientY - bounds.top });
    if (pointersRef.current.size === 1) {
      const point = pointersRef.current.get(event.pointerId)!;
      dragRef.current = { x: point.x, y: point.y, offset: offsetRef.current };
      gestureRef.current = null;
    } else if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      gestureRef.current = {
        distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
        midpoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        zoom: zoomRef.current,
        offset: offsetRef.current,
      };
      dragRef.current = null;
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId) || !ready || saving) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    pointersRef.current.set(event.pointerId, { x: event.clientX - bounds.left, y: event.clientY - bounds.top });
    if (pointersRef.current.size >= 2 && gestureRef.current) {
      const [a, b] = Array.from(pointersRef.current.values());
      const distance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
      const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const nextZoom = clamp(gestureRef.current.zoom * distance / gestureRef.current.distance, 1, 12);
      const startScale = baseScale() * gestureRef.current.zoom;
      const nextScale = baseScale() * nextZoom;
      const imagePointX = (gestureRef.current.midpoint.x - gestureRef.current.offset.x) / startScale;
      const imagePointY = (gestureRef.current.midpoint.y - gestureRef.current.offset.y) / startScale;
      const nextOffset = constrainOffset({
        x: midpoint.x - imagePointX * nextScale,
        y: midpoint.y - imagePointY * nextScale,
      }, nextZoom);
      zoomRef.current = nextZoom;
      offsetRef.current = nextOffset;
      setZoom(nextZoom);
      setOffset(nextOffset);
      return;
    }
    if (!dragRef.current) return;
    const point = pointersRef.current.get(event.pointerId);
    if (!point) return;
    const nextOffset = constrainOffset({
      x: offsetRef.current.x + point.x - dragRef.current.x,
      y: offsetRef.current.y + point.y - dragRef.current.y,
    });
    dragRef.current = { x: point.x, y: point.y, offset: nextOffset };
    offsetRef.current = nextOffset;
    setOffset(nextOffset);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* Pointer capture may already be released. */ }
    gestureRef.current = null;
    dragRef.current = null;
    if (pointersRef.current.size === 1) {
      const point = Array.from(pointersRef.current.values())[0];
      dragRef.current = { x: point.x, y: point.y, offset: offsetRef.current };
    }
  };

  const saveCrop = async () => {
    const image = imageRef.current;
    const drawn = geometry();
    if (!image || !drawn || !ready || saving) return;
    setSaving(true);
    try {
      const outputWidth = Math.min(1600, Math.max(800, Math.round(frame.width * 2)));
      const outputHeight = Math.max(1, Math.round(outputWidth * frame.height / frame.width));
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Couldn't prepare this story photo. Please try again.");
      const scale = outputWidth / frame.width;
      context.drawImage(image, offsetRef.current.x * scale, offsetRef.current.y * scale, drawn.width * scale, drawn.height * scale);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error("Couldn't crop this photo. Please try again.");
      await onDone(new File([blob], "story-photo.jpg", { type: "image/jpeg" }));
    } catch (error) {
      console.error("[story-crop] failed to create cropped image", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Edit story photo" className="social-story-crop-overlay">
      <header className="social-story-crop-header">
        <button type="button" onClick={onCancel} disabled={saving} aria-label="Cancel photo edit"><X size={23} /></button>
        <div><strong>Edit story photo</strong></div>
        <button type="button" onClick={() => void saveCrop()} disabled={!ready || saving} aria-label="Apply crop">{saving ? "…" : <Check size={25} />}</button>
      </header>
      <div className="social-story-crop-stage">
        <div
          className="social-story-crop-frame"
          style={{ width: frame.width, height: frame.height, maxWidth: "92vw", maxHeight: "62dvh" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <img
            ref={imageRef}
            src={imageUrl}
            alt="Selected story photo crop"
            onLoad={handleImageLoad}
            draggable={false}
            style={{
              width: ready ? geometry()?.width : "100%",
              height: ready ? geometry()?.height : "100%",
              transform: `translate(${offset.x}px, ${offset.y}px)`,
            }}
          />
          <div className="social-story-crop-grid" aria-hidden="true" />
        </div>
      </div>
      <footer className="social-story-crop-footer">
        <button type="button" onClick={() => changeZoom(zoom - 0.25)} disabled={!ready || zoom <= 1} aria-label="Zoom out"><Minus size={18} /></button>
        <input type="range" min="1" max="12" step="0.05" value={zoom} onChange={event => changeZoom(Number(event.target.value))} disabled={!ready || saving} aria-label="Crop zoom" />
        <button type="button" onClick={() => changeZoom(zoom + 0.25)} disabled={!ready || zoom >= 12} aria-label="Zoom in"><Plus size={18} /></button>
        <span>{Math.round(zoom * 100)}%</span>
      </footer>
    </div>
  );
}
