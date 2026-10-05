import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { NodePicker } from "./NodePicker";
import { StnFormField } from "../../ui/StnFormField";
import { StnInput } from "../../ui/StnInput";
import { EquipmentAssemblyModal } from "../../model/EquipmentAssemblyModal";
import { DeviceSvgPreview } from "../DeviceSvgPreview";
import { equipmentModels } from "../../../utils/cardAssets";
import type { InsertedCard, GeneratedPort, InsertedModule, EquipmentViewSide } from "../../../types/equipment";
import { useStore } from "../../../store/useStore";
import { getEffectiveTemplates } from "../../../utils/deviceTemplates";
import { getDeviceViewSides, hasDeviceSvgAsset } from "../../../utils/deviceAssets";
import type { VendorName, HierarchyNode, RegisteredDevice } from "../../../types";
import { getEffectiveCards } from "../../../utils/sampleUtils";
import { convertSvgToPngAsync } from "../../../utils/imageUtils";



// Simple IP format validation (X.X.X.X)
const isValidIP = (IPAddr: string) =>
  /^(\d{1,3}\.){3}\d{1,3}$/.test(IPAddr) &&
  IPAddr.split(".").every((n) => parseInt(n) >= 0 && parseInt(n) <= 255);





// --- Registration Form Modal (Separate Overlay) ---
export const RegistrationFormModal = ({
  isOpen,
  onClose,
  editingDeviceId,
  activeNodeId,
  nodes,
  registeredDevices,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingDeviceId: string | null;
  activeNodeId: string;
  nodes: HierarchyNode[];
  registeredDevices: RegisteredDevice[];
  onSuccess: (title: string, isEdit: boolean) => void;
}) => {
  const addRegisteredDevice = useStore((s) => s.addRegisteredDevice);
  const updateRegisteredDevice = useStore((s) => s.updateRegisteredDevice);
  const customModels = useStore((s) => s.customModels);
  const deletedDefaultTemplates = useStore((s) => s.deletedDefaultTemplates);

  // Effective templates: built-in + custom models
  const effectiveTemplates = useMemo(
    () => getEffectiveTemplates(customModels, deletedDefaultTemplates),
    [customModels, deletedDefaultTemplates],
  );

  // Form state
  const [nodeId, setNodeId] = useState<string>(activeNodeId || "");
  const [selectedModelIdx, setSelectedModelIdx] = useState(0);
  const [title, setDeviceName] = useState("");
  const [IPAddr, setIp] = useState("");

  const [vendor, setVendor] = useState<VendorName>("Nokia");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Equipment Assembly State
  const [insertedCards, setInsertedCards] = useState<InsertedCard[]>([]);
  const [generatedPorts, setGeneratedPorts] = useState<GeneratedPort[]>([]);

  const [isAssemblyOpen, setIsAssemblyOpen] = useState(false);

  // Module State
  const [insertedModules, setInsertedModules] = useState<InsertedModule[]>([]);
  const [defaultViewSide, setDefaultViewSide] = useState<EquipmentViewSide>("front");

  const [composedSvgFront, setComposedSvgFront] = useState<string | null>(null);
  const [composedSvgRear, setComposedSvgRear] = useState<string | null>(null);

  const selectedTemplate = effectiveTemplates[selectedModelIdx];
  const selectedViewSides = useMemo(
    () => getDeviceViewSides(selectedTemplate?.modelName),
    [selectedTemplate?.modelName],
  );
  const selectedViewSidesKey = selectedViewSides.join(",");

  const isTemplateCardBased = (template: typeof effectiveTemplates[0]) => {
    if (!template) return false;
    const builtin = equipmentModels.find(m => m.modelName === template.modelName);
    if (builtin && ('cardArea' in builtin || 'slots' in builtin || 'rows' in builtin)) return true;
    const custom = customModels.find(m => m.modelName === template.modelName || m.modelId === template.customModelId);
    if (custom && custom.modelType === "card-based") return true;
    return false;
  };

  const isCardBasedModel = useMemo(() => isTemplateCardBased(selectedTemplate), [selectedTemplate, customModels]);

  const baseTemplates = useMemo(() => {
    return effectiveTemplates.map((t, idx) => ({ t, idx })).filter(({ t }) => !t.variant);
  }, [effectiveTemplates]);

  const currentBaseIdx = useMemo(() => {
    if (!selectedTemplate) return 0;
    if (selectedTemplate.variant && selectedTemplate.customModelId) {
      let bIdx = effectiveTemplates.findIndex(t => t.customModelId === selectedTemplate.customModelId && t.isBaseChassis);
      if (bIdx === -1) {
        const baseName = selectedTemplate.modelName.replace(` ${selectedTemplate.variant.variantName}`, "");
        bIdx = effectiveTemplates.findIndex(t => t.modelName === baseName && !t.variant);
      }
      return bIdx !== -1 ? bIdx : selectedModelIdx;
    }
    return selectedModelIdx;
  }, [selectedTemplate, selectedModelIdx, effectiveTemplates]);

  const currentVariants = useMemo(() => {
    const baseTpl = effectiveTemplates[currentBaseIdx];
    if (!baseTpl || !baseTpl.customModelId) return [];
    return effectiveTemplates.map((t, idx) => ({ t, idx }))
      .filter(({ t }) => t.customModelId === baseTpl.customModelId && t.variant);
  }, [currentBaseIdx, effectiveTemplates]);

  useEffect(() => {
    if (!selectedTemplate) return;
    const custom = customModels.find((m) => m.modelName === selectedTemplate.modelName);
    if (!editingDeviceId && custom?.defaultViewSide && selectedViewSides.includes(custom.defaultViewSide)) {
      setDefaultViewSide(custom.defaultViewSide);
      return;
    }
    if (!selectedViewSides.includes(defaultViewSide)) {
      setDefaultViewSide(selectedViewSides[0] || "front");
    }
  }, [selectedTemplate, selectedViewSidesKey, defaultViewSide, customModels, editingDeviceId, selectedViewSides]);

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsInitialized(false);
      return;
    }
    if (isInitialized) return;

    queueMicrotask(() => {
      if (editingDeviceId) {
        const device = registeredDevices.find(
          (d) => d.deviceId === editingDeviceId,
        );
        if (device) {
          setNodeId(device.deviceGroupId || "");
          const idx = effectiveTemplates.findIndex(
            (t) => t.modelName === device.modelName,
          );
          if (idx >= 0) setSelectedModelIdx(idx);
          setDeviceName(device.title || "");
          setIp(device.IPAddr || "");

          if (device.vendor) setVendor(device.vendor);
          setInsertedCards(getEffectiveCards(device as any, customModels));
          setInsertedModules(device.insertedModules || []);

          setDefaultViewSide(device.defaultViewSide || "front");
        }
      } else {
        const firstRoom = nodes.find(n => n.type === "room");
        setNodeId(firstRoom ? firstRoom.nodeId : (activeNodeId || ""));
        setVendor(effectiveTemplates[0]?.vendor || "Nokia");
        setErrors({});
        const initialTemplate = effectiveTemplates[0];
        setInsertedCards(initialTemplate?.variant?.insertedCards || []);
        setInsertedModules([]);
        setGeneratedPorts([]);
        setSelectedModelIdx(0);
        setDeviceName("");
        setIp("");

        setDefaultViewSide("front");
      }
      setIsInitialized(true);
    });
  }, [isOpen, editingDeviceId, activeNodeId, registeredDevices, effectiveTemplates, isInitialized, customModels, nodes]);

  const hasUnsavedChanges = (): boolean => {
    if (editingDeviceId) {
      const device = registeredDevices.find((d) => d.deviceId === editingDeviceId);
      if (!device) return false;
      const initialNodeId = device.deviceGroupId || "";
      const initialIdx = Math.max(0, effectiveTemplates.findIndex((t) => t.modelName === device.modelName));
      const initialTitle = device.title || "";
      const initialIp = device.IPAddr || "";
      const initialVendor = device.vendor || "Nokia";
      const initialCards = getEffectiveCards(device as any, customModels);
      const initialModules = device.insertedModules || [];
      const initialViewSide = device.defaultViewSide || "front";

      if (nodeId !== initialNodeId) return true;
      if (selectedModelIdx !== initialIdx) return true;
      if (title !== initialTitle) return true;
      if (IPAddr !== initialIp) return true;
      if (vendor !== initialVendor) return true;
      if (defaultViewSide !== initialViewSide) return true;
      if (JSON.stringify(insertedCards) !== JSON.stringify(initialCards)) return true;
      if (JSON.stringify(insertedModules) !== JSON.stringify(initialModules)) return true;
      return false;
    } else {
      const firstRoom = nodes.find(n => n.type === "room");
      const initialNodeId = firstRoom ? firstRoom.nodeId : (activeNodeId || "");
      const initialTemplate = effectiveTemplates[0];
      const initialCards = initialTemplate?.variant?.insertedCards || [];

      if (nodeId !== initialNodeId) return true;
      if (selectedModelIdx !== 0) return true;
      if (title !== "") return true;
      if (IPAddr !== "") return true;
      if (JSON.stringify(insertedCards) !== JSON.stringify(initialCards)) return true;
      if (insertedModules.length > 0) return true;
      return false;
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges()) {
      if (window.confirm("작성 중인 정보가 저장되지 않습니다. 창을 닫으시겠습니까?")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = "필수 입력";
    if (!IPAddr.trim()) newErrors.IPAddr = "필수 입력";
    else if (!isValidIP(IPAddr.trim())) newErrors.IPAddr = "형식: X.X.X.X";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const payload: Omit<RegisteredDevice, "deviceId"> = {
      title: title.trim(),
      IPAddr: IPAddr.trim(),
      macAddr: "",
    };
    // 선택 필드: 값이 있을 때만 포함
    if (nodeId) payload.deviceGroupId = nodeId;
    const templateCardsStr = JSON.stringify(selectedTemplate?.variant?.insertedCards || []);
    const insertedCardsStr = JSON.stringify(insertedCards);
    const isCustomized = insertedCards.length > 0 && templateCardsStr !== insertedCardsStr;

    if (selectedTemplate) {
      payload.modelName = selectedTemplate.modelName;
      payload.type = selectedTemplate.type;
      payload.size = selectedTemplate.uSize;

      const builtinModel = equipmentModels.find(m => m.modelName === selectedTemplate.modelName);
      const customModel = customModels.find(m => m.modelName === selectedTemplate.modelName);
      const equipModel = builtinModel || customModel;

      // If customized, bake the PNG. Otherwise, clear it so it dynamically tracks the template.
      if (isCustomized) {
        if ((defaultViewSide === "front" && composedSvgFront) || (defaultViewSide === "rear" && composedSvgRear)) {
          const targetSvg = defaultViewSide === "front" ? composedSvgFront : composedSvgRear;
          try {
            const w = equipModel?.equipmentSize?.width || 984;
            const h = equipModel?.equipmentSize?.height || 200;
            payload.devicePngRaw = await convertSvgToPngAsync(targetSvg!, w, h) || undefined;
          } catch (err) {
            console.error("Failed to convert SVG to WEBP", err);
            payload.devicePngRaw = `data:image/svg+xml;utf8,${encodeURIComponent(targetSvg!)}`;
          }
        }
      } else {
        payload.devicePngRaw = "";
      }
    }
    payload.defaultViewSide = defaultViewSide;
    if (vendor) payload.vendor = vendor;

    if (isCustomized) {
      payload.insertedCards = insertedCards;
      payload.generatedPorts = generatedPorts;
    } else {
      payload.insertedCards = [];
      payload.generatedPorts = [];
    }
    // 모듈 정보 포함
    payload.insertedModules = insertedModules;

    if (editingDeviceId) {
      updateRegisteredDevice(editingDeviceId, payload);
      onSuccess(title.trim(), true);
    } else {
      addRegisteredDevice(payload);
      onSuccess(title.trim(), false);
    }
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="drm-reg-modal-overlay" onClick={handleClose}>
      <div className="drm-reg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="drm-reg-modal-header">
          <div className="drm-form-title">
            {editingDeviceId ? "장비 정보 수정" : "새 장비 등록"}
          </div>
          <button
            onClick={handleClose}
            className="drm-reg-modal-close"
            aria-label="닫기"
          >
            &times;
          </button>
        </div>

        <div className="drm-reg-modal-body">
          <div className="drm-form-grid">
            <StnFormField label="위치" error={errors.nodeId}>
              <NodePicker
                nodes={nodes}
                selectedNodeId={nodeId}
                registeredDevices={registeredDevices}
                onSelect={(id) => setNodeId(id)}
              />
            </StnFormField>

            <StnFormField label="모델">
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <select
                    className="stn-input"
                    value={currentBaseIdx}
                    onChange={(e) => {
                      const newBaseIdx = Number(e.target.value);
                      const baseTpl = effectiveTemplates[newBaseIdx];

                      const variants = effectiveTemplates.map((t, idx) => ({ t, idx })).filter(({ t }) => t.customModelId && t.customModelId === baseTpl.customModelId && t.variant);

                      let targetIdx = newBaseIdx;
                      if (variants.length > 0) {
                        const defaultVar = variants.find(v => v.t.variant?.variantName === "기본타입");
                        targetIdx = defaultVar ? defaultVar.idx : variants[0].idx;
                      }

                      setSelectedModelIdx(targetIdx);

                      const nextTemplate = effectiveTemplates[targetIdx];
                      if (nextTemplate) {
                        setVendor(nextTemplate.vendor);
                        setInsertedCards(nextTemplate?.variant?.insertedCards || []);
                      } else {
                        setVendor("Nokia");
                        setInsertedCards([]);
                      }
                      setInsertedModules([]);
                      setGeneratedPorts([]);

                      const nextCustom = customModels.find((m) => m.modelId === nextTemplate?.customModelId || m.modelName === nextTemplate?.modelName);
                      setDefaultViewSide(nextCustom?.defaultViewSide || "front");
                    }}
                  >
                    {baseTemplates.map(({ t, idx }) => {
                      const isCard = isTemplateCardBased(t);
                      return (
                        <option key={idx} value={idx}>
                          {`[${t.uSize}U] ${t.modelName}${isCard ? ' (섀시형)' : ''}`}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </StnFormField>

            <StnFormField label="카드타입">
              <select
                className="stn-input"
                value={selectedModelIdx}
                disabled={currentVariants.length === 0}
                onChange={(e) => {
                  const targetIdx = Number(e.target.value);
                  setSelectedModelIdx(targetIdx);

                  const nextTemplate = effectiveTemplates[targetIdx];
                  if (nextTemplate) {
                    setVendor(nextTemplate.vendor);
                    setInsertedCards(nextTemplate?.variant?.insertedCards || []);
                  } else {
                    setVendor("Nokia");
                    setInsertedCards([]);
                  }
                  setInsertedModules([]);
                  setGeneratedPorts([]);

                  const nextCustom = customModels.find((m) => m.modelId === nextTemplate?.customModelId || m.modelName === nextTemplate?.modelName);
                  setDefaultViewSide(nextCustom?.defaultViewSide || "front");
                }}
              >
                {currentVariants.length === 0 ? (
                  <option value={currentBaseIdx}>해당 없음 (고정형)</option>
                ) : (
                  <>
                    <option value={currentBaseIdx}>타입 미지정 (직접 구성)</option>
                    {currentVariants.map(({ t, idx }) => (
                      <option key={idx} value={idx}>
                        {t.variant?.variantName} ({t.variant?.insertedCards.length || 0}개 카드)
                      </option>
                    ))}
                  </>
                )}
              </select>
            </StnFormField>

            <StnFormField label="장비명" required error={errors.title}>
              <StnInput
                type="text"
                value={title}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="장비 이름을 입력하세요 (예: 2층-라우터-01)"
              />
            </StnFormField>

            <StnFormField label="IP 주소" required error={errors.IPAddr}>
              <StnInput
                type="text"
                value={IPAddr}
                onChange={(e) => setIp(e.target.value)}
                placeholder="10.0.0.1"
              />
            </StnFormField>

            <StnFormField label="제조사">
              <StnInput
                type="text"
                value={vendor}
                disabled
              />
            </StnFormField>
          </div>

          {/* 장비 프리뷰 + 모듈 설정 */}
          {selectedTemplate && hasDeviceSvgAsset(selectedTemplate.modelName) && (
            <div style={{
              margin: "0 0 32px",
              padding: "24px",
              borderRadius: "12px",
              backgroundColor: "var(--bg-secondary)",
              border: "1px solid var(--border-medium)",
            }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: "12px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{
                    fontSize: "13px", fontWeight: 700, color: "var(--text-primary)",
                  }}>장비 프리뷰</span>
                  {insertedModules.length > 0 && (
                    <span style={{
                      fontSize: "10px", fontWeight: 600, padding: "2px 8px",
                      borderRadius: "8px", background: "rgba(0, 229, 255, 0.1)",
                      color: "#00e5ff", border: "1px solid rgba(0, 229, 255, 0.3)",
                    }}>모듈 {insertedModules.length}개</span>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-tertiary)" }}>
                    포트를 클릭하여 모듈을 설정하세요
                  </span>
                  {isCardBasedModel && (
                    <button
                      className="comm-btn comm-btn-secondary"
                      style={{ fontSize: "11px", padding: "4px 8px", height: "auto", minHeight: "24px" }}
                      onClick={(e) => {
                        e.preventDefault();
                        if (selectedTemplate?.variant) {
                          const msg = "타입이 해제 됩니다. 해당 타입과 같은 타입의 장비까지 일괄 수정하고 싶다면 '장비 모델 관리 > 새 모델 등록(또는 모델 수정) > 타입 관리'에서 수정해주세요.\n\n현재 장비만 개별적으로 장비 구성을 변경하시겠습니까?";
                          if (!window.confirm(msg)) {
                            return;
                          }
                          let baseIdx = effectiveTemplates.findIndex(t => t.customModelId === selectedTemplate.customModelId && t.isBaseChassis);
                          if (baseIdx === -1 && selectedTemplate.variant) {
                            const baseName = selectedTemplate.modelName.replace(` ${selectedTemplate.variant.variantName}`, "");
                            baseIdx = effectiveTemplates.findIndex(t => t.modelName === baseName);
                          }
                          if (baseIdx !== -1) {
                            setSelectedModelIdx(baseIdx);
                          } else {
                            console.error("Base chassis not found for", selectedTemplate);
                          }
                        }
                        setIsAssemblyOpen(true);
                      }}
                    >
                      장비 구성 변경
                    </button>
                  )}
                </div>
              </div>
              {selectedViewSides.length > 1 && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: "var(--bg-primary)",
                  border: "1px solid var(--border-weak)",
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
                    기본 표시
                  </span>
                  {selectedViewSides.map((side) => (
                    <label
                      key={side}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        color: "var(--text-primary)",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        checked={defaultViewSide === side}
                        onChange={() => setDefaultViewSide(side)}
                      />
                      {side === "front" ? "앞면" : "뒷면"}
                    </label>
                  ))}
                </div>
              )}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: 14,
              }}>
                {(selectedViewSides.length > 0 ? selectedViewSides : ["front" as EquipmentViewSide]).map((side) => (
                  <div
                    key={side}
                    style={{
                      borderRadius: "8px",
                      padding: 10,
                      background: "var(--bg-primary)",
                      border: defaultViewSide === side
                        ? "1px solid var(--theme-primary)"
                        : "1px solid var(--border-weak)",
                      minWidth: 0,
                    }}
                  >
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                        {side === "front" ? "앞면" : "뒷면"}
                      </span>
                      {defaultViewSide === side && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--theme-primary)" }}>
                          기본
                        </span>
                      )}
                    </div>
                    <DeviceSvgPreview
                      key={`${selectedTemplate.modelName}-${side}`}
                      modelName={selectedTemplate.modelName}
                      insertedCards={insertedCards}
                      insertedModules={insertedModules}
                      onModuleChange={setInsertedModules}
                      editable={true}
                      maxWidth="100%"
                      viewSide={side}
                      onCompose={(svg) => {
                        if (side === "front") setComposedSvgFront(svg);
                        else setComposedSvgRear(svg);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        <div className="drm-reg-modal-footer">
          <div className="drm-form-actions">
            <button
              className="comm-btn comm-btn-lg comm-btn-secondary"
              onClick={handleClose}
            >
              취소
            </button>
            <button
              className="comm-btn comm-btn-lg comm-btn-primary"
              onClick={handleSubmit}
            >
              {editingDeviceId ? "저장하기" : "등록하기"}
            </button>
          </div>
        </div>
      </div>
      {isAssemblyOpen && (
        <EquipmentAssemblyModal
          open={isAssemblyOpen}
          onClose={() => setIsAssemblyOpen(false)}
          initialModelName={selectedTemplate?.modelName}
          initialCards={insertedCards}
          onSave={(result) => {
            setInsertedCards(result.cards);

            if (result.generatedPorts) {
              setGeneratedPorts(result.generatedPorts);
            }
            if (editingDeviceId) {
              updateRegisteredDevice(editingDeviceId, {
                insertedCards: result.cards,
                generatedPorts: result.generatedPorts || []
              });
            }

            // Switch to base chassis variant if it's currently a custom variant
            if (selectedTemplate?.isCustom && !selectedTemplate.isBaseChassis && selectedTemplate.variant) {
              const baseChassisIdx = effectiveTemplates.findIndex(
                (t) => t.customModelId === selectedTemplate.customModelId && t.isBaseChassis
              );
              if (baseChassisIdx !== -1) {
                setSelectedModelIdx(baseChassisIdx);
              }
            }
          }}
        />
      )}
    </div>,
    document.body,
  );
};
