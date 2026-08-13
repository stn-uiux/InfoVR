import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SpotLightWithTargetProps {
  position: [number, number, number];
  targetPosition: [number, number, number];
  color: string;
  intensity: number;
  angle: number;
  penumbra: number;
  distance: number;
  castShadow?: boolean;
}

export function SpotLightWithTarget({
  position,
  targetPosition,
  color,
  intensity,
  angle,
  penumbra,
  distance,
  castShadow = false,
}: SpotLightWithTargetProps) {
  const lightRef = useRef<THREE.SpotLight>(null);
  const targetRef = useRef<THREE.Object3D>(null);

  useFrame(() => {
    if (lightRef.current && targetRef.current) {
      // Point the spotlight at the target
      lightRef.current.target = targetRef.current;
    }
  });

  return (
    <>
      <spotLight
        ref={lightRef}
        position={position}
        color={color}
        intensity={intensity}
        angle={angle}
        penumbra={penumbra}
        distance={distance}
        decay={2}
        castShadow={castShadow}
      />
      <object3D ref={targetRef} position={targetPosition} />
    </>
  );
}
