import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Permite acessar o servidor de dev (e os recursos de HMR/hidratacao) pelo IP da rede local,
  // necessario pra testar em celulares (iOS/Android) conectados no mesmo Wi-Fi.
  allowedDevOrigins: ["192.168.100.48"],
  // @napi-rs/canvas tem um binario nativo por plataforma (usado por lib/pdfjsPolyfills.ts para
  // suprir DOMMatrix/Path2D/ImageData, que o pdfjs-dist espera encontrar mesmo so extraindo
  // texto). O Turbopack nao consegue empacotar o loader desse binario num chunk ESM ("asset is
  // not placeable in ESM chunks") — precisa ficar de fora do bundle e ser resolvido via require()
  // nativo do Node em runtime.
  serverExternalPackages: ["@napi-rs/canvas"],
};

export default nextConfig;
