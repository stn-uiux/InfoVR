import sampleCardsRaw from "./sampleCards.json";
import type { Device } from "../types";
import type { InsertedCard, CustomEquipmentModel } from "../types/equipment";

const sampleCards = sampleCardsRaw as Record<string, any[]>;

/**
 * Returns the effective inserted cards for a device.
 * For sample devices that haven't been modified by the user, this prioritizes
 * the custom model's default variant cards over the hardcoded sample cards.
 */
export function getEffectiveCards(
  device: Pick<Device, "modelName" | "insertedCards">, 
  customModels: CustomEquipmentModel[]
): InsertedCard[] {
  const dCards = device.insertedCards || [];
  
  // 1. Find matching custom model and variant name
  let overrideModel = customModels.find((m) => m.modelName === device.modelName);
  let targetVariantName = "기본타입";
  
  if (!overrideModel) {
    overrideModel = customModels.find((m) => device.modelName?.startsWith(m.modelName + " "));
    if (overrideModel && device.modelName) {
      targetVariantName = device.modelName.substring(overrideModel.modelName.length + 1);
    }
  }

  const sCards = sampleCards[device.modelName || ""] || sampleCards[overrideModel?.modelName || ""];

  // 2. Check if dCards exactly match sCards (unmodified sample)
  let isUnmodifiedSample = false;
  if (sCards && dCards.length === sCards.length) {
    if (dCards.length === 0) {
      isUnmodifiedSample = true;
    } else {
      isUnmodifiedSample = dCards.every(
        (c, i) => c.cardType === sCards[i].cardType && c.positionIndex === sCards[i].positionIndex
      );
    }
  }

  // 3. If device has customized cards (and not just an unmodified sample), use them.
  if (dCards.length > 0 && !isUnmodifiedSample) {
    return dCards;
  }

  // 4. Fallback to custom model's variant
  if (overrideModel?.variants?.length) {
    const targetVariant = overrideModel.variants.find((v: any) => v.variantName === targetVariantName);
    if (targetVariant?.insertedCards) return targetVariant.insertedCards;
    if (overrideModel.variants[0]?.insertedCards) return overrideModel.variants[0].insertedCards;
  }

  // 5. Fallback to sampleCards
  if (sCards) return sCards as InsertedCard[];

  return [];
}
