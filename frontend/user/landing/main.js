/**
 * PRAGATI - Canvas Video Scroll Animation Engine
 * Smoothly syncs 266 infrastructure video frames to page scroll
 */

const TOTAL_FRAMES = 266;

function initCanvasAnimation() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  const images = new Array(TOTAL_FRAMES).fill(null);
  const loadedFlags = new Array(TOTAL_FRAMES).fill(false);
  let loadedCount = 0;

  let currentFrame = 0;
  let targetFrame = 0;
  let activeImage = null;
  let animFrameId = null;

  const loaderBar = document.getElementById('loader-bar');

  const getFramePath = (index, basePrefix = '/frames/') => {
    const paddedIndex = String(index).padStart(6, '0');
    return `${basePrefix}frame_${paddedIndex}.png`;
  };

  const resizeCanvas = () => {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    if (activeImage) {
      renderFrame(activeImage);
    }
  };

  const renderFrame = (img) => {
    if (!img || !img.complete || img.naturalWidth === 0) return;
    activeImage = img;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;

    const imgAspect = imgWidth / imgHeight;
    const canvasAspect = canvasWidth / canvasHeight;

    let drawWidth, drawHeight, offsetX, offsetY;

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

  const findNearestLoadedFrame = (targetIndex) => {
    if (loadedFlags[targetIndex] && images[targetIndex]) {
      return images[targetIndex];
    }

    for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
      const prev = targetIndex - offset;
      const next = targetIndex + offset;

      if (prev >= 0 && loadedFlags[prev] && images[prev]) return images[prev];
      if (next < TOTAL_FRAMES && loadedFlags[next] && images[next]) return images[next];
    }
    return activeImage;
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

    const imgToDraw = findNearestLoadedFrame(frameIndex);
    if (imgToDraw && imgToDraw !== activeImage) {
      renderFrame(imgToDraw);
    }

    animFrameId = requestAnimationFrame(animate);
  };

  window.addEventListener('resize', resizeCanvas, { passive: true });
  window.addEventListener('scroll', updateScrollTarget, { passive: true });
  window.addEventListener('wheel', updateScrollTarget, { passive: true });
  window.addEventListener('touchmove', updateScrollTarget, { passive: true });

  resizeCanvas();
  updateScrollTarget();
  animFrameId = requestAnimationFrame(animate);

  // Load first frame immediately
  let resolvedBase = '/frames/';
  const img1 = new Image();
  img1.src = getFramePath(1, resolvedBase);
  img1.onload = () => {
    images[0] = img1;
    loadedFlags[0] = true;
    loadedCount++;
    renderFrame(img1);
    preloadAllFrames(resolvedBase);
  };
  img1.onerror = () => {
    // Try relative path
    resolvedBase = './frames/';
    const img1Fallback = new Image();
    img1Fallback.src = getFramePath(1, resolvedBase);
    img1Fallback.onload = () => {
      images[0] = img1Fallback;
      loadedFlags[0] = true;
      loadedCount++;
      renderFrame(img1Fallback);
      preloadAllFrames(resolvedBase);
    };
    img1Fallback.onerror = () => {
      // Still start preloading remaining frames
      preloadAllFrames('/frames/');
    };
  };

  function preloadAllFrames(basePrefix) {
    const batchSize = 20;
    let currentIndex = 1;

    function loadNextBatch() {
      if (currentIndex > TOTAL_FRAMES) {
        if (loaderBar) {
          loaderBar.style.width = '100%';
          setTimeout(() => { loaderBar.style.opacity = '0'; }, 300);
        }
        return;
      }

      const end = Math.min(TOTAL_FRAMES, currentIndex + batchSize - 1);
      for (let i = currentIndex; i <= end; i++) {
        const arrayIdx = i - 1;
        if (images[arrayIdx]) continue;

        const img = new Image();
        img.src = getFramePath(i, basePrefix);

        const onComplete = () => {
          images[arrayIdx] = img;
          loadedFlags[arrayIdx] = true;
          loadedCount++;

          if (!activeImage) {
            renderFrame(img);
          }

          const percent = Math.round((loadedCount / TOTAL_FRAMES) * 100);
          if (loaderBar) {
            loaderBar.style.width = `${percent}%`;
          }
        };

        img.onload = onComplete;
        img.onerror = () => {
          // If failed on root, try relative once
          if (basePrefix === '/frames/') {
            const retryImg = new Image();
            retryImg.src = getFramePath(i, './frames/');
            retryImg.onload = () => {
              images[arrayIdx] = retryImg;
              loadedFlags[arrayIdx] = true;
              loadedCount++;
              if (!activeImage) renderFrame(retryImg);
            };
            retryImg.onerror = onComplete;
          } else {
            onComplete();
          }
        };
      }

      currentIndex = end + 1;
      setTimeout(loadNextBatch, 10);
    }

    loadNextBatch();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCanvasAnimation);
} else {
  initCanvasAnimation();
}
