(() => {
  // Safari/iOS does not consistently expose the native BarcodeDetector API.
  // Provide the same tiny surface TruWorth uses, backed by open-source ZXing.
  if ('BarcodeDetector' in window) return;

  const ZXING_SRC = 'https://unpkg.com/@zxing/browser@0.2.1';
  let loader = null;

  function loadZXing() {
    if (window.ZXingBrowser?.BrowserMultiFormatOneDReader) return Promise.resolve();
    if (loader) return loader;
    loader = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${ZXING_SRC}"]`);
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = ZXING_SRC;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = resolve;
      script.onerror = () => reject(new Error('ZXing barcode reader could not load'));
      document.head.appendChild(script);
    });
    return loader;
  }

  class TruWorthBarcodeDetector {
    constructor(options = {}) {
      this.formats = Array.isArray(options.formats) ? options.formats : [];
    }

    static async getSupportedFormats() {
      return ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'itf'];
    }

    async detect(source) {
      try {
        await loadZXing();
        if (!window.ZXingBrowser?.BrowserMultiFormatOneDReader) return [];

        const width = Number(source?.width || source?.videoWidth || source?.naturalWidth || 0);
        const height = Number(source?.height || source?.videoHeight || source?.naturalHeight || 0);
        if (!width || !height) return [];

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(source, 0, 0, width, height);

        const reader = new window.ZXingBrowser.BrowserMultiFormatOneDReader();
        const result = await reader.decodeFromCanvas(canvas);
        const rawValue = String(result?.getText?.() || result?.text || '').replace(/\s+/g, '');
        if (!/^\d{8,14}$/.test(rawValue)) return [];
        return [{ rawValue, format: 'ean_13' }];
      } catch (error) {
        // A non-match is normal. Let OCR / visual recognition continue.
        console.debug('ZXing barcode fallback found no code', error?.name || error?.message || error);
        return [];
      }
    }
  }

  window.BarcodeDetector = TruWorthBarcodeDetector;
})();