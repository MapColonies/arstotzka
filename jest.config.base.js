module.exports = {
    transform: {
        '^.+\\.ts$': 'ts-jest'
    },
    globals: {
        'ts-jest': {
            tsconfig: 'tsconfig.test.json',
        },
    },
    testMatch: ['<rootDir>/tests/unit/**/*.spec.ts'],
    preset: 'ts-jest',
    testEnvironment: 'node',
    collectCoverage: true,
    collectCoverageFrom: [
        '<rootDir>/src/**/*.ts',
        '!*/node_modules/',
        '!/vendor/**',
        '!*/common/**',
        '!**/controllers/**',
        '!**/routes/**',
    ],
    coverageReporters: ['text', 'html'],
    reporters: [
        'default',
        ['jest-html-reporters', { multipleReportsUnitePath: './reports', pageTitle: 'unit', publicPath: './reports', filename: 'unit.html' }],
    ],
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: -10,
        },
    },
};