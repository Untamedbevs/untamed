import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: '/r/rewards',
        destination:
          '/rewards?utm_source=packaging&utm_medium=qr&utm_campaign=launch_2026&utm_content=generic',
        permanent: false,
      },
      {
        source: '/r/rewards/black-panther',
        destination:
          '/drinks/black-panther/rewards?utm_source=can&utm_medium=qr&utm_campaign=launch_2026&utm_content=black-panther',
        permanent: false,
      },
      {
        source: '/r/rewards/cheetah',
        destination:
          '/drinks/cheetah/rewards?utm_source=can&utm_medium=qr&utm_campaign=launch_2026&utm_content=cheetah',
        permanent: false,
      },
      {
        source: '/r/rewards/cougar',
        destination:
          '/drinks/cougar/rewards?utm_source=can&utm_medium=qr&utm_campaign=launch_2026&utm_content=cougar',
        permanent: false,
      },
      {
        source: '/r/rewards/lioness',
        destination:
          '/drinks/lioness/rewards?utm_source=can&utm_medium=qr&utm_campaign=launch_2026&utm_content=lioness',
        permanent: false,
      },
    ]
  },
}

export default nextConfig
