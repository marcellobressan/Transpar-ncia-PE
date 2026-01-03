/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATABASE_URL: string;
  readonly GEMINI_API_KEY?: string;
  readonly VITE_DADOS_GOV_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
