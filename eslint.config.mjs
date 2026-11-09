import next from 'eslint-config-next'

const config = [
  ...next,
  {
    rules: {
      // Pages are plain HTML with the framework runtime removed after build (D-022): navigation is ordinary links.
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  { ignores: ['out/**', '.next/**', 'pipeline/**', 'data/**', 'next-env.d.ts', 'test-results/**', 'shots/**'] },
]

export default config
