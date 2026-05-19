import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

export default tseslint.config(
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'coverage/**',
            '**/*.d.ts',
            'tests/**',
            '**/__tests__/**',
            'ui-tests/**',
            'lib/**'
        ]
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['**/*.{ts,tsx}'],
        plugins: {
            prettier: prettierPlugin
        },
        languageOptions: {
            parserOptions: {
                project: 'tsconfig.json',
                sourceType: 'module'
            }
        },
        rules: {
            ...prettierConfig.rules,
            'prettier/prettier': [
                'error',
                {
                    singleQuote: true,
                    trailingComma: 'none',
                    arrowParens: 'avoid',
                    endOfLine: 'auto'
                }
            ],
            '@typescript-eslint/naming-convention': [
                'error',
                {
                    selector: 'interface',
                    format: ['PascalCase'],
                    custom: {
                        regex: '^I[A-Z]',
                        match: true
                    }
                }
            ],
            '@typescript-eslint/no-unused-vars': [
                'warn',
                {
                    args: 'none'
                }
            ],
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-namespace': 'off',
            '@typescript-eslint/no-use-before-define': 'off',
            curly: ['error', 'all'],
            eqeqeq: 'error',
            'prefer-arrow-callback': 'error'
        }
    }
);
