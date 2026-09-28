/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback, memo } from "react";
import { GoogleGenAI, Type } from "@google/genai";
import localforage from "localforage";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import PortBox from "./components/PortBox";
import { ImageCropper, type ImageCropperRef } from "./ImageCropper";

import { motion, AnimatePresence } from "motion/react";

const ai = new GoogleGenAI({
  apiKey: (import.meta.env.VITE_GEMINI_API_KEY || "").trim().replace(/[^\x20-\x7E]/g, ""),
});

export interface PortData {
  portName: string; // e.g., 'Mgmt', 'Ethernet', 'Console'
  portNumber: string | number;
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax]
  cropUrl?: string; // Extracted image data URL
  svgPath?: string; // Custom SVG path data if imported
  svgType?: "ethernet" | "sfp";
}

interface PortWizardEditorProps {
  initialImage: string | null;
  initialPorts: PortData[];
  initialAnalysis: string;
  initialPast: PortData[][];
  initialFuture: PortData[][];
  initialDownloadFileName: string;
  originalFileName: string;
  sessionStatus?: "pending" | "analyzing" | "completed" | "error";
  sessionError?: string | null;
  onStateChange: (state: any) => void;
  onRetryAnalysis?: () => void;
  onMultiUpload?: (files: File[]) => void;
  leftSidebar?: React.ReactNode;
}

const SidebarItem = memo(({
  port,
  originalIdx,
  isActive,
  isSelected,
  setActivePort,
  setSelectedIndices
}: {
  port: PortData;
  originalIdx: number;
  isActive: boolean;
  isSelected: boolean;
  setActivePort: (idx: number | null) => void;
  setSelectedIndices: React.Dispatch<React.SetStateAction<number[]>>;
}) => (
  <div
    id={`port-list-item-${originalIdx}`}
    className={`wizard-reg-item ${isActive || isSelected ? "wizard-reg-item--active" : ""}`}
    onMouseEnter={() => setActivePort(originalIdx)}
    onMouseLeave={() => setActivePort(null)}
    onClick={() => {
      if (isSelected) {
        setSelectedIndices((prev) => prev.filter((i) => i !== originalIdx));
      } else {
        setSelectedIndices((prev) => [...prev, originalIdx]);
      }
    }}
  >
    <div className="wizard-reg-item__content">
      <div className="wizard-reg-item__badge">{port.portNumber}</div>
      <div className="wizard-reg-item__details">
        <span className="wizard-reg-item__name">{port.portName || "UNNAMED"}</span>
        <div className="wizard-reg-item__coords">
          <span className="wizard-reg-item__coord">X{Math.round(port.box_2d[1])}</span>
          <span className="wizard-reg-item__coord">Y{Math.round(port.box_2d[0])}</span>
        </div>
      </div>
    </div>
    <div className="wizard-reg-item__actions"></div>
  </div>
));

