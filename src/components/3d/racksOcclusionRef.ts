import * as THREE from "three";

/**
 * Global shared ref holding the Group containing all active Rack meshes.
 * Used exclusively for rack-specific occlusion testing of device nametags
 * so that ONLY racks occlude device labels, ignoring other objects.
 */
export const racksContainerRef: { current: THREE.Group | null } = {
  current: null,
};
