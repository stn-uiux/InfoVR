export interface Point {
  x: number;
  y: number;
}

/**
 * Calculates the homography matrix from source points to destination points.
 * Solves the system of 8 linear equations.
 */
function getHomography(src: Point[], dst: Point[]): number[] {
  const A = [];
  const B = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const u = dst[i].x;
    const v = dst[i].y;
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    B.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    B.push(v);
  }

  // Gaussian elimination
  const N = 8;
  for (let i = 0; i < N; i++) {
    let maxEl = Math.abs(A[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < N; k++) {
      if (Math.abs(A[k][i]) > maxEl) {
        maxEl = Math.abs(A[k][i]);
        maxRow = k;
      }
    }
    // Swap rows
    for (let k = i; k < N; k++) {
      const tmp = A[maxRow][k];
      A[maxRow][k] = A[i][k];
      A[i][k] = tmp;
    }
    const tmpB: number = B[maxRow];
    B[maxRow] = B[i];
    B[i] = tmpB;

    for (let k = i + 1; k < N; k++) {
      const c = -A[k][i] / A[i][i];
      for (let j = i; j < N; j++) {
        if (i === j) {
          A[k][j] = 0;
        } else {
          A[k][j] += c * A[i][j];
        }
      }
      B[k] += c * B[i];
    }
  }

  const h = new Array(8).fill(0);
  for (let i = N - 1; i >= 0; i--) {
    h[i] = B[i] / A[i][i];
    for (let k = i - 1; k >= 0; k--) {
      B[k] -= A[k][i] * h[i];
    }
  }
  return [...h, 1];
}

/**
 * Warps a region of the source image defined by 4 points into a rectangular image.
 */
export async function warpPerspective(
  imageSrc: string,
  srcPoints: Point[], // [TL, TR, BR, BL]
  destWidth: number,
  destHeight: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      // dstPoints is a perfect rectangle
      const dstPoints: Point[] = [
        { x: 0, y: 0 },
        { x: destWidth, y: 0 },
        { x: destWidth, y: destHeight },
        { x: 0, y: destHeight },
      ];

      // Calculate the homography matrix from DEST to SRC
      // (reverse mapping is easier to implement without holes)
      const H = getHomography(dstPoints, srcPoints);

      const srcCanvas = document.createElement("canvas");
      srcCanvas.width = img.width;
      srcCanvas.height = img.height;
      const srcCtx = srcCanvas.getContext("2d", { willReadFrequently: true });
      if (!srcCtx) return reject("Canvas 2D not supported");
      srcCtx.drawImage(img, 0, 0);
      const srcData = srcCtx.getImageData(0, 0, img.width, img.height);

      const dstCanvas = document.createElement("canvas");
      dstCanvas.width = destWidth;
      dstCanvas.height = destHeight;
      const dstCtx = dstCanvas.getContext("2d");
      if (!dstCtx) return reject("Canvas 2D not supported");
      const dstData = dstCtx.createImageData(destWidth, destHeight);

      // Perform reverse mapping
      for (let y = 0; y < destHeight; y++) {
        for (let x = 0; x < destWidth; x++) {
          const z = H[6] * x + H[7] * y + H[8];
          const srcX = (H[0] * x + H[1] * y + H[2]) / z;
          const srcY = (H[3] * x + H[4] * y + H[5]) / z;

          // Nearest neighbor interpolation (for simplicity and speed)
          const sx = Math.round(srcX);
          const sy = Math.round(srcY);

          if (sx >= 0 && sx < img.width && sy >= 0 && sy < img.height) {
            const dstIdx = (y * destWidth + x) * 4;
            const srcIdx = (sy * img.width + sx) * 4;
            dstData.data[dstIdx] = srcData.data[srcIdx];
            dstData.data[dstIdx + 1] = srcData.data[srcIdx + 1];
            dstData.data[dstIdx + 2] = srcData.data[srcIdx + 2];
            dstData.data[dstIdx + 3] = srcData.data[srcIdx + 3];
          }
        }
      }

      dstCtx.putImageData(dstData, 0, 0);
      resolve(dstCanvas.toDataURL("image/jpeg", 0.95));
    };
    img.onerror = () => reject("Failed to load image for warping");
    img.src = imageSrc;
  });
}