// 포트맵핑 마법사 에디터 뷰
export default function PortWizardEditor({
  initialImage,
  initialPorts,
  initialAnalysis,
  initialPast,
  initialFuture,
  initialDownloadFileName,
  originalFileName,
  sessionStatus,
  sessionError,
  onStateChange,
  onRetryAnalysis,
  onMultiUpload,
  leftSidebar
}: PortWizardEditorProps) {
  const navigate = useNavigate();
  const [image, _setImage] = useState<string | null>(initialImage);
  const [isCropping, setIsCropping] = useState(false);
  const [analysis, _setAnalysis] = useState<string>(initialAnalysis);
  const [ports, _setPorts] = useState<PortData[]>(initialPorts);
  const [loading, setLoading] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState<string[]>([]);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: 1000, height: 800 });
  const [editMode, setEditMode] = useState(initialPorts.length > 0);
  const [activePort, setActivePort] = useState<number | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [selectionBox, setSelectionBox] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const [zoom, setZoom] = useState(1);

  // Download Modal State
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadFileName, _setDownloadFileName] = useState(initialDownloadFileName);

  // Wrappers for setters to flag internal updates
  const setPorts = (val: React.SetStateAction<PortData[]>) => {
    isInternalUpdate.current = true;
    _setPorts(val);
  };
  const setImage = (val: React.SetStateAction<string | null>) => {
    isInternalUpdate.current = true;
    _setImage(val);
  };
  const setAnalysis = (val: React.SetStateAction<string>) => {
    isInternalUpdate.current = true;
    _setAnalysis(val);
  };
  const setDownloadFileName = (val: React.SetStateAction<string>) => {
    isInternalUpdate.current = true;
    _setDownloadFileName(val);
  };

  // History management for Undo/Redo
  const [past, _setPast] = useState<PortData[][]>(initialPast);
  const [future, _setFuture] = useState<PortData[][]>(initialFuture);
  const setPast = (val: React.SetStateAction<PortData[][]>) => {
    isInternalUpdate.current = true;
    _setPast(val);
  };
  const setFuture = (val: React.SetStateAction<PortData[][]>) => {
    isInternalUpdate.current = true;
    _setFuture(val);
  };
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(),
  );

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const toggleAllCategories = useCallback(() => {
    const allCategoriesArray = Array.from(
      new Set(ports.map((p) => p.portName || "UNNAMED")),
    );
    setCollapsedCategories((prev) => {
      if (
        prev.size >= allCategoriesArray.length &&
        allCategoriesArray.length > 0
      ) {
        return new Set(); // Expand All
      }
      return new Set(allCategoriesArray); // Collapse All
    });
  }, [ports]);

  // Stable refs for event handlers to prevent memoization breakage during rapid drag drops
  const portsRef = useRef(ports);
  const selectedIndicesRef = useRef(selectedIndices);
  const imageSizeRef = useRef(imageSize);

  useEffect(() => {
    portsRef.current = ports;
  }, [ports]);
  useEffect(() => {
    selectedIndicesRef.current = selectedIndices;
  }, [selectedIndices]);
  useEffect(() => {
    imageSizeRef.current = imageSize;
  }, [imageSize]);

  // Auto-sync state from parent (e.g. background analysis completion)
  useEffect(() => {
    if (initialImage && initialImage !== image) _setImage(initialImage);
    if (initialPorts !== ports) _setPorts(initialPorts);
    if (initialAnalysis !== analysis) _setAnalysis(initialAnalysis);
    if (initialDownloadFileName !== downloadFileName) _setDownloadFileName(initialDownloadFileName);
    if (initialPast !== past) _setPast(initialPast);
    if (initialFuture !== future) _setFuture(initialFuture);
  }, [initialImage, initialPorts, initialAnalysis, initialDownloadFileName, initialPast, initialFuture]);

  // Auto-sync state to parent
  // We use a ref to prevent infinite loops when syncing back and forth
  const isInternalUpdate = useRef(false);

  useEffect(() => {
    if (isInternalUpdate.current) {
      onStateChange({
        image,
        ports,
        analysis,
        past,
        future,
        downloadFileName
      });
      isInternalUpdate.current = false;
    }
  }, [image, ports, analysis, past, future, downloadFileName]);

  const saveHistory = useCallback(() => {
    setPast((prev) => [...prev, [...portsRef.current]]);
    setFuture([]);
  }, []);

  const undo = () => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);

    setFuture((prev) => [[...ports], ...prev]);
    setPorts(previous);
    setPast(newPast);
    setSelectedIndices([]);
    setActivePort(null);
  };

  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);

    setPast((prev) => [...prev, [...ports]]);
    setPorts(next);
    setFuture(newFuture);
    setSelectedIndices([]);
    setActivePort(null);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropperRef = useRef<ImageCropperRef>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTo({
        top: logsContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [loadingLogs]);

  // Dynamic loading messages to keep user informed
  useEffect(() => {
    let messageInterval: NodeJS.Timeout;
    let progressInterval: NodeJS.Timeout;
    if (loading) {
      setLoadingStep(0);
      const messages = [
        "> Initializing neural engine...",
        "> Scanning hardware layers...",
        "> Identifying port grid structure...",
        "> Extracting precise coordinates...",
        "> Matching port labels...",
        "> Finalizing neural mapping...",
        "> Optimizing tensor weights...",
      ];
      setLoadingLogs([messages[0]]);

      let msgIndex = 0;
      messageInterval = setInterval(() => {
        msgIndex++;
        if (msgIndex < messages.length) {
          setLoadingLogs((prev) => [...prev, messages[msgIndex]]);
        }
      }, 1500);

      progressInterval = setInterval(() => {
        setLoadingStep((prev) => {
          if (prev < 40) return prev + Math.random() * 10;
          if (prev < 80) return prev + Math.random() * 5;
          if (prev < 95) return prev + Math.random() * 2;
          if (prev < 98) return prev + 0.2;
          return prev;
        });
      }, 400);
    } else {
      setLoadingStep(100);
      const to = setTimeout(() => {
        setLoadingStep(0);
      }, 500);
      return () => clearTimeout(to);
    }
    return () => {
      clearInterval(messageInterval);
      clearInterval(progressInterval);
    };
  }, [loading]);

  useEffect(() => {
    if (sessionStatus === "analyzing" || sessionStatus === "pending") {
      setLoading(true);
      setError(null);
    } else {
      setLoading(false);
      if (sessionStatus === "error") {
        setError(sessionError || "Failed to analyze");
      }
    }
  }, [sessionStatus, sessionError]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (onMultiUpload) {
        onMultiUpload(Array.from(files));
        return;
      }
      const file = files[0];
      if (file.type === "image/svg+xml") {
        const reader = new FileReader();
        reader.onloadend = () => {
          try {
            const svgContent = reader.result as string;
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgContent, "image/svg+xml");

            // Check if this SVG is from our app (has data-local-port or port-hitbox class)
            const isOurFormat =
              doc.querySelectorAll("path[data-local-port], .port-hitbox")
                .length > 0;
            const targetSelector = isOurFormat
              ? "path[data-local-port], .port-hitbox"
              : "path, rect, polygon, circle, ellipse";

            const container = document.createElement("div");
            container.style.visibility = "hidden";
            container.style.position = "absolute";
            container.style.width = "0px";
            container.style.height = "0px";
            container.style.overflow = "hidden";
            container.innerHTML = svgContent;
            document.body.appendChild(container);

            const svgEl = container.querySelector("svg");
            let svgWidth = 1000;
            let svgHeight = 1000;

            if (svgEl) {
              const viewBox = svgEl.viewBox?.baseVal;
              if (viewBox && viewBox.width && viewBox.height) {
                svgWidth = viewBox.width;
                svgHeight = viewBox.height;
              } else if (
                svgEl.width?.baseVal?.value &&
                svgEl.height?.baseVal?.value
              ) {
                svgWidth = svgEl.width.baseVal.value;
                svgHeight = svgEl.height.baseVal.value;
              }
            }

            // Extract background if any
            const imgTag = doc.querySelector("image");
            let backgroundUrl = "";
            if (imgTag && imgTag.getAttribute("href")) {
              backgroundUrl = imgTag.getAttribute("href")!;
            } else {
              const base64Svg = btoa(unescape(encodeURIComponent(svgContent)));
              backgroundUrl = `data:image/svg+xml;base64,${base64Svg}`;
            }

            const parsedPorts: PortData[] = [];

            const elements = container.querySelectorAll(targetSelector);
            elements.forEach((el, index) => {
              if (el.tagName.toLowerCase() === "image") return;
              try {
                const bbox = (el as SVGGraphicsElement).getBBox();

                if (!isOurFormat) {
                  // Filter out background-sized rectangles or extreme noise
                  if (
                    bbox.width > svgWidth * 0.95 &&
                    bbox.height > svgHeight * 0.95
                  )
                    return;
                  if (bbox.width < 5 || bbox.height < 5) return;
                }

                if (bbox.width > 0 && bbox.height > 0) {
                  const xmin = (bbox.x / svgWidth) * 1000;
                  const ymin = (bbox.y / svgHeight) * 1000;
                  const xmax = ((bbox.x + bbox.width) / svgWidth) * 1000;
                  const ymax = ((bbox.y + bbox.height) / svgHeight) * 1000;

                  const targetType = el.tagName.toLowerCase();
                  const autoName = targetType === "path" ? "port" : targetType;

                  const portName =
                    el.getAttribute("data-port-type") ||
                    el.getAttribute("data-port-name") ||
                    autoName;
                  const portNumber =
                    el.getAttribute("data-local-port") ||
                    el.getAttribute("data-port-number") ||
                    `${index + 1}`;
                  const svgPath =
                    targetType === "path"
                      ? el.getAttribute("d") || undefined
                      : undefined;

                  parsedPorts.push({
                    portName,
                    portNumber,
                    box_2d: [ymin, xmin, ymax, xmax],
                    svgPath,
                  });
                }
              } catch (_e) {
                // Ignore elements that don't support getBBox
              }
            });

            document.body.removeChild(container);

            setImage(backgroundUrl);
            if (parsedPorts.length > 0) {
              setPorts(parsedPorts);
              setAnalysis(
                `Imported ${parsedPorts.length} vector paths as ports.`,
              );
              setEditMode(true);
            } else {
              setPorts([]);
              setAnalysis("No valid paths found in SVG.");
              setEditMode(false);
            }
            setPast([]);
            setFuture([]);
            setError(null);
          } catch (err) {
            console.error("Error parsing SVG:", err);
            setError("Failed to parse SVG paths");
          }
        };
        reader.readAsText(file);
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setAnalysis("");
        setPorts([]);
        setPast([]);
        setFuture([]);
        setError(null);
        setEditMode(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setImage(null);
    setAnalysis("");
    setPorts([]);
    setPast([]);
    setFuture([]);
    setError(null);
    setEditMode(false);
    setSelectedIndices([]);
    setActivePort(null);
  };

  const analyzeImage = async () => { if (!image) return; if (onRetryAnalysis) onRetryAnalysis(); };

  const executeDownload = async () => {
    if (!image || ports.length === 0) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = image;

    await new Promise((resolve) => {
      img.onload = resolve;
    });

    let exportWidth = img.naturalWidth;
    let exportHeight = img.naturalHeight;

    // Scale down if width exceeds 1000px
    if (exportWidth > 1000) {
      exportHeight = Math.round(exportHeight * (1000 / exportWidth));
      exportWidth = 1000;
    }

    // Draw to canvas to resize and compress
    const canvas = document.createElement("canvas");
    canvas.width = exportWidth;
    canvas.height = exportHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(img, 0, 0, exportWidth, exportHeight);
    }

    // Compress as WebP (supports transparency, falls back to PNG if unsupported)
    const compressedImage = canvas.toDataURL("image/webp", 0.85);

    // 1. Generate SVG Paths for ports
    const paths = ports
      .map((port) => {
        const [ymin, xmin, ymax, xmax] = port.box_2d;
        const x = (xmin / 1000) * exportWidth;
        const y = (ymin / 1000) * exportHeight;
        const w = ((xmax - xmin) / 1000) * exportWidth;
        const h = ((ymax - ymin) / 1000) * exportHeight;

        // Create a rectangle path: Move to (x,y), Horizontal to (x+w), Vertical to (y+h), Horizontal to (x), Close path
        const pathData = `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;

        return `    <path 
      class="port-hitbox"
      data-port-type="${port.portName || "port"}"
      data-local-port="${port.portNumber}"
      d="${pathData}" 
      fill="none"
      stroke="none"
    />`;
      })
      .join("\n");

    // 2. Construct the full SVG string
    const svgString = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="${exportWidth}" height="${exportHeight}" viewBox="0 0 ${exportWidth} ${exportHeight}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <title>Hardware Port Analysis</title>
  <!-- Original Image Background -->
  <image href="${compressedImage}" xlink:href="${compressedImage}" width="${exportWidth}" height="${exportHeight}" />
  
  <!-- Port Analysis Paths -->
  <g id="ports-layer">
${paths}
  </g>
</svg>`;

    // 3. Trigger SVG download
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    let finalFileName = downloadFileName.trim() || "hardware-ports";
    if (!finalFileName.toLowerCase().endsWith(".svg")) {
      finalFileName += ".svg";
    }
    link.download = finalFileName;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    setShowDownloadModal(false);
  };

  // Function to extract individual port images using Canvas
  // Add keyboard nudging
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editMode || selectedIndices.length === 0) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      const step = e.shiftKey ? 10 : 1; // 1px normal, 10px with shift
      let dx = 0;
      let dy = 0;

      if (e.key === "ArrowUp") dy = -step;
      else if (e.key === "ArrowDown") dy = step;
      else if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;
      else return;

      e.preventDefault();

      const normDx = (dx / (imageSize.width || 1000)) * 1000;
      const normDy = (dy / (imageSize.height || 1000)) * 1000;

      setPorts((prev) => {
        const next = [...prev];
        selectedIndices.forEach((idx) => {
          const box = next[idx].box_2d;

          if (e.ctrlKey) {
            // Resize (modify width/height by changing bottom/right edges)
            next[idx] = {
              ...next[idx],
              box_2d: [
                box[0],
                box[1],
                Math.max(box[0] + 1, Math.min(1000, box[2] + normDy)),
                Math.max(box[1] + 1, Math.min(1000, box[3] + normDx)),
              ],
            };
          } else {
            // Move
            next[idx] = {
              ...next[idx],
              box_2d: [
                Math.max(0, Math.min(1000, box[0] + normDy)),
                Math.max(0, Math.min(1000, box[1] + normDx)),
                Math.max(0, Math.min(1000, box[2] + normDy)),
                Math.max(0, Math.min(1000, box[3] + normDx)),
              ],
            };
          }
        });
        return next;
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editMode, selectedIndices, imageSize]);

  const handleDrag = useCallback(
    (idx: number, e: React.MouseEvent) => {
      if (!editMode || !containerRef.current) return;

      // Save history before drag starts
      saveHistory();

      const startX = e.clientX;
      const startY = e.clientY;

      const currentSelected = selectedIndicesRef.current;
      const currentPorts = portsRef.current;
      const currentImageSize = imageSizeRef.current;

      // Determine which ports to move
      let targetIndices = currentSelected.includes(idx)
        ? currentSelected
        : [idx];

      // If clicking a new port without modifier keys, select only it
      if (
        !currentSelected.includes(idx) &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey
      ) {
        setSelectedIndices([idx]);
        targetIndices = [idx];
      }

      const originalBoxes = targetIndices.map((i) => ({
        index: i,
        box: [...currentPorts[i].box_2d] as [number, number, number, number],
        element: document.getElementById(`port-box-${i}`)
      }));

      let hasMoved = false;

      const onMouseMove = (moveEvent: MouseEvent) => {
        hasMoved = true;
        const dx =
          ((moveEvent.clientX - startX) / currentImageSize.width) * 1000;
        const dy =
          ((moveEvent.clientY - startY) / currentImageSize.height) * 1000;

        originalBoxes.forEach(({ box, element }) => {
          if (element) {
            const newYmin = Math.max(0, Math.min(1000, box[0] + dy));
            const newXmin = Math.max(0, Math.min(1000, box[1] + dx));
            const newYmax = Math.max(0, Math.min(1000, box[2] + dy));
            const newXmax = Math.max(0, Math.min(1000, box[3] + dx));

            const left = (newXmin / 1000) * currentImageSize.width;
            const top = (newYmin / 1000) * currentImageSize.height;
            const width = ((newXmax - newXmin) / 1000) * currentImageSize.width;
            const height = ((newYmax - newYmin) / 1000) * currentImageSize.height;
            
            element.style.left = `${left}px`;
            element.style.top = `${top}px`;
            element.style.width = `${width}px`;
            element.style.height = `${height}px`;
          }
        });
      };

      const onMouseUp = (moveEvent: MouseEvent) => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);

        if (hasMoved) {
          const dx = ((moveEvent.clientX - startX) / currentImageSize.width) * 1000;
          const dy = ((moveEvent.clientY - startY) / currentImageSize.height) * 1000;
          
          setPorts((prev) => {
            const next = [...prev];
            originalBoxes.forEach(({ index, box }) => {
              next[index] = {
                ...next[index],
                box_2d: [
                  Math.max(0, Math.min(1000, box[0] + dy)),
                  Math.max(0, Math.min(1000, box[1] + dx)),
                  Math.max(0, Math.min(1000, box[2] + dy)),
                  Math.max(0, Math.min(1000, box[3] + dx)),
                ],
              };
            });
            return next;
          });
        } else {
          setTimeout(() => {
            if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
              setSelectedIndices([idx]);
            }
          }, 0);
        }
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [editMode, saveHistory],
  );

  const handleResize = useCallback(
    (idx: number, e: React.MouseEvent) => {
      if (!editMode || !containerRef.current) return;

      // Save history before drag starts
      saveHistory();

      const startX = e.clientX;
      const startY = e.clientY;

      const currentPorts = portsRef.current;
      const currentImageSize = imageSizeRef.current;

      const originalBox = [...currentPorts[idx].box_2d] as [
        number,
        number,
        number,
        number,
      ];
      const element = document.getElementById(`port-box-${idx}`);
      let hasMoved = false;

      const onMouseMove = (moveEvent: MouseEvent) => {
        hasMoved = true;
        const dx =
          ((moveEvent.clientX - startX) / currentImageSize.width) * 1000;
        const dy =
          ((moveEvent.clientY - startY) / currentImageSize.height) * 1000;

        if (element) {
          const newYmin = originalBox[0];
          const newXmin = originalBox[1];
          const newYmax = Math.max(originalBox[0] + 10, Math.min(1000, originalBox[2] + dy));
          const newXmax = Math.max(originalBox[1] + 10, Math.min(1000, originalBox[3] + dx));

          const width = ((newXmax - newXmin) / 1000) * currentImageSize.width;
          const height = ((newYmax - newYmin) / 1000) * currentImageSize.height;
          
          element.style.width = `${width}px`;
          element.style.height = `${height}px`;
        }
      };

      const onMouseUp = (moveEvent: MouseEvent) => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);

        if (hasMoved) {
          const dx = ((moveEvent.clientX - startX) / currentImageSize.width) * 1000;
          const dy = ((moveEvent.clientY - startY) / currentImageSize.height) * 1000;

          setPorts((prev) => {
            const next = [...prev];
            next[idx] = {
              ...next[idx],
              box_2d: [
                originalBox[0],
                originalBox[1],
                Math.max(originalBox[0] + 10, Math.min(1000, originalBox[2] + dy)),
                Math.max(originalBox[1] + 10, Math.min(1000, originalBox[3] + dx)),
              ],
            };
            return next;
          });
        }
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [editMode, saveHistory],
  );

  const handlePortDragStart = useCallback(
    (i: number, e: React.MouseEvent) => {
      e.stopPropagation();
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        setSelectedIndices((prev) =>
          prev.includes(i) ? prev.filter((v) => v !== i) : [...prev, i],
        );
      } else {
        handleDrag(i, e);
      }
    },
    [handleDrag],
  );

  const handlePortResizeStart = useCallback(
    (i: number, e: React.MouseEvent) => {
      e.stopPropagation();
      handleResize(i, e);
    },
    [handleResize],
  );

  const handlePortDelete = useCallback(
    (i: number, e: React.MouseEvent) => {
      e.stopPropagation();
      saveHistory();
      setPorts((prev) =>
        prev.filter((_, index) => (index === i ? false : true)),
      );
      setSelectedIndices([]);
    },
    [saveHistory],
  );

  const handlePortNameChange = useCallback((i: number, name: string) => {
    setPorts((prev) =>
      prev.map((p, index) => (index === i ? { ...p, portName: name } : p)),
    );
  }, []);

  const handlePortNumberChange = useCallback((i: number, num: string) => {
    setPorts((prev) =>
      prev.map((p, index) => (index === i ? { ...p, portNumber: num } : p)),
    );
  }, []);

  const handlePortSvgTypeChange = useCallback(
    (i: number, newType: "ethernet" | "sfp" | undefined) => {
      setPorts((prev) =>
        prev.map((p, index) => (index === i ? { ...p, svgType: newType } : p)),
      );
    },
    [],
  );

  const handlePortWidthChange = useCallback((i: number, val: number) => {
    setPorts((prev) =>
      prev.map((p, index) =>
        index === i
          ? {
            ...p,
            box_2d: [
              p.box_2d[0],
              p.box_2d[1],
              p.box_2d[2],
              Math.min(1000, p.box_2d[1] + val),
            ],
          }
          : p,
      ),
    );
  }, []);

  const handlePortHeightChange = useCallback((i: number, val: number) => {
    const currentImageSize = imageSizeRef.current;
    const vHeight =
      currentImageSize.width > 0
        ? (currentImageSize.height / currentImageSize.width) * 1000
        : 1000;
    const normH = (val / vHeight) * 1000;
    setPorts((prev) =>
      prev.map((p, index) =>
        index === i
          ? {
            ...p,
            box_2d: [
              p.box_2d[0],
              p.box_2d[1],
              Math.min(1000, p.box_2d[0] + normH),
              p.box_2d[3],
            ],
          }
          : p,
      ),
    );
  }, []);

  const handlePortMouseEnter = useCallback((i: number) => {
    setActivePort(i);
    // Auto-scroll to the port list item
    const el = document.getElementById(`port-list-item-${i}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, []);
  const handlePortMouseLeave = useCallback(() => setActivePort(null), []);

  const handleSelectionDrag = (e: React.MouseEvent) => {
    if (!editMode || !imageRef.current) return;

    // Stop from bubbling to container's catch-all onClick
    e.stopPropagation();

    const wrapper = imageRef.current.parentElement;
    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const x1 = e.clientX - rect.left;
    const y1 = e.clientY - rect.top;

    const startingSelected =
      e.shiftKey || e.ctrlKey || e.metaKey ? [...selectedIndices] : [];
    let hasMoved = false;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const x2 = moveEvent.clientX - rect.left;
      const y2 = moveEvent.clientY - rect.top;

      const dist = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      if (dist > 5) hasMoved = true;

      setSelectionBox({ x1, y1, x2, y2 });

      const left = Math.min(x1, x2);
      const top = Math.min(y1, y2);
      const right = Math.max(x1, x2);
      const bottom = Math.max(y1, y2);

      const newlySelected: number[] = [...startingSelected];
      ports.forEach((port, index) => {
        const [pYmin, pXmin, pYmax, pXmax] = port.box_2d;
        const pLeft = (pXmin / 1000) * imageSize.width;
        const pTop = (pYmin / 1000) * imageSize.height;
        const pWidth = ((pXmax - pXmin) / 1000) * imageSize.width;
        const pHeight = ((pYmax - pYmin) / 1000) * imageSize.height;

        if (
          pLeft < right &&
          pLeft + pWidth > left &&
          pTop < bottom &&
          pTop + pHeight > top
        ) {
          if (!newlySelected.includes(index)) {
            newlySelected.push(index);
          }
        }
      });
      setSelectedIndices(newlySelected);
    };

    const onMouseUp = () => {
      setSelectionBox(null);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);

      // If it was just a click (not a drag), and modifier wasn't pressed, clear selection
      if (!hasMoved && !(e.shiftKey || e.ctrlKey || e.metaKey)) {
        setSelectedIndices([]);
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const duplicateGroupSelected = () => {
    if (selectedIndices.length === 0) return;

    saveHistory();
    setPorts((prev) => {
      const newPorts = [...prev];
      const addedIndices: number[] = [];

      [...selectedIndices]
        .sort((a, b) => a - b)
        .forEach((idx) => {
          const source = prev[idx];

          let newPortNumber = source.portNumber;

          const duplicated: PortData = {
            ...source,
            portNumber: newPortNumber,
            box_2d: [
              Math.min(1000, source.box_2d[0] + 20),
              Math.min(1000, source.box_2d[1] + 20),
              Math.min(1000, source.box_2d[2] + 20),
              Math.min(1000, source.box_2d[3] + 20),
            ],
            cropUrl: undefined,
          };
          newPorts.push(duplicated);
          addedIndices.push(newPorts.length - 1);
        });

      setSelectedIndices(addedIndices);
      return newPorts;
    });
  };

  const duplicatePortSelected = () => {
    if (selectedIndices.length === 0) return;

    saveHistory();
    setPorts((prev) => {
      const newPorts = [...prev];
      const addedIndices: number[] = [];
      const usedNumbersMap: Record<string, Set<number>> = {};

      // Analyze all existing ports to find missing numbers for trailing sequences
      prev.forEach((p) => {
        const keyBase = p.portName || "port";
        const str = String(p.portNumber);
        const m = str.match(/^(.*?)(\d+)([^\d]*)$/);
        if (m) {
          const prefixKey = `${keyBase}::${m[1]}::${m[3]}`;
          if (!usedNumbersMap[prefixKey]) usedNumbersMap[prefixKey] = new Set();
          usedNumbersMap[prefixKey].add(parseInt(m[2], 10));
        }
      });

      [...selectedIndices]
        .sort((a, b) => a - b)
        .forEach((idx) => {
          const source = prev[idx];
          const keyBase = source.portName || "port";
          const sourceStr = String(source.portNumber);

          let newPortNumber: string | number;
          const match = sourceStr.match(/^(.*?)(\d+)([^\d]*)$/);

          if (match) {
            const prefixKey = `${keyBase}::${match[1]}::${match[3]}`;
            if (!usedNumbersMap[prefixKey])
              usedNumbersMap[prefixKey] = new Set();

            let targetNum = 1;
            while (usedNumbersMap[prefixKey].has(targetNum)) {
              targetNum++;
            }

            usedNumbersMap[prefixKey].add(targetNum);
            newPortNumber = `${match[1]}${targetNum}${match[3]}`;
          } else if (sourceStr.trim() === "") {
            newPortNumber = 1;
          } else {
            newPortNumber = `${sourceStr} (1)`;
          }

          const duplicated: PortData = {
            ...source,
            portNumber: newPortNumber,
            box_2d: [
              Math.min(1000, source.box_2d[0] + 20),
              Math.min(1000, source.box_2d[1] + 20),
              Math.min(1000, source.box_2d[2] + 20),
              Math.min(1000, source.box_2d[3] + 20),
            ],
            cropUrl: undefined,
          };
          newPorts.push(duplicated);
          addedIndices.push(newPorts.length - 1);
        });

      setSelectedIndices(addedIndices);
      return newPorts;
    });
  };

  const alignSelected = (
    type:
      | "top"
      | "bottom"
      | "left"
      | "right"
      | "h-center"
      | "v-center"
      | "distribute-h"
      | "distribute-v",
  ) => {
    if (selectedIndices.length < 2) return;

    saveHistory();
    setPorts((prev) => {
      const next = [...prev];
      const selectedPorts = selectedIndices.map((i) => next[i]);

      if (type === "distribute-h" && selectedIndices.length > 2) {
        // Sort indices by their current X position
        const sortedIndices = [...selectedIndices].sort(
          (a, b) => next[a].box_2d[1] - next[b].box_2d[1],
        );
        const first = next[sortedIndices[0]];
        const last = next[sortedIndices[sortedIndices.length - 1]];

        // Calculate total available gap
        const totalDistance = last.box_2d[1] - first.box_2d[1];
        const step = totalDistance / (sortedIndices.length - 1);

        sortedIndices.forEach((idx, stepIndex) => {
          if (stepIndex === 0 || stepIndex === sortedIndices.length - 1) return; // Keep first and last in place
          const box = [...next[idx].box_2d];
          const w = box[3] - box[1];
          const newX = first.box_2d[1] + step * stepIndex;
          next[idx] = {
            ...next[idx],
            box_2d: [box[0], newX, box[2], newX + w],
          };
        });
        return next;
      }

      if (type === "distribute-v" && selectedIndices.length > 2) {
        // Sort indices by their current Y position
        const sortedIndices = [...selectedIndices].sort(
          (a, b) => next[a].box_2d[0] - next[b].box_2d[0],
        );
        const first = next[sortedIndices[0]];
        const last = next[sortedIndices[sortedIndices.length - 1]];

        // Calculate total available gap
        const totalDistance = last.box_2d[0] - first.box_2d[0];
        const step = totalDistance / (sortedIndices.length - 1);

        sortedIndices.forEach((idx, stepIndex) => {
          if (stepIndex === 0 || stepIndex === sortedIndices.length - 1) return; // Keep first and last in place
          const box = [...next[idx].box_2d];
          const h = box[2] - box[0];
          const newY = first.box_2d[0] + step * stepIndex;
          next[idx] = {
            ...next[idx],
            box_2d: [newY, box[1], newY + h, box[3]],
          };
        });
        return next;
      }

      let targetValue = 0;
      if (type === "top")
        targetValue = Math.min(...selectedPorts.map((p) => p.box_2d[0]));
      if (type === "bottom")
        targetValue = Math.max(...selectedPorts.map((p) => p.box_2d[2]));
      if (type === "left")
        targetValue = Math.min(...selectedPorts.map((p) => p.box_2d[1]));
      if (type === "right")
        targetValue = Math.max(...selectedPorts.map((p) => p.box_2d[3]));

      if (type === "h-center") {
        const centers = selectedPorts.map(
          (p) => (p.box_2d[1] + p.box_2d[3]) / 2,
        );
        targetValue = centers.reduce((a, b) => a + b, 0) / centers.length;
      }
      if (type === "v-center") {
        const centers = selectedPorts.map(
          (p) => (p.box_2d[0] + p.box_2d[2]) / 2,
        );
        targetValue = centers.reduce((a, b) => a + b, 0) / centers.length;
      }

      selectedIndices.forEach((idx) => {
        const box = [...next[idx].box_2d];
        const h = box[2] - box[0];
        const w = box[3] - box[1];

        if (type === "top")
          next[idx] = {
            ...next[idx],
            box_2d: [targetValue, box[1], targetValue + h, box[3]],
          };
        if (type === "bottom")
          next[idx] = {
            ...next[idx],
            box_2d: [targetValue - h, box[1], targetValue, box[3]],
          };
        if (type === "left")
          next[idx] = {
            ...next[idx],
            box_2d: [box[0], targetValue, box[2], targetValue + w],
          };
        if (type === "right")
          next[idx] = {
            ...next[idx],
            box_2d: [box[0], targetValue - w, box[2], targetValue],
          };

        if (type === "h-center") {
          const halfW = w / 2;
          next[idx] = {
            ...next[idx],
            box_2d: [box[0], targetValue - halfW, box[2], targetValue + halfW],
          };
        }
        if (type === "v-center") {
          const halfH = h / 2;
          next[idx] = {
            ...next[idx],
            box_2d: [targetValue - halfH, box[1], targetValue + halfH, box[3]],
          };
        }
      });
      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editMode) return;

      // Undo: Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
      }

      // Redo: Ctrl+Y or Ctrl+Shift+Z or Cmd+Shift+Z
      if (
        ((e.ctrlKey || e.metaKey) && e.key === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z")
      ) {
        e.preventDefault();
        redo();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        duplicatePortSelected();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "g") {
        e.preventDefault();
        duplicateGroupSelected();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (
          selectedIndices.length > 0 &&
          document.activeElement?.tagName !== "INPUT"
        ) {
          saveHistory();
          setPorts((prev) =>
            prev.filter((_, i) => !selectedIndices.includes(i)),
          );
          setSelectedIndices([]);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editMode, selectedIndices, ports, past, future]);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === imageRef.current) {
          setImageSize({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
        } else if (entry.target === containerRef.current) {
          const cs = window.getComputedStyle(entry.target);
          const px = parseFloat(cs.paddingLeft || "0") + parseFloat(cs.paddingRight || "0");
          const py = parseFloat(cs.paddingTop || "0") + parseFloat(cs.paddingBottom || "0");
          setContainerSize({
            width: Math.max(0, entry.contentRect.width - px),
            height: Math.max(0, entry.contentRect.height - py),
          });
        }
      }
    });

    if (imageRef.current) observer.observe(imageRef.current);
    if (containerRef.current) observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [image]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaMode === 1 ? e.deltaY * 15 : e.deltaY;
      // standard wheel is often 100, pinch is small.
      const modifier = e.ctrlKey ? 0.005 : 0.001;
      setZoom((prev) => Math.max(0.1, Math.min(5, prev - delta * modifier)));
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  return (
    <div className="wizard-root">
      <header className="wizard-header">
        <div className="wizard-header__left">
          <button
            onClick={() => navigate("/")}
            className="wizard-header__back-btn"
            title="Server Room으로 돌아가기"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
          </button>
          <div className="wizard-header__logo">
            <Icon icon="lucide:layout-grid" />
          </div>
          <div>
            <h1 className="wizard-header__title">
              포트맵핑 마법사 <Icon icon="mdi:magic" className="comm-icon-magic-lg" />
            </h1>
            <p className="wizard-header__subtitle">
              Systems Visual Mapper / Core 3.1
            </p>
          </div>
        </div>

        <div className="wizard-header__right">
          {image && (
            <>
              <div className="wizard-toolbar__history">
                <button
                  onClick={undo}
                  disabled={past.length === 0}
                  className="wizard-toolbar__history-btn"
                  title="실행 취소 (Ctrl+Z)"
                >
                  <Icon icon="lucide:undo-2" />
                </button>
                <div className="wizard-toolbar__divider" />
                <button
                  onClick={redo}
                  disabled={future.length === 0}
                  className="wizard-toolbar__history-btn"
                  title="다시 실행 (Ctrl+Y)"
                >
                  <Icon icon="lucide:redo-2" />
                </button>
              </div>

              <button
                onClick={() => {
                  saveHistory();
                  let currentMaxNum = 0;
                  ports.forEach((p) => {
                    if (p.portName === "port" || !p.portName) {
                      const m = String(p.portNumber).match(/\d+/);
                      if (m) {
                        currentMaxNum = Math.max(
                          currentMaxNum,
                          parseInt(m[0], 10),
                        );
                      }
                    }
                  });
                  const nextNum = currentMaxNum + 1;
                  const newPort: PortData = {
                    portName: "port",
                    portNumber: nextNum,
                    box_2d: [450, 450, 550, 550],
                  };
                  setPorts((prev) => [...prev, newPort]);
                  setEditMode(true);
                  setSelectedIndices([ports.length]);
                }}
                className="wizard-toolbar__add-btn"
              >
                <Icon icon="lucide:grid" />
                수동 포트 추가
              </button>

              <button
                onClick={() => setEditMode(!editMode)}
                className={`wizard-toolbar__edit-btn ${editMode ? "wizard-toolbar__edit-btn--active" : ""
                  }`}
              >
                {editMode ? (
                  <Icon icon="lucide:lock" />
                ) : (
                  <Icon icon="lucide:unlock" />
                )}
                {editMode ? "레이아웃 잠금" : "에디터 잠금 해제"}
              </button>

              <div className="wizard-toolbar__divider--tall" />

              <div className="wizard-toolbar__actions">
                <button
                  onClick={() => setShowDownloadModal(true)}
                  className="wizard-toolbar__icon-btn"
                  title="SVG 내보내기"
                >
                  <Icon icon="lucide:download" />
                </button>

                <button
                  onClick={() => clearImage()}
                  className="wizard-toolbar__icon-btn wizard-toolbar__icon-btn--danger"
                  title="프로젝트 초기화"
                >
                  <Icon icon="lucide:trash-2" />
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <main className="wizard-main" style={leftSidebar ? { display: "flex", gap: "1rem" } : {}}>
        {leftSidebar}
        <div className="wizard-layout" style={leftSidebar ? { flex: 1, minWidth: 0 } : {}}>
          {/* Visual Mapping Area */}
          <section className="wizard-canvas-section">
            <div className="wizard-canvas-wrapper">
              {image && (
                <>
                  <div className="wizard-crop-controls" style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 500 }}>
                    {isCropping ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => setIsCropping(false)}
                          className="wizard-zoom__fit-btn"
                          style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)', padding: '0.6rem 1.2rem', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
                        >
                          <span style={{ fontWeight: 600 }}>취소</span>
                        </button>
                        <button
                          onClick={() => cropperRef.current?.crop()}
                          className="wizard-zoom__fit-btn"
                          style={{ background: 'var(--theme-primary)', color: '#ffffff', border: 'none', padding: '0.6rem 1.2rem', boxShadow: 'var(--elevation-3)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
                        >
                          <span style={{ fontWeight: 600 }}>자르기 완료</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsCropping(true)}
                        className="wizard-zoom__fit-btn"
                        style={{ background: 'var(--theme-primary)', color: '#ffffff', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 1.2rem', boxShadow: 'var(--elevation-3)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
                        title="이미지 자르기"
                      >
                        <Icon icon="lucide:crop" width={18} height={18} />
                        <span style={{ fontWeight: 600 }}>이미지 자르기</span>
                      </button>
                    )}
                  </div>
                  <div className="wizard-zoom-controls">
                    <button
                      onClick={() => setZoom(1)}
                      className="wizard-zoom__fit-btn"
                      title="화면에 맞추기"
                    >
                      맞춤
                    </button>
                    <div className="wizard-zoom__divider" />
                    <div className="wizard-zoom__slider-group">
                      <Icon icon="lucide:zoom-out" className="wizard-zoom__icon" />
                      <input
                        type="range"
                        min="0.1"
                        max="5"
                        step="0.05"
                        value={zoom}
                        onChange={(e) => setZoom(parseFloat(e.target.value))}
                        className="wizard-zoom__range"
                      />
                      <Icon icon="lucide:zoom-in" className="wizard-zoom__icon" />
                    </div>
                    <div className="wizard-zoom__percent">
                      {Math.round(zoom * 100)}%
                    </div>
                  </div>
                </>
              )}

              <div
                ref={containerRef}
                className={`wizard-canvas ${!image
                  ? "wizard-canvas--empty"
                  : "wizard-canvas--loaded"
                  }`}
                style={
                  image
                    ? { display: "flex", cursor: editMode ? "default" : "grab" }
                    : {}
                }
                onClick={(e) => {
                  if (!image) {
                    fileInputRef.current?.click();
                  }
                }}
                onMouseDown={(e) => {
                  if (!image) return;
                  const target = e.target as HTMLElement;

                  const container = containerRef.current;
                  if (!container) return;

                  // Prevent blocking scrollbar clicks
                  const rect = container.getBoundingClientRect();
                  const scrollbarWidth = container.offsetWidth - container.clientWidth;
                  const scrollbarHeight = container.offsetHeight - container.clientHeight;
                  if (
                    e.clientX >= rect.right - scrollbarWidth ||
                    e.clientY >= rect.bottom - scrollbarHeight
                  ) {
                    return; // Clicked on scrollbar, let native behavior happen
                  }

                  if (editMode && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    handleSelectionDrag(e);
                    return;
                  }

                  e.preventDefault();
                  const startX = e.clientX;
                  const startY = e.clientY;
                  const startScrollLeft = container.scrollLeft;
                  const startScrollTop = container.scrollTop;
                  let hasMoved = false;

                  container.style.cursor = "grabbing";

                  const onMouseMove = (moveEvent: MouseEvent) => {
                    const dx = moveEvent.clientX - startX;
                    const dy = moveEvent.clientY - startY;
                    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
                    container.scrollLeft = startScrollLeft - dx;
                    container.scrollTop = startScrollTop - dy;
                  };

                  const onMouseUp = () => {
                    container.style.cursor = editMode ? "default" : "grab";
                    document.removeEventListener("mousemove", onMouseMove);
                    document.removeEventListener("mouseup", onMouseUp);

                    // If no dragging occurred and user clicked on the canvas or wrapper background
                    if (!hasMoved && editMode && (target === containerRef.current || target.classList.contains("wizard-image-wrapper"))) {
                      setSelectedIndices([]);
                    }
                  };

                  document.addEventListener("mousemove", onMouseMove);
                  document.addEventListener("mouseup", onMouseUp);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    if (onMultiUpload) {
                      onMultiUpload(Array.from(e.dataTransfer.files));
                    } else {
                      const event = {
                        target: { files: e.dataTransfer.files }
                      } as any;
                      handleImageUpload(event);
                    }
                  }
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="wizard-file-input"
                />

                {!image ? (
                  <div className="wizard-upload">
                    <div className="wizard-upload__icon-wrap">
                      <Icon icon="lucide:upload" className="wizard-upload__icon" />
                    </div>
                    <p className="wizard-upload__title">
                      여기에 장비 이미지를 드래그 앤 드롭하세요
                    </p>
                    <p className="wizard-upload__subtitle">
                      PNG, JPG, WEBP 지원
                    </p>
                  </div>
                ) : (
                  (() => {
                    let dynamicWidthStyle = `${zoom * 100}%`;
                    
                    if (naturalSize.width > 0 && naturalSize.height > 0 && containerSize.width > 0 && containerSize.height > 0) {
                      const imgRatio = naturalSize.width / naturalSize.height;
                      const containerRatio = containerSize.width / containerSize.height;
                      
                      let baseWidth = containerSize.width;
                      if (imgRatio < containerRatio) {
                        // Image is taller than container, constrain by height
                        baseWidth = containerSize.height * imgRatio;
                      }
                      
                      // Avoid making it infinitely small or NaN
                      if (baseWidth > 0) {
                        dynamicWidthStyle = `${baseWidth * zoom}px`;
                      }
                    }

                    return (
                      <div
                        className="wizard-image-wrapper"
                        style={{
                          width: dynamicWidthStyle,
                          minWidth: dynamicWidthStyle,
                        }}
                        onDragStart={(e) => e.preventDefault()}
                      >
                    {isCropping ? (
                      <ImageCropper
                        ref={cropperRef}
                        imageSrc={image}
                        onCrop={(base64) => {
                          setImage(base64);
                          setIsCropping(false);
                        }}
                        onCancel={() => setIsCropping(false)}
                      />
                    ) : (
                      <img
                        ref={imageRef}
                        src={image}
                        alt="Hardware"
                        draggable={false}
                        className="wizard-image"
                        onLoad={(e) => {
                          const img = e.target as HTMLImageElement;
                          setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
                          setImageSize({
                            width: img.clientWidth || 0,
                            height: img.clientHeight || 0,
                          });
                        }}
                        referrerPolicy="no-referrer"
                      />
                    )}

                    {/* Neural Overlay Background for Image Area - Enhances focus */}
                    <div className="wizard-image-glow"></div>

                    {selectionBox && (
                      <div
                        className="wizard-selection-box"
                        style={{
                          left: Math.min(selectionBox.x1, selectionBox.x2),
                          top: Math.min(selectionBox.y1, selectionBox.y2),
                          width: Math.abs(selectionBox.x2 - selectionBox.x1),
                          height: Math.abs(selectionBox.y2 - selectionBox.y1),
                        }}
                      />
                    )}

                    {ports.map((port, idx) => (
                      <PortBox
                        key={`port-box-${idx}`}
                        port={port}
                        idx={idx}
                        imageSize={imageSize}
                        isSelected={selectedIndices.includes(idx)}
                        isMultiSelect={selectedIndices.length > 1}
                        isPrimarySelection={
                          selectedIndices.length === 1 &&
                          selectedIndices[0] === idx
                        }
                        isActive={activePort === idx}
                        editMode={editMode}
                        onDragStart={handlePortDragStart}
                        onResizeStart={handlePortResizeStart}
                        onDelete={handlePortDelete}
                        onNameChange={handlePortNameChange}
                        onNumberChange={handlePortNumberChange}
                        onSvgTypeChange={handlePortSvgTypeChange}
                        onWidthChange={handlePortWidthChange}
                        onHeightChange={handlePortHeightChange}
                        onMouseEnter={handlePortMouseEnter}
                        onMouseLeave={handlePortMouseLeave}
                        saveHistory={saveHistory}
                      />
                    ))}

                    {/* The X clear button has been moved to the top header! */}
                    {editMode &&
                      selectedIndices.length > 1 &&
                      (() => {
                        let ymin = 1000,
                          xmin = 1000,
                          ymax = 0,
                          xmax = 0;
                        selectedIndices.forEach((idx) => {
                          const p = ports[idx].box_2d;
                          if (p[0] < ymin) ymin = p[0];
                          if (p[1] < xmin) xmin = p[1];
                          if (p[2] > ymax) ymax = p[2];
                          if (p[3] > xmax) xmax = p[3];
                        });

                        const top = (ymin / 1000) * imageSize.height;
                        const left = (xmin / 1000) * imageSize.width;
                        const width = ((xmax - xmin) / 1000) * imageSize.width;
                        const height =
                          ((ymax - ymin) / 1000) * imageSize.height;

                        return (
                          <div
                            className="wizard-multiselect"
                            style={{
                              left: `${left}px`,
                              top: `${top}px`,
                              width: `${width}px`,
                              height: `${height}px`,
                            }}
                          >
                            <motion.div
                              drag={false}
                              initial={{ opacity: 0, scale: 0.95, y: 5 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              className="wizard-multiselect__popup"
                              style={{
                                top: top < 120 ? "calc(100% + 8px)" : "auto",
                                bottom: top < 120 ? "auto" : "calc(100% + 8px)",
                                left: xmin > 500 ? "auto" : "0",
                                right: xmin > 500 ? "0" : "auto",
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              {/* Alignment Section */}
                              <div className="wizard-align">
                                <div className="wizard-align__group">
                                  <button
                                    onClick={() => alignSelected("top")}
                                    className="wizard-align__btn"
                                    title="상단 정렬"
                                  >
                                    <Icon icon="lucide:align-start-horizontal" />
                                  </button>
                                  <button
                                    onClick={() => alignSelected("v-center")}
                                    className="wizard-align__btn"
                                    title="수직 중앙 정렬"
                                  >
                                    <Icon icon="lucide:align-center-horizontal" />
                                  </button>
                                  <button
                                    onClick={() => alignSelected("bottom")}
                                    className="wizard-align__btn"
                                    title="하단 정렬"
                                  >
                                    <Icon icon="lucide:align-end-horizontal" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      alignSelected("distribute-v")
                                    }
                                    className="wizard-align__btn"
                                    title="수직 간격 동일하게"
                                  >
                                    <Icon icon="lucide:align-vertical-space-between" />
                                  </button>
                                </div>
                                <div className="wizard-align__divider" />
                                <div className="wizard-align__group">
                                  <button
                                    onClick={() => alignSelected("left")}
                                    className="wizard-align__btn"
                                    title="좌측 정렬"
                                  >
                                    <Icon icon="lucide:align-start-vertical" />
                                  </button>
                                  <button
                                    onClick={() => alignSelected("h-center")}
                                    className="wizard-align__btn"
                                    title="수평 중앙 정렬"
                                  >
                                    <Icon icon="lucide:align-center-vertical" />
                                  </button>
                                  <button
                                    onClick={() => alignSelected("right")}
                                    className="wizard-align__btn"
                                    title="우측 정렬"
                                  >
                                    <Icon icon="lucide:align-end-vertical" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      alignSelected("distribute-h")
                                    }
                                    className="wizard-align__btn"
                                    title="수평 간격 동일하게"
                                  >
                                    <Icon icon="lucide:align-horizontal-space-between" />
                                  </button>
                                </div>
                              </div>

                              <div className="wizard-multiselect__section-divider" />

                              {/* Properties Section */}
                              <div className="wizard-props">
                                <div className="wizard-props__field">
                                  <span className="wizard-props__label">
                                    이름
                                  </span>
                                  <input
                                    type="text"
                                    placeholder="이름"
                                    value={
                                      selectedIndices.length > 0 &&
                                        selectedIndices.every(
                                          (idx) =>
                                            ports[idx].portName ===
                                            ports[selectedIndices[0]].portName,
                                        )
                                        ? ports[selectedIndices[0]]?.portName ||
                                        ""
                                        : ""
                                    }
                                    onFocus={() => saveHistory()}
                                    onChange={(e) => {
                                      const newName = e.target.value;
                                      setPorts((prev) =>
                                        prev.map((p, i) =>
                                          selectedIndices.includes(i)
                                            ? { ...p, portName: newName }
                                            : p,
                                        ),
                                      );
                                    }}
                                    className="wizard-props__input"
                                  />
                                </div>
                                {(() => {
                                  const vHeight =
                                    imageSize.width > 0
                                      ? (imageSize.height / imageSize.width) *
                                      1000
                                      : 1000;

                                  const isSameW =
                                    selectedIndices.length > 0 &&
                                    selectedIndices.every(
                                      (idx) =>
                                        Math.round(
                                          ports[idx].box_2d[3] -
                                          ports[idx].box_2d[1],
                                        ) ===
                                        Math.round(
                                          ports[selectedIndices[0]].box_2d[3] -
                                          ports[selectedIndices[0]].box_2d[1],
                                        ),
                                    );
                                  const commonW = isSameW
                                    ? Math.round(
                                      ports[selectedIndices[0]].box_2d[3] -
                                      ports[selectedIndices[0]].box_2d[1],
                                    )
                                    : 0;

                                  const isSameH =
                                    selectedIndices.length > 0 &&
                                    selectedIndices.every(
                                      (idx) =>
                                        Math.round(
                                          ((ports[idx].box_2d[2] -
                                            ports[idx].box_2d[0]) /
                                            1000) *
                                          vHeight,
                                        ) ===
                                        Math.round(
                                          ((ports[selectedIndices[0]]
                                            .box_2d[2] -
                                            ports[selectedIndices[0]]
                                              .box_2d[0]) /
                                            1000) *
                                          vHeight,
                                        ),
                                    );
                                  const commonH = isSameH
                                    ? Math.round(
                                      ((ports[selectedIndices[0]].box_2d[2] -
                                        ports[selectedIndices[0]].box_2d[0]) /
                                        1000) *
                                      vHeight,
                                    )
                                    : 0;

                                  return (
                                    <div className="wizard-dims">
                                      <div className="wizard-dims__col">
                                        <span className="wizard-dims__label">
                                          가로
                                        </span>
                                        <div className="wizard-dims__stepper">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              saveHistory();
                                              const newVal = Math.max(
                                                0,
                                                commonW - 1,
                                              );
                                              setPorts((prev) =>
                                                prev.map((p, i) =>
                                                  selectedIndices.includes(i)
                                                    ? {
                                                      ...p,
                                                      box_2d: [
                                                        p.box_2d[0],
                                                        p.box_2d[1],
                                                        p.box_2d[2],
                                                        Math.min(
                                                          1000,
                                                          p.box_2d[1] +
                                                          newVal,
                                                        ),
                                                      ],
                                                    }
                                                    : p,
                                                ),
                                              );
                                            }}
                                            className="wizard-dims__step-btn"
                                          >
                                            -
                                          </button>
                                          <input
                                            type="number"
                                            placeholder="가로"
                                            value={isSameW ? commonW || "" : ""}
                                            onFocus={() => saveHistory()}
                                            onChange={(e) => {
                                              const val =
                                                e.target.value === ""
                                                  ? 0
                                                  : parseInt(e.target.value) ||
                                                  0;
                                              setPorts((prev) =>
                                                prev.map((p, i) =>
                                                  selectedIndices.includes(i)
                                                    ? {
                                                      ...p,
                                                      box_2d: [
                                                        p.box_2d[0],
                                                        p.box_2d[1],
                                                        p.box_2d[2],
                                                        Math.min(
                                                          1000,
                                                          p.box_2d[1] + val,
                                                        ),
                                                      ],
                                                    }
                                                    : p,
                                                ),
                                              );
                                            }}
                                            className="wizard-dims__step-input no-spinners"
                                          />
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              saveHistory();
                                              const newVal = commonW + 1;
                                              setPorts((prev) =>
                                                prev.map((p, i) =>
                                                  selectedIndices.includes(i)
                                                    ? {
                                                      ...p,
                                                      box_2d: [
                                                        p.box_2d[0],
                                                        p.box_2d[1],
                                                        p.box_2d[2],
                                                        Math.min(
                                                          1000,
                                                          p.box_2d[1] +
                                                          newVal,
                                                        ),
                                                      ],
                                                    }
                                                    : p,
                                                ),
                                              );
                                            }}
                                            className="wizard-dims__step-btn"
                                          >
                                            +
                                          </button>
                                        </div>
                                      </div>
                                      <div className="wizard-dims__col">
                                        <span className="wizard-dims__label">
                                          세로
                                        </span>
                                        <div className="wizard-dims__stepper">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              saveHistory();
                                              const newVal = Math.max(
                                                0,
                                                commonH - 1,
                                              );
                                              const normH =
                                                (newVal / vHeight) * 1000;
                                              setPorts((prev) =>
                                                prev.map((p, i) =>
                                                  selectedIndices.includes(i)
                                                    ? {
                                                      ...p,
                                                      box_2d: [
                                                        p.box_2d[0],
                                                        p.box_2d[1],
                                                        Math.min(
                                                          1000,
                                                          p.box_2d[0] + normH,
                                                        ),
                                                        p.box_2d[3],
                                                      ],
                                                    }
                                                    : p,
                                                ),
                                              );
                                            }}
                                            className="wizard-dims__step-btn"
                                          >
                                            -
                                          </button>
                                          <input
                                            type="number"
                                            placeholder="세로"
                                            value={isSameH ? commonH || "" : ""}
                                            onFocus={() => saveHistory()}
                                            onChange={(e) => {
                                              const val =
                                                e.target.value === ""
                                                  ? 0
                                                  : parseInt(e.target.value) ||
                                                  0;
                                              const normH =
                                                (val / vHeight) * 1000;
                                              setPorts((prev) =>
                                                prev.map((p, i) =>
                                                  selectedIndices.includes(i)
                                                    ? {
                                                      ...p,
                                                      box_2d: [
                                                        p.box_2d[0],
                                                        p.box_2d[1],
                                                        Math.min(
                                                          1000,
                                                          p.box_2d[0] + normH,
                                                        ),
                                                        p.box_2d[3],
                                                      ],
                                                    }
                                                    : p,
                                                ),
                                              );
                                            }}
                                            className="wizard-dims__step-input no-spinners"
                                          />
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              saveHistory();
                                              const newVal = commonH + 1;
                                              const normH =
                                                (newVal / vHeight) * 1000;
                                              setPorts((prev) =>
                                                prev.map((p, i) =>
                                                  selectedIndices.includes(i)
                                                    ? {
                                                      ...p,
                                                      box_2d: [
                                                        p.box_2d[0],
                                                        p.box_2d[1],
                                                        Math.min(
                                                          1000,
                                                          p.box_2d[0] + normH,
                                                        ),
                                                        p.box_2d[3],
                                                      ],
                                                    }
                                                    : p,
                                                ),
                                              );
                                            }}
                                            className="wizard-dims__step-btn"
                                          >
                                            +
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>

                              <div className="wizard-multiselect__section-divider" />

                              {/* Actions Section */}
                              <div className="wizard-actions">
                                <div className="wizard-actions__col">
                                  <button
                                    onClick={duplicateGroupSelected}
                                    className="wizard-actions__grp-btn"
                                  >
                                    <Icon icon="lucide:grid" />
                                    GRP_CPY
                                  </button>
                                  <button
                                    onClick={duplicatePortSelected}
                                    className="wizard-actions__itr-btn"
                                  >
                                    <Icon icon="lucide:history" />
                                    ITR_PRT
                                  </button>
                                </div>

                                <div className="wizard-multiselect__section-divider" />

                                <div className="wizard-actions__count-col">
                                  <span className="wizard-actions__count">
                                    {selectedIndices.length}
                                  </span>
                                  <button
                                    onClick={() => {
                                      saveHistory();
                                      setPorts((prev) => prev.filter((_, i) => !selectedIndices.includes(i)));
                                      setSelectedIndices([]);
                                    }}
                                    className="wizard-actions__clear-btn"
                                    title="포트 삭제"
                                  >
                                    <Icon icon="lucide:x" />
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          </div>
                        );
                      })()}
                  </div>
                  );
                })()
                )}
              </div>
            </div>

            <div className="wizard-telemetry">
              <h2 className="wizard-telemetry__title">
                장비 분석 결과
              </h2>

              {!image ? (
                <div className="wizard-telemetry__empty">
                  <Icon icon="lucide:layout-grid" className="wizard-telemetry__empty-icon" />
                  <span className="wizard-telemetry__empty-text">
                    이미지가 없습니다
                  </span>
                  <span className="wizard-telemetry__empty-sub">
                    장비 이미지를 업로드하여 분석을 시작하세요
                  </span>
                </div>
              ) : !ports.length && !loading ? (
                <div className="wizard-analyze-wrap">
                  <button
                    onClick={analyzeImage}
                    className="wizard-analyze-btn"
                  >
                    <div className="wizard-analyze-btn__shimmer"></div>
                    <div className="wizard-analyze-btn__content">
                      <Icon icon="lucide:send" className="wizard-analyze-btn__icon" />
                      <span className="wizard-analyze-btn__text">
                        AI 분석 시작
                      </span>
                    </div>
                  </button>
                  <span className="wizard-analyze-subtitle">
                    Gemini AI를 사용하여 하드웨어 포트를 자동 감지합니다
                  </span>

                  {error && (
                    <div className="wizard-error">
                      <Icon icon="lucide:alert-circle" className="wizard-error__icon" />
                      <div
                        className="wizard-error__text"
                        title={error}
                      >
                        {error}
                      </div>
                      <button
                        onClick={analyzeImage}
                        className="wizard-error__retry"
                      >
                        재시도
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="wizard-results">
                  {loading ? (
                    <div className="wizard-loading">
                      <div
                        ref={logsContainerRef}
                        className="wizard-loading__logs wizard-scrollbar"
                      >
                        {loadingLogs.map((log, idx) => (
                          <div key={idx} className="wizard-log-entry">
                            <div className="wizard-log-entry__dot" />
                            <span className="wizard-log-entry__text">
                              {log}
                            </span>
                            {idx < loadingLogs.length - 1 && (
                              <span className="wizard-log-entry__ok">
                                [ OK ]
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="wizard-progress">
                        <div className="wizard-progress__labels">
                          <span className="wizard-progress__label">
                            분석 진행률
                          </span>
                          <span className="wizard-progress__value">
                            {Math.round(loadingStep)}%
                          </span>
                        </div>
                        <div className="wizard-progress__track">
                          <div
                            className="wizard-progress__bar"
                            style={{
                              width: `${Math.min(100, Math.max(0, loadingStep))}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="wizard-analysis-text">
                      <span>
                        {analysis || "> 시스템 상태: 분석 대기 중"}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Sidebar: Diagnostics & Inventory */}
          <section className="wizard-sidebar-section">
            <div className="wizard-registry">
              <div className="wizard-registry__header">
                <div className="wizard-registry__header-left">
                  <div className="wizard-registry__dot"></div>
                  <h3 className="wizard-registry__title">
                    포트 목록
                  </h3>
                </div>
                {ports.length > 0 && (
                  <button
                    onClick={toggleAllCategories}
                    title={
                      collapsedCategories.size >=
                        new Set(ports.map((p) => p.portName || "UNNAMED")).size
                        ? "전체 펼치기"
                        : "전체 접기"
                    }
                    className="wizard-registry__collapse-btn"
                  >
                    {collapsedCategories.size >=
                      new Set(ports.map((p) => p.portName || "UNNAMED")).size ? (
                      <Icon icon="lucide:chevron-right" className="wizard-registry__collapse-icon" />
                    ) : (
                      <Icon icon="lucide:chevron-down" className="wizard-registry__collapse-icon" />
                    )}
                  </button>
                )}
              </div>

              <div className="wizard-registry__list wizard-scrollbar">
                {ports.length > 0 ? (
                  <div className="wizard-registry__groups">
                    {/* Grouping by name */}
                    {Object.entries(
                      ports.reduce(
                        (acc, port, originalIdx) => {
                          const category = port.portName || "UNNAMED";
                          if (!acc[category]) acc[category] = [];
                          acc[category].push({ port, originalIdx });
                          return acc;
                        },
                        {} as Record<
                          string,
                          { port: PortData; originalIdx: number }[]
                        >,
                      ),
                    ).map(([category, items]) => {
                      const isCollapsed = collapsedCategories.has(category);
                      return (
                        <div key={category} className="wizard-category">
                          <div
                            className="wizard-category__header"
                            onClick={() => toggleCategory(category)}
                          >
                            <div className="wizard-category__header-left">
                              {isCollapsed ? (
                                <Icon icon="lucide:chevron-right" className="wizard-category__chevron" />
                              ) : (
                                <Icon icon="lucide:chevron-down" className="wizard-category__chevron" />
                              )}
                              <span className="wizard-category__name">
                                {category}
                              </span>
                            </div>
                            <span className="wizard-category__count">
                              {items.length} units
                            </span>
                          </div>

                          {!isCollapsed && (
                            <div className="wizard-category__items">
                              {items.map(({ port, originalIdx }) => (
                                <SidebarItem
                                  key={`reg-${originalIdx}`}
                                  port={port}
                                  originalIdx={originalIdx}
                                  isActive={activePort === originalIdx}
                                  isSelected={selectedIndices.includes(originalIdx)}
                                  setActivePort={setActivePort}
                                  setSelectedIndices={setSelectedIndices}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="wizard-registry__empty">
                    <Icon icon="lucide:grid" className="wizard-registry__empty-icon" />
                    <div className="wizard-registry__empty-texts">
                      <p className="wizard-registry__empty-title">
                        Null Vector Array
                      </p>
                      <p className="wizard-registry__empty-sub">
                        Upload hardware telemetry to initiate mapping
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="wizard-footer">
        <div className="wizard-footer__cols">
          <div>
            <p className="wizard-footer__label">
              Neural Core
            </p>
            <p className="wizard-footer__value">
              Gemini 3.8 Flash Core
            </p>
          </div>
          <div>
            <p className="wizard-footer__label">
              Environment
            </p>
            <p className="wizard-footer__value">
              Secure Mapping Protocol V4
            </p>
          </div>
        </div>
        <div className="wizard-footer__right">
          <p className="wizard-footer__company">
            포트맵핑 마법사 <Icon icon="mdi:magic" className="comm-icon-magic-sm" /> Systems
          </p>
          <p className="wizard-footer__copyright">
            © 2026 Autonomous Neural Mapping
          </p>
        </div>
      </footer>

      <AnimatePresence>
        {showDownloadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="wizard-modal-overlay"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="wizard-modal"
            >
              <div className="wizard-modal__gradient"></div>

              <div className="wizard-modal__header">
                <div>
                  <h2 className="wizard-modal__title">
                    맵 내보내기
                  </h2>
                  <p className="wizard-modal__subtitle">
                    벡터 SVG 생성
                  </p>
                </div>
                <button
                  onClick={() => setShowDownloadModal(false)}
                  className="wizard-modal__close-btn"
                >
                  <Icon icon="lucide:x" />
                </button>
              </div>

              <div className="wizard-modal__body">
                <div>
                  <label className="wizard-modal__label">
                    파일 이름 지정
                  </label>
                  <div className="wizard-modal__input-wrap">
                    <input
                      type="text"
                      value={downloadFileName}
                      onChange={(e) => setDownloadFileName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") executeDownload();
                      }}
                      className="wizard-modal__input"
                      placeholder="hardware-ports"
                      autoFocus
                    />
                    <span className="wizard-modal__input-suffix">
                      .svg
                    </span>
                  </div>
                </div>

                <div className="wizard-modal__actions">
                  <button
                    onClick={() => setShowDownloadModal(false)}
                    className="wizard-modal__cancel-btn"
                  >
                    취소
                  </button>
                  <button
                    onClick={executeDownload}
                    className="wizard-modal__submit-btn"
                  >
                    <Icon icon="lucide:download" />
                    내보내기 실행
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


