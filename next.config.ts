import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Permite acessar o servidor de dev (e os recursos de HMR/hidratacao) pelo IP da rede local,
  // necessario pra testar em celulares (iOS/Android) conectados no mesmo Wi-Fi.
  allowedDevOrigins: ["192.168.100.17"],
};

export default nextConfig;
