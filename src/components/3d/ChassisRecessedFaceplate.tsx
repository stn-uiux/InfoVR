import { useMemo, forwardRef, memo } from "react";
import { Mesh, DoubleSide, PlaneGeometry } from "three";
import { useTexture } from "@react-three/drei";
import type { Device } from "../../types";
import { useStore } from "../../store/useStore";
import {
  getChassisEmptySlots,
  convertSlotsTo3D,
  createSubPlaneGeometry,
} from "../../utils/chassis3dHelpers";

interface ChassisRecessedFaceplateProps {
  device: Device;
  url: string;
  width: number;
  height: number;
  validDepth: number;
  hasError?: boolean;
}

export const ChassisRecessedFaceplate = memo(
  forwardRef<Mesh, ChassisRecessedFaceplateProps>(
    ({ device, url, width, height, validDepth, hasError }, ref) => {
      const texture = useTexture(url);
      const customModels = useStore((s) => s.customModels);

      const { model, emptySlots, occupiedSlots, allSlots } = useMemo(
        () => getChassisEmptySlots(device, customModels),
        [device, customModels]
      );

      const svgW = model?.equipmentSize?.width || 984;
      const svgH = model?.equipmentSize?.height || device.size * 96;

      const emptySlots3D = useMemo(() => {
        if (!emptySlots || emptySlots.length === 0) return [];
        return convertSlotsTo3D(emptySlots, width, height, svgW, svgH);
      }, [emptySlots, width, height, svgW, svgH]);

      const occupiedSlots3D = useMemo(() => {
        if (!occupiedSlots || occupiedSlots.length === 0) return [];
        return convertSlotsTo3D(occupiedSlots, width, height, svgW, svgH);
      }, [occupiedSlots, width, height, svgW, svgH]);

      const allSlots3D = useMemo(() => {
        if (!allSlots || allSlots.length === 0) return [];
        return convertSlotsTo3D(allSlots, width, height, svgW, svgH);
      }, [allSlots, width, height, svgW, svgH]);

      // 카드 베이(통 챔버) 3D 영역 계산
      const bay = useMemo(() => {
        if (allSlots3D.length === 0 && emptySlots3D.length === 0) return null;

        const halfW = width / 2;
        const halfH = height / 2;

        if (model?.cardArea && (model.cardArea.width < svgW || model.cardArea.height < svgH)) {
          const ca = model.cardArea;
          const bayW = (ca.width / svgW) * width;
          const bayH = (ca.height / svgH) * height;
          const bayX = -halfW + (ca.x / svgW) * width + bayW / 2;
          const bayY = halfH - (ca.y / svgH) * height - bayH / 2;
          return { bayX, bayY, bayW, bayH };
        }

        // cardArea가 없거나 장비 전체로 지정된 경우 슬롯들의 실제 바운딩 박스로 산출
        const targetSlots = allSlots3D.length > 0 ? allSlots3D : emptySlots3D;
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        targetSlots.forEach((s) => {
          minX = Math.min(minX, s.x3d - s.w3d / 2);
          maxX = Math.max(maxX, s.x3d + s.w3d / 2);
          minY = Math.min(minY, s.y3d - s.h3d / 2);
          maxY = Math.max(maxY, s.y3d + s.h3d / 2);
        });

        // 만약 슬롯 바운딩 박스가 장비 전체와 완전히 일치하면 상/하단 기본 베젤 보호 마진 적용
        if (maxX - minX >= width - 0.001) {
          minX = -halfW + width * 0.07;
          maxX = halfW - width * 0.07;
        }
        if (maxY - minY >= height - 0.001) {
          maxY = halfH - height * 0.1;
          minY = -halfH + height * 0.09;
        }

        const bayW = Math.max(0.01, maxX - minX);
        const bayH = Math.max(0.01, maxY - minY);
        const bayX = (minX + maxX) / 2;
        const bayY = (minY + maxY) / 2;
        return { bayX, bayY, bayW, bayH };
      }, [allSlots3D, emptySlots3D, model, svgW, svgH, width, height]);

      // 베젤 4면 (Top, Bottom, Left, Right) - Earcut을 전혀 사용하지 않는 순수 사각형 평면
      const bezels = useMemo(() => {
        if (!bay) return [];
        const halfW = width / 2;
        const halfH = height / 2;
        const list: Array<{
          geom: PlaneGeometry;
          pos: [number, number, number];
          key: string;
        }> = [];

        const bayLeft = bay.bayX - bay.bayW / 2;
        const bayRight = bay.bayX + bay.bayW / 2;
        const bayBottom = bay.bayY - bay.bayH / 2;
        const bayTop = bay.bayY + bay.bayH / 2;

        // 1. 상단 베젤
        const topH = halfH - bayTop;
        if (topH > 0.001) {
          const uMin = 0;
          const uMax = 1;
          const vMin = Math.max(0, Math.min(1, (bayTop + halfH) / height));
          const vMax = 1;
          list.push({
            geom: createSubPlaneGeometry(width, topH, uMin, uMax, vMin, vMax),
            pos: [0, halfH - topH / 2, 0],
            key: "bezel-top",
          });
        }

        // 2. 하단 베젤
        const bottomH = bayBottom - (-halfH);
        if (bottomH > 0.001) {
          const uMin = 0;
          const uMax = 1;
          const vMin = 0;
          const vMax = Math.max(0, Math.min(1, (bayBottom + halfH) / height));
          list.push({
            geom: createSubPlaneGeometry(width, bottomH, uMin, uMax, vMin, vMax),
            pos: [0, -halfH + bottomH / 2, 0],
            key: "bezel-bottom",
          });
        }

        // 3. 좌측 베젤 (bay 높이 구간)
        const leftW = bayLeft - (-halfW);
        if (leftW > 0.001) {
          const uMin = 0;
          const uMax = Math.max(0, Math.min(1, (bayLeft + halfW) / width));
          const vMin = Math.max(0, Math.min(1, (bayBottom + halfH) / height));
          const vMax = Math.max(0, Math.min(1, (bayTop + halfH) / height));
          list.push({
            geom: createSubPlaneGeometry(leftW, bay.bayH, uMin, uMax, vMin, vMax),
            pos: [-halfW + leftW / 2, bay.bayY, 0],
            key: "bezel-left",
          });
        }

        // 4. 우측 베젤 (bay 높이 구간)
        const rightW = halfW - bayRight;
        if (rightW > 0.001) {
          const uMin = Math.max(0, Math.min(1, (bayRight + halfW) / width));
          const uMax = 1;
          const vMin = Math.max(0, Math.min(1, (bayBottom + halfH) / height));
          const vMax = Math.max(0, Math.min(1, (bayTop + halfH) / height));
          list.push({
            geom: createSubPlaneGeometry(rightW, bay.bayH, uMin, uMax, vMin, vMax),
            pos: [halfW - rightW / 2, bay.bayY, 0],
            key: "bezel-right",
          });
        }

        return list;
      }, [bay, width, height]);

      // 꽂혀 있는 카드들의 전면 플레이트 지오메트리 캐싱
      const occupiedCardGeoms = useMemo(() => {
        const halfW = width / 2;
        const halfH = height / 2;
        return occupiedSlots3D.map((slot) => {
          const uMin = Math.max(0, Math.min(1, (slot.x3d - slot.w3d / 2 + halfW) / width));
          const uMax = Math.max(0, Math.min(1, (slot.x3d + slot.w3d / 2 + halfW) / width));
          const vMin = Math.max(0, Math.min(1, (slot.y3d - slot.h3d / 2 + halfH) / height));
          const vMax = Math.max(0, Math.min(1, (slot.y3d + slot.h3d / 2 + halfH) / height));
          return createSubPlaneGeometry(slot.w3d, slot.h3d, uMin, uMax, vMin, vMax);
        });
      }, [occupiedSlots3D, width, height]);

      // 빈 슬롯이 없으면 기존의 단일 평면 메시 렌더링
      if (emptySlots3D.length === 0 || !bay) {
        return (
          <mesh position={[0, 0, 0]} ref={ref}>
            <planeGeometry args={[width, height]} />
            <meshStandardMaterial
              map={texture}
              color={hasError ? [0.8, 0.8, 0.8] : [2.5, 2.5, 2.5]}
              bumpMap={texture}
              bumpScale={10}
              toneMapped={false}
            />
          </mesh>
        );
      }

      // 사용자 요구사항: "뒤쪽면에서 1cm정도만 남기고 안쪽으로 들어가게"
      const cavityDepth = Math.max(0.02, validDepth - 0.01);
      const backZ = -cavityDepth;
      const midZ = -cavityDepth / 2;

      return (
        <group>
          {/* 1. 외곽 베젤 평면들 (상, 하, 좌, 우 4면 사각형 - Earcut 삼각분할 왜곡 0%) */}
          {bezels.map((b, idx) => (
            <mesh
              key={b.key}
              position={b.pos}
              geometry={b.geom}
              ref={idx === 0 ? ref : undefined}
            >
              <meshStandardMaterial
                map={texture}
                color={hasError ? [0.8, 0.8, 0.8] : [2.5, 2.5, 2.5]}
                bumpMap={texture}
                bumpScale={8}
                toneMapped={false}
                side={DoubleSide}
              />
            </mesh>
          ))}

          {/* 2. 꽂혀 있는 카드들: 전면 플레이트 (z = 0) + 3D 블레이드 차폐 바디 (옆면/윗면/아랫면 완벽 차폐) */}
          {occupiedSlots3D.map((slot, idx) => {
            const cardBodyDepth = cavityDepth - 0.001;
            const cardMidZ = -cardBodyDepth / 2 - 0.0005;
            const faceGeom = occupiedCardGeoms[idx];

            return (
              <group key={slot.slotId ?? `occupied-card-${slot.positionIndex}-${idx}`}>
                {/* 2-A. 전면 카드 플레이트 (텍스처 1:1 매핑 + 범프맵 요철 효과) */}
                {faceGeom && (
                  <mesh
                    position={[slot.x3d, slot.y3d, 0]}
                    geometry={faceGeom}
                    ref={bezels.length === 0 && idx === 0 ? ref : undefined}
                  >
                    <meshStandardMaterial
                      map={texture}
                      color={hasError ? [0.8, 0.8, 0.8] : [2.5, 2.5, 2.5]}
                      bumpMap={texture}
                      bumpScale={8}
                      toneMapped={false}
                      side={DoubleSide}
                    />
                  </mesh>
                )}

                {/* 2-B. 3D 블레이드 바디 (옆면, 윗면, 아랫면을 완벽히 차폐) */}
                <mesh position={[slot.x3d, slot.y3d, cardMidZ]}>
                  <boxGeometry
                    args={[
                      Math.max(0.001, slot.w3d - 0.0004),
                      Math.max(0.001, slot.h3d - 0.0004),
                      cardBodyDepth,
                    ]}
                  />
                  <meshStandardMaterial
                    color="#dce6f2"
                    roughness={0.16}
                    metalness={0.92}
                  />
                </mesh>
              </group>
            );
          })}

          {/* 3. 통 챔버 (Single Open Bay: 별도 조명 없이도 밝고 가벼운 알루미늄 메탈 톤) */}
          <group>
            {/* [A] 넓은 백플레인 바닥면 (뒤쪽 면에서 1cm 앞) */}
            <group position={[bay.bayX, bay.bayY, backZ]}>
              {/* 백플레인 기판 (밝은 슬레이트 실버 톤) */}
              <mesh position={[0, 0, 0]}>
                <planeGeometry args={[bay.bayW, bay.bayH]} />
                <meshStandardMaterial
                  color="#606d7d"
                  roughness={0.25}
                  metalness={0.7}
                />
              </mesh>

              {/* 빈 슬롯별 카드 커넥터 리셉터클 소켓들 (깊숙한 곳에 보이는 금색 핀 슬릿) */}
              {emptySlots3D.map((slot, idx) => {
                const isHorizontal = slot.w3d >= slot.h3d;
                // 바닥면 중심(bay.bayX, bay.bayY) 기준 상대 좌표
                const relX = slot.x3d - bay.bayX;
                const relY = slot.y3d - bay.bayY;

                return (
                  <group key={slot.slotId ?? `connector-${idx}`} position={[relX, relY, 0.001]}>
                    {/* 커넥터 소켓 바디 */}
                    <mesh position={[0, 0, 0]}>
                      <planeGeometry
                        args={
                          isHorizontal
                            ? [slot.w3d * 0.72, Math.max(0.004, slot.h3d * 0.2)]
                            : [Math.max(0.004, slot.w3d * 0.2), slot.h3d * 0.72]
                        }
                      />
                      <meshStandardMaterial
                        color="#2a333c"
                        roughness={0.3}
                        metalness={0.8}
                      />
                    </mesh>

                    {/* 선명하게 반짝이는 금색 핀 슬릿 (접점 라인) */}
                    <mesh position={[0, 0, 0.0008]}>
                      <planeGeometry
                        args={
                          isHorizontal
                            ? [slot.w3d * 0.66, Math.max(0.0015, slot.h3d * 0.06)]
                            : [Math.max(0.0015, slot.w3d * 0.06), slot.h3d * 0.66]
                        }
                      />
                      <meshStandardMaterial
                        color="#ffcc33"
                        roughness={0.15}
                        metalness={0.95}
                      />
                    </mesh>
                  </group>
                );
              })}
            </group>

            {/* [B] 통 챔버 외곽 4면 내벽 (밝은 쿨 알루미늄 메탈 벽) */}
            {/* 상단벽 */}
            <group
              position={[bay.bayX, bay.bayY + bay.bayH / 2, midZ]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <mesh position={[0, 0, 0]}>
                <planeGeometry args={[bay.bayW, cavityDepth]} />
                <meshStandardMaterial
                  color="#a8b7c7"
                  roughness={0.25}
                  metalness={0.75}
                />
              </mesh>
              {/* 상단 가이드 레일 스트립 */}
              <mesh position={[0, 0, 0.0005]}>
                <planeGeometry args={[bay.bayW * 0.95, cavityDepth * 0.15]} />
                <meshStandardMaterial
                  color="#cdd9e6"
                  roughness={0.15}
                  metalness={0.85}
                />
              </mesh>
            </group>

            {/* 하단벽 */}
            <group
              position={[bay.bayX, bay.bayY - bay.bayH / 2, midZ]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <mesh position={[0, 0, 0]}>
                <planeGeometry args={[bay.bayW, cavityDepth]} />
                <meshStandardMaterial
                  color="#9db0c2"
                  roughness={0.25}
                  metalness={0.75}
                />
              </mesh>
              {/* 하단 가이드 레일 스트립 */}
              <mesh position={[0, 0, 0.0005]}>
                <planeGeometry args={[bay.bayW * 0.95, cavityDepth * 0.15]} />
                <meshStandardMaterial
                  color="#cdd9e6"
                  roughness={0.15}
                  metalness={0.85}
                />
              </mesh>
            </group>

            {/* 좌측벽 */}
            <group
              position={[bay.bayX - bay.bayW / 2, bay.bayY, midZ]}
              rotation={[0, Math.PI / 2, 0]}
            >
              <mesh position={[0, 0, 0]}>
                <planeGeometry args={[cavityDepth, bay.bayH]} />
                <meshStandardMaterial
                  color="#a2b3c4"
                  roughness={0.25}
                  metalness={0.75}
                />
              </mesh>
              {/* 좌측 가이드 레일 스트립 */}
              <mesh position={[0, 0, 0.0005]}>
                <planeGeometry args={[cavityDepth * 0.95, Math.max(0.003, bay.bayH * 0.1)]} />
                <meshStandardMaterial
                  color="#cdd9e6"
                  roughness={0.15}
                  metalness={0.85}
                />
              </mesh>
            </group>

            {/* 우측벽 */}
            <group
              position={[bay.bayX + bay.bayW / 2, bay.bayY, midZ]}
              rotation={[0, -Math.PI / 2, 0]}
            >
              <mesh position={[0, 0, 0]}>
                <planeGeometry args={[cavityDepth, bay.bayH]} />
                <meshStandardMaterial
                  color="#a2b3c4"
                  roughness={0.25}
                  metalness={0.75}
                />
              </mesh>
              {/* 우측 가이드 레일 스트립 */}
              <mesh position={[0, 0, 0.0005]}>
                <planeGeometry args={[cavityDepth * 0.95, Math.max(0.003, bay.bayH * 0.1)]} />
                <meshStandardMaterial
                  color="#cdd9e6"
                  roughness={0.15}
                  metalness={0.85}
                />
              </mesh>
            </group>
          </group>
        </group>
      );
    }
  )
);
ChassisRecessedFaceplate.displayName = "ChassisRecessedFaceplate";
