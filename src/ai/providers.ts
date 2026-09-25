/**
 * Optional AI service layer.
 *
 * The app never depends on an AI provider: with no configuration every
 * feature works locally. To add a provider, stand up a small backend that
 * proxies your AI of choice and point the VITE_AI_* endpoints at it.
 *
 * What an external provider could add beyond local heuristics:
 *   - true face detection and face-aware portrait cropping
 *   - semantic tagging (food, architecture, events)
 *   - learned enhancement models
 * Why it is optional: the local engine already covers analysis + editing.
 * Where keys go: server-side only. A VITE_AI_API_KEY exists solely for local
 * experiments against a backend you control and is never required.
 */
import type { AnalysisResult } from '../types';

export interface ImageAnalysisProvider {
  readonly name: string;
  /** Returns partial analysis fields; local heuristics fill any gaps. */
  analyze(image: Blob): Promise<Partial<AnalysisResult>>;
}

export interface ImageEnhancementProvider {
  readonly name: string;
  enhance(image: Blob, instructions: string): Promise<Blob>;
}

/** Default provider: no network, no-op. Local analysis handles everything. */
export class LocalProvider implements ImageAnalysisProvider, ImageEnhancementProvider {
  readonly name = 'local';
  async analyze(): Promise<Partial<AnalysisResult>> {
    return {};
  }
  async enhance(image: Blob): Promise<Blob> {
    return image;
  }
}

/** Generic HTTP provider for your own backend proxy. */
export class HttpProvider implements ImageAnalysisProvider, ImageEnhancementProvider {
  readonly name = 'http';
  constructor(
    private analysisEndpoint: string,
    private enhanceEndpoint: string,
    private apiKey?: string,
  ) {}

  private headers(): Record<string, string> {
    return this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {};
  }

  async analyze(image: Blob): Promise<Partial<AnalysisResult>> {
    const res = await fetch(this.analysisEndpoint, {
      method: 'POST',
      headers: this.headers(),
      body: image,
    });
    if (!res.ok) throw new Error(`Analysis service failed (${res.status})`);
    return (await res.json()) as Partial<AnalysisResult>;
  }

  async enhance(image: Blob, instructions: string): Promise<Blob> {
    const form = new FormData();
    form.append('image', image);
    form.append('instructions', instructions);
    const res = await fetch(this.enhanceEndpoint, {
      method: 'POST',
      headers: this.headers(),
      body: form,
    });
    if (!res.ok) throw new Error(`Enhancement service failed (${res.status})`);
    return res.blob();
  }
}

export function getProviders(): { analysis: ImageAnalysisProvider; enhancement: ImageEnhancementProvider } {
  const provider = import.meta.env.VITE_AI_PROVIDER ?? 'none';
  if (
    provider === 'http' &&
    import.meta.env.VITE_AI_ANALYSIS_ENDPOINT &&
    import.meta.env.VITE_AI_ENHANCE_ENDPOINT
  ) {
    const http = new HttpProvider(
      import.meta.env.VITE_AI_ANALYSIS_ENDPOINT,
      import.meta.env.VITE_AI_ENHANCE_ENDPOINT,
      import.meta.env.VITE_AI_API_KEY,
    );
    return { analysis: http, enhancement: http };
  }
  const local = new LocalProvider();
  return { analysis: local, enhancement: local };
}
