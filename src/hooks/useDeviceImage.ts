import { useState, useEffect } from "react";
import { resolveDeviceImage, resolveDeviceSvgContent, isChassisModel } from "../utils/deviceAssets";

/**
 * 썸네일 이미지(URL 혹은 Data URL)를 반환하는 훅.
 * 기본적으로 동기 함수인 resolveDeviceImage를 사용하되, 
 * 아직 SVG가 캐시에 없는 섀시 모델의 경우 비동기로 SVG를 불러온 뒤 Data URL을 얻어오도록 합니다.
 */
export const useDeviceImage = (modelName?: string, side: "front" | "rear" = "front") => {
  const [imageSrc, setImageSrc] = useState<string | undefined>(resolveDeviceImage(modelName, side));

  useEffect(() => {
    if (!modelName) {
      setImageSrc(undefined);
      return;
    }

    // 1. 먼저 동기적으로 이미지 확인 (캐시 히트 등)
    const initialSrc = resolveDeviceImage(modelName, side);
    if (initialSrc) {
      setImageSrc(initialSrc);
      return;
    }

    // 2. 만약 이미지가 없고 섀시 모델이라면, 비동기로 SVG를 로드하도록 트리거
    if (isChassisModel(modelName)) {
      let isMounted = true;
      resolveDeviceSvgContent(modelName, side).then(() => {
        if (!isMounted) return;
        // SVG 로드(캐싱) 완료 후, 다시 resolveDeviceImage를 호출하면 SVG Data URL이 동기 반환됨
        setImageSrc(resolveDeviceImage(modelName, side));
      });
      return () => {
        isMounted = false;
      };
    } else {
      // 섀시가 아닌데 이미지가 없으면 그냥 undefined
      setImageSrc(undefined);
    }
  }, [modelName, side]);

  return imageSrc;
};
