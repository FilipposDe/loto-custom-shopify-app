// Needs:
// eslint-plugin-prettier
// eslint-config-prettier
module.exports = {
    parser: 'babel-eslint',
    extends: [
        'plugin:shopify/react',
        'plugin:shopify/polaris',
        'plugin:shopify/jest',
        'plugin:shopify/webpack',
        // Always at the end
        'prettier',
        // Further specific extends at the end
        'prettier/react'
    ],
    rules: {
        'react/react-in-jsx-scope': 'off',
        'react-hooks/exhaustive-deps': 'off',
        'jsx-a11y/click-events-have-key-events': 'off',
        'react/prop-types': 'off',
        'no-undef': 'error',
        'shopify/jsx-no-hardcoded-content': 'off',
        'shopify/jsx-no-complex-expressions': 'off'
    },
    globals: {
        process: true
    },
    env: {
        browser: true,
        node: true,
        es6: true
    },
    plugins: ['prettier']
}
