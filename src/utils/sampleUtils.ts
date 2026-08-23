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
  const sCards = sampleCards[device.modelName || ""];

  if (!sCards) {
    if (dCards.length > 0) return dCards;
    
    // Fallback to custom model's default variant if it exists
    const overrideModel = customModels.find((m) => m.modelName === device.modelName);
    if (overrideModel?.variants?.length) {
      const defaultVariant = overrideModel.variants.find((v: any) => v.variantName === "기본타입");
      if (defaultVariant?.insertedCards) return defaultVariant.insertedCards;
      if (overrideModel.variants[0]?.insertedCards) return overrideModel.variants[0].insertedCards;
    }
    return [];
  }

  // Check if device's cards exactly match the sample cards
  let isUnmodifiedSample = false;
  if (dCards.length === sCards.length) {
    if (dCards.length === 0) {
      isUnmodifiedSample = true;
    } else {
      isUnmodifiedSample = dCards.every(
        (c, i) => c.cardType === sCards[i].cardType && c.positionIndex === sCards[i].positionIndex
      );
    }
  }

  if (isUnmodifiedSample) {
    // Prioritize custom model's default variant
    const overrideModel = customModels.find((m) => m.modelName === device.modelName);
    if (overrideModel?.variants?.length) {
      const defaultVariant = overrideModel.variants.find((v: any) => v.variantName === "기본타입");
      if (defaultVariant?.insertedCards) return defaultVariant.insertedCards;
      if (overrideModel.variants[0]?.insertedCards) return overrideModel.variants[0].insertedCards;
    }
    
    // Fallback to sample cards
    return sCards as InsertedCard[];
  }

  return dCards;
}
