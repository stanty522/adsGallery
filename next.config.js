/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async headers() {
    return [
      {
        // Force a clean cache-control on the home page so Fastly's edge cache
        // actually works. Next.js's default Vary header fragments the cache
        // by router-state which causes every request to MISS at the edge.
        source: '/',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400',
          },
          {
            // Override Vary so Fastly only caches by encoding (not the
            // dozen Next.js routing headers that fragment the cache).
            key: 'Vary',
            value: 'Accept-Encoding',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
