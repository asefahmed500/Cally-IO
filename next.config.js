/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config) => {
    // This is a workaround for a bug in Next.js where it tries to bundle
    // optional server-side dependencies. We can mark them as external to
    // prevent them from being bundled, which resolves warnings.
    config.externals.push('@opentelemetry/exporter-jaeger');
    config.externals.push('require-in-the-middle');

    config.ignoreWarnings = (config.ignoreWarnings || []).concat([
      /Critical dependency: the request of a dependency is an expression/,
      /require.extensions is not supported by webpack. Use a loader instead./
    ]);
    
    return config;
  },
};

module.exports = nextConfig;
