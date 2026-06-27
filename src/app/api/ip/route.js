import { NextResponse } from 'next/server';
import os from 'os';

export async function GET() {
  const networkInterfaces = os.networkInterfaces();
  let ip = '127.0.0.1';

  //adsfadsfda

  // Iterate over network interfaces to find the local network IPv4 address
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    if (!interfaces) continue;
    
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ip = iface.address;
        break;
      }
    }
  }

  return NextResponse.json({ ip });
}
