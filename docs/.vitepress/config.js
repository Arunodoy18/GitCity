import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'GitCity',
  description: 'Turn GitHub profiles into 3D cities',
  
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Plugins', link: '/plugins/overview' },
      { text: 'API', link: '/api/overview' },
      { text: 'SDK', link: '/sdk/usage' },
      { text: 'GitHub', link: 'https://github.com/ArunodaySingh/GitCity' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Architecture', link: '/guide/architecture' },
            { text: 'Deployment', link: '/guide/deployment' },
          ],
        },
      ],
      '/plugins/': [
        {
          text: 'Plugins',
          items: [
            { text: 'Overview', link: '/plugins/overview' },
            { text: 'Plugin Development', link: '/plugins/development' },
            { text: 'Language Colors', link: '/plugins/language-colors' },
            { text: 'Activity Heatmap', link: '/plugins/activity-heatmap' },
            { text: 'Team Clusters', link: '/plugins/team-clusters' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/overview' },
            { text: 'Authentication', link: '/api/authentication' },
            { text: 'Users', link: '/api/users' },
            { text: 'Cities', link: '/api/cities' },
            { text: 'Trending', link: '/api/trending' },
            { text: 'Metrics', link: '/api/metrics' },
          ],
        },
      ],
      '/sdk/': [
        {
          text: 'SDK',
          items: [
            { text: 'Usage', link: '/sdk/usage' },
            { text: 'API Reference', link: '/sdk/api-reference' },
            { text: 'Examples', link: '/sdk/examples' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/ArunodaySingh/GitCity' },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present GitCity Contributors',
    },
  },
})
