/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WEB3FORMS_ACCESS_KEY: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY: string;
  readonly VITE_SHOPIFY_STORE_DOMAIN?: string;
  readonly VITE_SHOPIFY_STOREFRONT_TOKEN?: string;
  readonly VITE_OAUTH_GOOGLE_ENABLED?: string;
  readonly VITE_OAUTH_APPLE_ENABLED?: string;
  readonly VITE_OAUTH_FACEBOOK_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
