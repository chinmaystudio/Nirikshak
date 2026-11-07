import React, { useEffect, useRef, useState } from 'react';

const TOTAL_FRAMES = 266;

export const ScrollCanvasBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const images: (HTMLImageElement | null)[] = new Array(TOTAL_FRAMES).fill(null);
    const loadedFlags: boolean[] = new Array(TOTAL_FRAMES).fill(false);
    const loadingFlags: boolean[] = new Array(TOTAL_FRAMES).fill(false);
    let loadedCount = 0;

    // Bounded window loading: only frames near the current scroll position are
    // kept in memory (previously all 266 frames — ~218 MB — were preloaded on
    // mount). Frames far behind/ahead are evicted again.
    const WINDOW_RADIUS = 12;
    const EVICT_DISTANCE = WINDOW_RADIUS * 2;
    const LOAD_BATCH_SIZE = 4;
    // The top progress bar only tracks readiness of the first window of frames.
    const INITIAL_FRAME_COUNT = Math.min(TOTAL_FRAMES, WINDOW_RADIUS + 1);
    let loadQueue: number[] = [];
    let loadTimer: ReturnType<typeof setTimeout> | null = null;
    let lastWindowCenter = -1;

    let currentFrame = 0;
    let targetFrame = 0;
    let activeImage: HTMLImageElement | null = null;
    let animFrameId: number;

    const getFramePath = (index: number) => {
      const paddedIndex = String(index).padStart(6, '0');
      return `/frames/frame_${paddedIndex}.png`;
    };

    const resizeCanvas = () => {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;

      if (activeImage) {
        renderFrame(activeImage);
      }
    };

    const renderFrame = (img: HTMLImageElement) => {
      if (!img || !img.complete || img.naturalWidth === 0) return;
      activeImage = img;

      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;

      const imgAspect = imgWidth / imgHeight;
      const canvasAspect = canvasWidth / canvasHeight;

      let drawWidth: number, drawHeight: number, offsetX: number, offsetY: number;

      if (canvasAspect > imgAspect) {
        drawWidth = canvasWidth;
        drawHeight = canvasWidth / imgAspect;
        offsetX = 0;
        offsetY = (canvasHeight - drawHeight) / 2;
      } else {
        drawWidth = canvasHeight * imgAspect;
        drawHeight = canvasHeight;
        offsetX = (canvasWidth - drawWidth) / 2;
        offsetY = 0;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    };

    const findNearestLoadedFrame = (targetIndex: number) => {
      if (loadedFlags[targetIndex] && images[targetIndex]) {
        return images[targetIndex];
      }

      for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
        const prev = targetIndex - offset;
        const next = targetIndex + offset;

        if (prev >= 0 && loadedFlags[prev] && images[prev]) return images[prev];
        if (next < TOTAL_FRAMES && loadedFlags[next] && images[next]) return images[next];
      }
      return null;
    };

    const updateScrollTarget = () => {
      const scrollTop = Math.max(
        0,
        window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0
      );
      const docHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight
      );
      const maxScroll = Math.max(1, docHeight - window.innerHeight);
      const scrollFraction = Math.min(1, Math.max(0, scrollTop / maxScroll));
      targetFrame = scrollFraction * (TOTAL_FRAMES - 1);
    };

    const animate = () => {
      currentFrame += (targetFrame - currentFrame) * 0.15;
      let frameIndex = Math.round(currentFrame);
      frameIndex = Math.max(0, Math.min(TOTAL_FRAMES - 1, frameIndex));

      if (frameIndex !== lastWindowCenter) {
        lastWindowCenter = frameIndex;
        ensureWindow(frameIndex);
      }

      const imgToDraw = findNearestLoadedFrame(frameIndex);
      if (imgToDraw) {
        renderFrame(imgToDraw);
      }

      animFrameId = requestAnimationFrame(animate);
    };

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('scroll', updateScrollTarget, { passive: true });
    window.addEventListener('wheel', updateScrollTarget, { passive: true });
    window.addEventListener('touchmove', updateScrollTarget, { passive: true });

    resizeCanvas();
    updateScrollTarget();

    // Load the first window of frames immediately; further frames load (and
    // far frames are evicted) as the scroll position moves — see ensureWindow.
    ensureWindow(0);

    animFrameId = requestAnimationFrame(animate);

    function updateInitialProgress() {
      let ready = 0;
      for (let i = 0; i < INITIAL_FRAME_COUNT; i++) {
        if (loadedFlags[i]) ready++;
      }
      setLoadingProgress(Math.round((ready / INITIAL_FRAME_COUNT) * 100));
      if (ready >= INITIAL_FRAME_COUNT) {
        setIsLoaded(true);
      }
    }

    function loadFrame(arrayIdx: number) {
      if (loadedFlags[arrayIdx] || loadingFlags[arrayIdx]) return;
      loadingFlags[arrayIdx] = true;

      const img = new Image();
      img.src = getFramePath(arrayIdx + 1);

      const onComplete = () => {
        loadingFlags[arrayIdx] = false;
        images[arrayIdx] = img;
        loadedFlags[arrayIdx] = true;
        loadedCount++;
        if (arrayIdx < INITIAL_FRAME_COUNT) updateInitialProgress();
      };

      img.onload = onComplete;
      img.onerror = onComplete;
    }

    function processLoadQueue() {
      const batch = loadQueue.splice(0, LOAD_BATCH_SIZE);
      batch.forEach(loadFrame);
      if (loadQueue.length > 0) {
        loadTimer = setTimeout(processLoadQueue, 5);
      } else {
        loadTimer = null;
      }
    }

    function ensureWindow(center: number) {
      // Evict frames far from the current scroll position to bound memory.
      for (let i = 0; i < TOTAL_FRAMES; i++) {
        if (loadedFlags[i] && Math.abs(i - center) > EVICT_DISTANCE) {
          images[i] = null;
          loadedFlags[i] = false;
          loadedCount--;
        }
      }

      // Queue the missing frames inside the window, nearest first, in small batches.
      const missing: number[] = [];
      for (let offset = 0; offset <= WINDOW_RADIUS; offset++) {
        const prev = center - offset;
        const next = center + offset;
        if (prev >= 0 && !loadedFlags[prev] && !loadingFlags[prev] && !loadQueue.includes(prev)) missing.push(prev);
        if (next !== prev && next < TOTAL_FRAMES && !loadedFlags[next] && !loadingFlags[next] && !loadQueue.includes(next)) missing.push(next);
      }
      if (missing.length === 0) return;

      loadQueue = missing.concat(loadQueue);
      if (!loadTimer) processLoadQueue();
    }

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('scroll', updateScrollTarget);
      window.removeEventListener('wheel', updateScrollTarget);
      window.removeEventListener('touchmove', updateScrollTarget);
      cancelAnimationFrame(animFrameId);
      if (loadTimer) clearTimeout(loadTimer);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 block object-cover"
      />
      {!isLoaded && (
        <div
          className="fixed top-0 left-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-emerald-500 z-50 transition-all duration-150 pointer-events-none"
          style={{ width: `${loadingProgress}%` }}
        />
      )}
    </>
  );
};
