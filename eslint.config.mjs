import antfu from '@antfu/eslint-config'

export default antfu(
  {
    type: 'lib',
    formatters: true,
  },
  {
    rules: {
      'ts/explicit-function-return-type': 'off',
      'node/prefer-global/process': 'off',
    },
  },
)
