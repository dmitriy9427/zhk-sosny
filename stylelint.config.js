/**
 * Stylelint: ошибки и единый стиль в SCSS. Запуск: npm run lint:css.
 * Правила ниже ослаблены там, где стандартный конфиг спорит с методологией
 * БЭМ (block__element--modifier) и с нашими миксинами.
 */
export default {
  extends: ['stylelint-config-standard-scss'],
  ignoreFiles: ['**/dist/**', '**/coverage/**', '**/node_modules/**'],
  rules: {
    // БЭМ: .block__element--modifier
    'selector-class-pattern': [
      '^[a-z][a-z0-9]*(-[a-z0-9]+)*(__[a-z0-9]+(-[a-z0-9]+)*)?(--[a-z0-9]+(-[a-z0-9]+)*)?$',
      { message: 'Класс по БЭМ: block__element--modifier, только строчные буквы и дефис' },
    ],
    'scss/dollar-variable-pattern': null,
    'scss/at-mixin-pattern': null,
    'keyframes-name-pattern': null,
    'no-descending-specificity': null,
    'declaration-empty-line-before': null,
    'custom-property-empty-line-before': null,
    'scss/double-slash-comment-empty-line-before': null,
    'value-keyword-case': ['lower', { camelCaseSvgKeywords: false }],
    // Пустые строки `//` в многострочных комментариях-пояснениях — это нормально.
    'scss/comment-no-empty': null,
    'at-rule-empty-line-before': null,
    'scss/dollar-variable-empty-line-before': null,
    'property-no-vendor-prefix': [
      true,
      { ignoreProperties: ['text-size-adjust', 'line-clamp', 'box-orient', 'text-fill-color'] },
    ],
    'value-no-vendor-prefix': [true, { ignoreValues: ['box'] }],
    'declaration-block-no-redundant-longhand-properties': null,
    'scss/operator-no-unspaced': null,
  },
}
