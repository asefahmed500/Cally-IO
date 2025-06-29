
/** @type {import('next').NextConfig} */
const nextConfig = {
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
    config.externals.push(
        '@opentelemetry/exporter-jaeger', 
        'require-in-the-middle',
        'handlebars'
    );

    config.ignoreWarnings = (config.ignoreWarnings || []).concat([
      /Critical dependency: the request of a dependency is an expression/,
      /require\.extensions/,
    ]);
    
    return config;
  },
};

module.exports = nextConfig;
