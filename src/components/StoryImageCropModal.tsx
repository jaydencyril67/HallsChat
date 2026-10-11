import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Check, X } from "lucide-react";

type StoryImageCropModalProps = {
  imageUrl: string;
  onCancel: () => void;
  onDone: (file: File) => void | Promise<void>;
  title?: string;
  aspectRatio?: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function StoryImageCropModal({ imageUrl, onCancel, onDone, title = "Edit story photo", aspectRatio }: StoryImageCropModalProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<{ distance: number; midpoint: { x: number; y: number }; zoom: number; offset: { x: number; y: number } } | null>(null);
  const dragRef = useRef<{ x: number; y: number; offset: { x: number; y: number } } | null>(null);
  const zoomRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const [frame, setFrame] = useState({ width: 320, height: 320 });
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    zoomRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    setReady(false);
    pointersRef.current.clear();
    gestureRef.current = null;
    dragRef.current = null;
    setErrorMessage("");
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


  const handleImageLoad = () => {
    const image = imageRef.current;
    if (!image?.naturalWidth || !image.naturalHeight) return;
    const maxWidth = Math.max(200, Math.min(window.innerWidth * 0.92, 900));
    const maxHeight = Math.max(180, Math.min(window.innerHeight * 0.76, 900));
    let width: number;
    let height: number;
    if (typeof aspectRatio === "number" && aspectRatio > 0) {
      width = maxWidth;
      height = width / aspectRatio;
      if (height > maxHeight) {
        height = maxHeight;
        width = height * aspectRatio;
      }
    } else {
      const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
      width = image.naturalWidth * scale;
      height = image.naturalHeight * scale;
    }
    const nextFrame = { width: Math.max(1, width), height: Math.max(1, height) };
    const scale = Math.max(nextFrame.width / image.naturalWidth, nextFrame.height / image.naturalHeight);
    const initialOffset = {
      x: (nextFrame.width - image.naturalWidth * scale) / 2,
      y: (nextFrame.height - image.naturalHeight * scale) / 2,
    };
    setFrame(nextFrame);
    zoomRef.current = 1;
    offsetRef.current = initialOffset;
    setReady(true);
  };

  const syncImageStyles = (activeZoom = zoomRef.current) => {
    const image = imageRef.current;
    const drawn = geometry(activeZoom);
    if (!image || !drawn) return;
    image.style.width = `${drawn.width}px`;
    image.style.height = `${drawn.height}px`;
    image.style.transform = `translate3d(${offsetRef.current.x}px, ${offsetRef.current.y}px, 0)`;
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!ready || saving) return;
    setErrorMessage("");
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Continue with pointer events if capture is unavailable. */ }
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
      syncImageStyles(nextZoom);
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
    syncImageStyles();
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
    setErrorMessage("");
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
      setErrorMessage(error instanceof Error ? error.message : "Couldn’t crop this photo. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="social-story-crop-overlay">
      <header className="social-story-crop-header">
        <button type="button" onClick={onCancel} disabled={saving} aria-label="Cancel photo edit"><X size={23} /></button>
        <div><strong>{title}</strong></div>
        <button type="button" onClick={() => void saveCrop()} disabled={!ready || saving} aria-label="Apply crop">{saving ? "…" : <Check size={25} />}</button>
      </header>
      <div className="social-story-crop-stage">
        <div
          className="social-story-crop-frame"
          style={{ width: frame.width, height: frame.height, maxWidth: "92vw", maxHeight: "76dvh", aspectRatio: typeof aspectRatio === "number" && aspectRatio > 0 ? aspectRatio : undefined }}
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
              transform: `translate3d(${offsetRef.current.x}px, ${offsetRef.current.y}px, 0)`,
            }}
          />
          <div className="social-story-crop-grid" aria-hidden="true" />
        </div>
      </div>
      {errorMessage && <div className="social-story-crop-error" role="alert">{errorMessage}</div>}
      <footer className="social-story-crop-bottom" aria-hidden="true"><span /></footer>
    </div>
  );
}
