import { AdSource, AdPlacement } from '../types';

export class ResourceManager {
  private cv: any;
  private adSources: Map<string, AdSource> = new Map();

  constructor(cv: any) {
    this.cv = cv;
  }

  async loadAdImage(id: string, url: string): Promise<AdSource> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        const adSource: AdSource = {
          id,
          type: 'image',
          element: img,
          url
        };
        this.adSources.set(id, adSource);
        resolve(adSource);
      };

      img.onerror = () => reject(new Error(`Failed to load ad image: ${url}`));
      img.src = url;
    });
  }

  getAdSource(id: string): AdSource | undefined {
    return this.adSources.get(id);
  }

  getAllAdSources(): AdSource[] {
    return Array.from(this.adSources.values());
  }

  clearAll(): void {
    this.adSources.clear();
  }
}
