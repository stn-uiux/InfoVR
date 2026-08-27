import React, { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import type { CardWidthType } from "../../types/equipment";
import { StnFormField } from "../StnFormField";
import { StnInput } from "../StnInput";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (card: {
    cardName: string;
    cardSvgRaw: string;
    svgWidth: number;
    svgHeight: number;
    widthType: CardWidthType;
  }) => void;
  /** 카드 영역 설정의 최대 열 수 (기본: 2) */
  maxColumns?: number;
}

/** SVG raw text에서 width/height 추출 */
function parseSvgDimensions(svgRaw: string): { width: number; height: number } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgRaw, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) return { width: 430, height: 46 };

  // viewBox에서 추출 시도
  const vb = svg.getAttribute("viewBox");
  if (vb) {
    const parts = vb.split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] };
    }
  }

  // width/height 속성에서 추출
  const w = parseFloat(svg.getAttribute("width") || "0");
  const h = parseFloat(svg.getAttribute("height") || "0");
  if (w > 0 && h > 0) return { width: w, height: h };

  return { width: 430, height: 46 };
}

export const CardRegistrationForm: React.FC<Props> = ({
  open,
  onClose,
  onSave,
  maxColumns = 2,
}) => {
  const [cardName, setCardName] = useState("");
  const [widthType, setWidthType] = useState<CardWidthType>("half");
  const [svgRaw, setSvgRaw] = useState<string | null>(null);
  const [svgFileName, setSvgFileName] = useState("");
  const [svgDims, setSvgDims] = useState({ width: 0, height: 0 });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const [isDragOver, setIsDragOver] = useState(false);

  const processFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith(".svg")) {
      setErrors((prev) => ({ ...prev, file: "SVG 파일만 지원합니다." }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const raw = reader.result as string;
      setSvgRaw(raw);
      setSvgFileName(file.name);
      
      const nameWithoutExt = file.name.replace(/\.svg$/i, "");
      setCardName(nameWithoutExt);

      const dims = parseSvgDimensions(raw);
      setSvgDims(dims);
      setErrors((prev) => {
        const next = { ...prev };
        delete next.file;
        delete next.cardName;
        return next;
      });
    };
    reader.readAsText(file);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      processFile(file);
    },
    [processFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      processFile(file);
    },
    [processFile],
  );

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};
    if (!cardName.trim()) newErrors.cardName = "카드명을 입력하세요.";
    if (!svgRaw) newErrors.file = "카드 SVG 파일을 업로드하세요.";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    onSave({
      cardName: cardName.trim(),
      cardSvgRaw: svgRaw!,
      svgWidth: svgDims.width,
      svgHeight: svgDims.height,
      widthType,
    });

    // Reset
    setCardName("");
    setWidthType("half");
    setSvgRaw(null);
    setSvgFileName("");
    setSvgDims({ width: 0, height: 0 });
    setErrors({});
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <div className="mrm-card-reg-overlay" onClick={onClose}>
      <div
        className="mrm-card-reg-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mrm-section-title">새 카드 등록</div>

        <StnFormField label="카드명" required error={errors.cardName}>
          <StnInput
            type="text"
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            placeholder="예: R-series-custom"
          />
        </StnFormField>

        <div className="stn-form-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            id="full-type-checkbox"
            checked={widthType === "full"}
            onChange={(e) => setWidthType(e.target.checked ? "full" : "half")}
            style={{ width: "auto" }}
          />
          <label htmlFor="full-type-checkbox" style={{ margin: 0, cursor: "pointer", display: "inline" }}>
            FULL 타입 (체크 시 해당 슬롯의 모든 열 점유)
          </label>
        </div>

        <StnFormField label="카드 SVG 파일" required fullWidth error={errors.file}>
          <input
            type="file"
            accept=".svg"
            ref={fileRef}
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          <div
            className={`mrm-file-upload ${svgRaw ? "has-file" : ""} ${isDragOver ? "drag-over" : ""}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {svgRaw ? (
              <>
                <div className="file-name">✓ {svgFileName}</div>
                <div className="upload-hint">
                  {svgDims.width} × {svgDims.height}px
                </div>
              </>
            ) : (
              <>
                <div className="upload-icon">📄</div>
                <div className="upload-text">SVG 파일을 선택하세요</div>
              </>
            )}
          </div>
        </StnFormField>

        {svgRaw && (
          <div className="mrm-svg-preview">
            <div dangerouslySetInnerHTML={{ __html: svgRaw }} />
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="mrm-btn secondary" onClick={onClose}>
            취소
          </button>
          <button className="mrm-btn primary" onClick={handleSubmit}>
            카드 등록
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

