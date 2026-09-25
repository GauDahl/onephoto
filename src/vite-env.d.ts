/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AI_PROVIDER?: string;
  readonly VITE_AI_ANALYSIS_ENDPOINT?: string;
  readonly VITE_AI_ENHANCE_ENDPOINT?: string;
  readonly VITE_AI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
