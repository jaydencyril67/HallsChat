import React, { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';

type ProfileImageCropModalProps = {
  imageUrl: string;
  onCancel: () => void;
  onDone: (file: File) => void | Promise<void>;
  preserveAspectRatio?: boolean;
};

const CROP_SIZE = 340;
const OUTPUT_SIZE = 800;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const ProfileImageCropModal = ({ imageUrl, onCancel, onDone, preserveAspectRatio = false }: ProfileImageCropModalProps) => {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef({ active: false, x: 0, y: 0 });
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number; midpoint: { x: number; y: number }; zoom: number; offset: { x: number; y: number } } | null>(null);
  const [cropSize, setCropSize] = useState({ width: CROP_SIZE, height: CROP_SIZE });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  const getGeometry = () => {
    const image = imageRef.current;
    if (!image?.naturalWidth || !image.naturalHeight) return null;
    const baseScale = Math.max(cropSize.width / image.naturalWidth, cropSize.height / image.naturalHeight);
    const scale = baseScale * zoom;
    return { scale, width: image.naturalWidth * scale, height: image.naturalHeight * scale };
  };

  const setCurrentZoom = (nextZoom: number) => {
    zoomRef.current = nextZoom;
    setZoom(nextZoom);
  };

  const setCurrentOffset = (nextOffset: { x: number; y: number }) => {
    offsetRef.current = nextOffset;
    setOffset(nextOffset);
  };

  const constrainOffset = (next: { x: number; y: number }, activeZoom = zoomRef.current) => {
    const image = imageRef.current;
    if (!image?.naturalWidth || !image.naturalHeight) return next;
    const baseScale = Math.max(cropSize.width / image.naturalWidth, cropSize.height / image.naturalHeight);
    const geometry = {
      width: image.naturalWidth * baseScale * activeZoom,
      height: image.naturalHeight * baseScale * activeZoom,
    };
    return {
      x: clamp(next.x, cropSize.width - geometry.width, 0),
      y: clamp(next.y, cropSize.height - geometry.height, 0),
    };
  };

  useEffect(() => {
    zoomRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setReady(false);
    setCropSize({ width: CROP_SIZE, height: CROP_SIZE });
  }, [imageUrl]);

  const handleImageLoad = () => {
    const image = imageRef.current;
    if (!image?.naturalWidth || !image.naturalHeight) return;
    let nextSize = { width: CROP_SIZE, height: CROP_SIZE };
    if (preserveAspectRatio) {
      const maxWidth = Math.min(window.innerWidth * 0.92, 680);
      const maxHeight = Math.min(window.innerHeight * 0.62, 620);
      const ratio = image.naturalWidth / image.naturalHeight;
      let width = maxWidth;
      let height = width / ratio;
      if (height > maxHeight) { height = maxHeight; width = height * ratio; }
      nextSize = { width, height };
      setCropSize(nextSize);
    } else {
      setCropSize(nextSize);
    }
    const baseScale = Math.max(nextSize.width / image.naturalWidth, nextSize.height / image.naturalHeight);
    const geometry = { width: image.naturalWidth * baseScale, height: image.naturalHeight * baseScale };
    const initialOffset = { x: (nextSize.width - geometry.width) / 2, y: (nextSize.height - geometry.height) / 2 };
    offsetRef.current = initialOffset;
    setOffset(initialOffset);
    setReady(true);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!ready || saving) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size === 1) {
      dragRef.current = { active: true, x: event.clientX, y: event.clientY };
      pinchRef.current = null;
      return;
    }

    if (pointersRef.current.size === 2) {
      dragRef.current.active = false;
      const [first, second] = Array.from(pointersRef.current.values());
      pinchRef.current = {
        distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
        midpoint: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
        zoom: zoomRef.current,
        offset: offsetRef.current,
      };
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!ready || saving || !pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const [first, second] = Array.from(pointersRef.current.values());
      const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
      const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
      const nextZoom = clamp(pinchRef.current.zoom * (distance / pinchRef.current.distance), 1, 12);
      const image = imageRef.current;
      if (image?.naturalWidth && image.naturalHeight) {
        const baseScale = Math.max(cropSize.width / image.naturalWidth, cropSize.height / image.naturalHeight);
        const startScale = baseScale * pinchRef.current.zoom;
        const nextScale = baseScale * nextZoom;
        const imagePointX = (pinchRef.current.midpoint.x - pinchRef.current.offset.x) / startScale;
        const imagePointY = (pinchRef.current.midpoint.y - pinchRef.current.offset.y) / startScale;
        const nextOffset = constrainOffset({
          x: midpoint.x - imagePointX * nextScale,
          y: midpoint.y - imagePointY * nextScale,
        }, nextZoom);
        setCurrentZoom(nextZoom);
        setCurrentOffset(nextOffset);
      } else {
        setCurrentZoom(nextZoom);
      }
      return;
    }

    if (!dragRef.current.active) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    dragRef.current = { active: true, x: event.clientX, y: event.clientY };
    setCurrentOffset(constrainOffset({ x: offsetRef.current.x + dx, y: offsetRef.current.y + dy }));
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* pointer was not captured */ }
    dragRef.current.active = false;
    pinchRef.current = null;
    if (pointersRef.current.size === 1) {
      const remaining = Array.from(pointersRef.current.values())[0];
      dragRef.current = { active: true, x: remaining.x, y: remaining.y };
    }
  };

  const createCroppedFile = async () => {
    const image = imageRef.current;
    const geometry = getGeometry();
    if (!image || !geometry || !ready) return;

    setSaving(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = Math.max(1, Math.round(OUTPUT_SIZE * cropSize.height / cropSize.width));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Unable to prepare the cropped image.');
      const ratio = OUTPUT_SIZE / cropSize.width;
      context.clearRect(0, 0, canvas.width, canvas.height);
      const currentOffset = offsetRef.current;
      context.drawImage(image, currentOffset.x * ratio, currentOffset.y * ratio, geometry.width * ratio, geometry.height * ratio);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) throw new Error('Unable to create the cropped image.');
      await onDone(new File([blob], 'profile-picture.jpg', { type: 'image/jpeg' }));
    } catch (error) {
      console.error('[profile-crop] failed to create cropped image', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Edit profile picture" style={{
      position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '18px', padding: '16px', boxSizing: 'border-box',
      background: 'rgba(0,0,0,0.88)', color: '#fff'
    }}>
      <div style={{ width: '100%', maxWidth: '680px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button type="button" onClick={onCancel} disabled={saving} aria-label="Cancel" style={{ background: 'transparent', border: 0, color: '#fff', padding: 8, cursor: 'pointer' }}><X size={25} /></button>
        <strong style={{ fontSize: '1rem' }}>Edit profile picture</strong>
        <button type="button" onClick={() => void createCroppedFile()} disabled={!ready || saving} aria-label="Done" style={{ background: 'transparent', border: 0, color: '#fff', padding: 8, cursor: ready && !saving ? 'pointer' : 'default' }}><Check size={27} /></button>
      </div>

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          position: 'relative', width: cropSize.width, height: cropSize.height, maxWidth: preserveAspectRatio ? '92vw' : 'min(88vw, 520px)', maxHeight: preserveAspectRatio ? '62vh' : 'min(88vw, 520px)',
          overflow: 'hidden', borderRadius: '24px', background: '#111', touchAction: 'none',
          cursor: saving ? 'default' : 'grab',
          boxShadow: '0 0 0 2px rgba(255,255,255,0.9), 0 0 0 100vmax rgba(0,0,0,0.18)'
        }}
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Profile picture crop preview"
          onLoad={handleImageLoad}
          draggable={false}
          style={{
            position: 'absolute', left: 0, top: 0, width: ready ? getGeometry()?.width : '100%',
            height: ready ? getGeometry()?.height : '100%', maxWidth: 'none', objectFit: 'fill',
            transform: ready ? `translate(${offset.x}px, ${offset.y}px)` : 'none',
            transformOrigin: 'top left', userSelect: 'none', pointerEvents: 'none'
          }}
        />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '24px', boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.8)', pointerEvents: 'none' }} />
      </div>

      <span style={{ fontSize: '0.78rem', opacity: 0.7, textAlign: 'center' }}>{preserveAspectRatio ? 'Pinch to zoom • Drag to crop' : 'Pinch to zoom • Drag to position'}</span>
    </div>
  );
};

export default ProfileImageCropModal;
