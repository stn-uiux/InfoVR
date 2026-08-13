import React, { useState, useRef, useImperativeHandle, forwardRef } from "react";
import type { Point } from "./utils/perspective";
import { warpPerspective } from "./utils/perspective";

interface ImageCropperProps {
  imageSrc: string;
  onCrop: (base64: string) => void;
  onCancel: () => void;
}

export interface ImageCropperRef {
  crop: () => void;
}

export const ImageCropper = forwardRef<ImageCropperRef, ImageCropperProps>(({
  imageSrc,
  onCrop,
  onCancel,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Proportional points (0..1)
  const [points, setPoints] = useState<Point[]>([
    { x: 0.1, y: 0.1 }, // TL
    { x: 0.9, y: 0.1 }, // TR
    { x: 0.9, y: 0.9 }, // BR
    { x: 0.1, y: 0.9 }, // BL
  ]);

  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  
  // Magnifier state
  const [showMagnifier, setShowMagnifier] = useState(false);
  const [magnifierPos, setMagnifierPos] = useState<Point>({ x: 0, y: 0 });
  const [magnifierOffset, setMagnifierOffset] = useState<{x: number, y: number}>({ x: 0, y: 0 });

  const MAGNIFIER_SIZE = 150;
  const ZOOM_LEVEL = 2.5;

  const handlePointerDown = (e: React.PointerEvent, idx: number) => {
    e.preventDefault();
    setDraggingIdx(idx);
    setShowMagnifier(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingIdx === null || !imageRef.current || !containerRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    // Calculate new position as proportion (0..1)
    let x = (e.clientX - rect.left) / rect.width;
    let y = (e.clientY - rect.top) / rect.height;

    // Constrain to 0..1
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));

    const newPoints = [...points];
    newPoints[draggingIdx] = { x, y };
    setPoints(newPoints);

    // Magnifier Logic
    // Mouse coordinates relative to the container for positioning the magnifier
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;

    // Check edges to shift magnifier
    let offsetX = 20; // default offset to right
    let offsetY = 20; // default offset to bottom

    // If too close to right edge, shift left
    if (mouseX + MAGNIFIER_SIZE + 40 > containerRect.width) {
      offsetX = -MAGNIFIER_SIZE - 20;
    }
    // If too close to bottom edge, shift top
    if (mouseY + MAGNIFIER_SIZE + 40 > containerRect.height) {
      offsetY = -MAGNIFIER_SIZE - 20;
    }

    setMagnifierOffset({ x: offsetX, y: offsetY });
    setMagnifierPos({ x: mouseX, y: mouseY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingIdx !== null) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setDraggingIdx(null);
      setShowMagnifier(false);
    }
  };

  useImperativeHandle(ref, () => ({
    crop: handleCrop
  }));

  const handleCrop = async () => {
    if (!imageRef.current) return;
    
    // Natural image dimensions
    const nw = imageRef.current.naturalWidth;
    const nh = imageRef.current.naturalHeight;

    // Convert proportional points to pixel points based on natural size
    const pixelPoints = points.map(p => ({
      x: p.x * nw,
      y: p.y * nh
    }));

    // Calculate destination size (using average width/height of the quadrilateral)
    const w1 = Math.hypot(pixelPoints[0].x - pixelPoints[1].x, pixelPoints[0].y - pixelPoints[1].y);
    const w2 = Math.hypot(pixelPoints[2].x - pixelPoints[3].x, pixelPoints[2].y - pixelPoints[3].y);
    const h1 = Math.hypot(pixelPoints[1].x - pixelPoints[2].x, pixelPoints[1].y - pixelPoints[2].y);
    const h2 = Math.hypot(pixelPoints[3].x - pixelPoints[0].x, pixelPoints[3].y - pixelPoints[0].y);

    const destWidth = Math.round(Math.max(w1, w2));
    const destHeight = Math.round(Math.max(h1, h2));

    try {
      const croppedBase64 = await warpPerspective(imageSrc, pixelPoints, destWidth, destHeight);
      onCrop(croppedBase64);
    } catch (err) {
      console.error(err);
      alert("크롭 처리 중 오류가 발생했습니다.");
    }
  };

  // No need to convert to pixels, use percentages directly in CSS and SVG viewBox.
  const polygonPoints = points.map(p => `${p.x * 100},${p.y * 100}`).join(" ");

  // Background position for magnifier
  let bgPosX = 0;
  let bgPosY = 0;
  let bgSizeX = 0;
  let bgSizeY = 0;

  if (draggingIdx !== null && imageRef.current) {
    const p = points[draggingIdx];
    // Size of the background image scaled up
    bgSizeX = imageRef.current.clientWidth * ZOOM_LEVEL;
    bgSizeY = imageRef.current.clientHeight * ZOOM_LEVEL;
    
    // Center the hovered point in the magnifier
    bgPosX = - (p.x * bgSizeX) + (MAGNIFIER_SIZE / 2);
    bgPosY = - (p.y * bgSizeY) + (MAGNIFIER_SIZE / 2);
  }

  return (
    <div className="sentinel-cropper__image-container" ref={containerRef} style={{position: "relative", width: "100%", height: "100%"}}>
          <img 
            ref={imageRef} 
            src={imageSrc} 
            alt="To crop" 
            className="sentinel-image"
            draggable={false}
          />
          
          {/* SVG Overlay for Lines */}
          <svg className="sentinel-cropper__svg" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 2 }}>
            <polygon 
              points={polygonPoints} 
              fill="rgba(45, 159, 223, 0.1)" 
              stroke="#2d9fdf" 
              strokeWidth="0.5" 
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Draggable Handles */}
          {points.map((p, i) => (
            <div
              key={i}
              className="sentinel-cropper__handle"
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, position: 'absolute', zIndex: 3 }}
              onPointerDown={(e) => handlePointerDown(e, i)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              {/* Crosshair shape */}
              <div className="handle-h" />
              <div className="handle-v" />
            </div>
          ))}
          
          {/* Magnifier */}
          {showMagnifier && (
            <div 
              className="sentinel-cropper__magnifier"
              style={{
                width: MAGNIFIER_SIZE,
                height: MAGNIFIER_SIZE,
                left: magnifierPos.x + magnifierOffset.x,
                top: magnifierPos.y + magnifierOffset.y,
                backgroundImage: `url(${imageSrc})`,
                backgroundSize: `${bgSizeX}px ${bgSizeY}px`,
                backgroundPosition: `${bgPosX}px ${bgPosY}px`,
                backgroundRepeat: 'no-repeat'
              }}
            >
              <div className="magnifier-crosshair-h" />
              <div className="magnifier-crosshair-v" />
            </div>
          )}
        </div>
  );
});
