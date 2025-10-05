module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: [
    '@typescript-eslint',
  ],
  rules: {
    // Code quality rules
    'no-console': 'off', // Allow console in server code
    'no-unused-vars': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    
    // TypeScript rules
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    
    // Performance and best practices
    'prefer-template': 'error',
    'object-shorthand': 'error',
    'prefer-arrow-callback': 'error',
    'no-duplicate-imports': 'error',
    'no-useless-return': 'error',
  },
};
