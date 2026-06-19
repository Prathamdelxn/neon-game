import os from 'os';

const getLocalIPs = () => {
  const networkInterfaces = os.networkInterfaces();
  const ips = [];
  for (const name in networkInterfaces) {
    const interfaces = networkInterfaces[name];
    if (interfaces) {
      for (const iface of interfaces) {
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }
  }
  return ips;
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  allowedDevOrigins: [...getLocalIPs(), 'localhost', '127.0.0.1'],
};

export default nextConfig;
