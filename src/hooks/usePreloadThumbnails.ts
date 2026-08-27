import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { convertSvgToPngAsync } from "../utils/imageUtils";
import { generateComposedSvgAsync } from "./useSvgComposer";
import type { CustomEquipmentModel } from "../types/equipment";

export const usePreloadThumbnails = () => {
  const customModels = useStore((s) => s.customModels);
  const updateCustomModel = useStore((s) => s.updateCustomModel);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    // Only run this once on app load
    if (hasStarted || !customModels || customModels.length === 0) return;
    setHasStarted(true);

    let mounted = true;

    const runPreload = async () => {
      // Small delay to allow initial 3D scene to render without blocking main thread
      await new Promise(resolve => setTimeout(resolve, 2000));

      for (const model of customModels) {
        if (!mounted) break;
        let changed = false;
        const newModel: CustomEquipmentModel = { ...model };

        // 1. Base model thumbnail
        if (!newModel.modelPngRaw && newModel.modelSvgRaw) {
          try {
            newModel.modelPngRaw = await convertSvgToPngAsync(
              newModel.modelSvgRaw,
              newModel.equipmentSize?.width || 860,
              newModel.equipmentSize?.height || 200
            );
            changed = true;
          } catch (e) {
            console.warn("Failed to generate base thumbnail for", newModel.modelId);
          }
        }

        // 2. Variants thumbnails
        if (newModel.modelType === "card-based" && newModel.variants && newModel.variants.length > 0) {
          const newVariants = [...newModel.variants];
          for (let i = 0; i < newVariants.length; i++) {
            const variant = newVariants[i];
            if (!variant.variantPngRaw && variant.insertedCards && variant.insertedCards.length > 0) {
              try {
                // Ensure baseEquipmentViewSvgRaw exists for composing
                const baseRaw = newModel.baseEquipmentViewSvgRaw || newModel.modelSvgRaw;
                if (!baseRaw) continue;

                // Create a temporary composer model matching expected shape
                const composerModel = {
                  ...newModel,
                  baseEquipmentViewSvgRaw: baseRaw,
                };

                const composedSvg = await generateComposedSvgAsync(
                  newModel.modelName,
                  composerModel as any,
                  variant.insertedCards,
                  [],
                  "front"
                );

                if (composedSvg) {
                  const png = await convertSvgToPngAsync(
                    composedSvg,
                    newModel.equipmentSize?.width || 860,
                    newModel.equipmentSize?.height || 200
                  );
                  if (png) {
                    newVariants[i] = { ...variant, variantPngRaw: png };
                    changed = true;
                  }
                }
              } catch (e) {
                console.warn("Failed to generate variant thumbnail for", newModel.modelId, variant.variantId);
              }
            }
          }
          if (changed) {
            newModel.variants = newVariants;
          }
        }

        if (changed && mounted) {
          updateCustomModel(newModel.modelId, newModel);
        }
      }
    };

    runPreload();

    return () => {
      mounted = false;
    };
  }, [customModels, hasStarted, updateCustomModel]);

  return null;
};
