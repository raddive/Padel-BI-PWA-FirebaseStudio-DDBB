import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  output: 'export', // Habilita la exportación estática
  // Indica que tu app vive en /padelBI
   //basePath: '/padelBI',
  // Prefijo para los assets (CSS/JS) 
   //assetPrefix: '/padelBI/',
  // Para que next export genere trailing slashes y funcione en static
  trailingSlash: true,

  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
