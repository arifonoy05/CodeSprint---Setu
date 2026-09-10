/** Every daisyUI 5 default theme, in the order the docs list them. */
export const THEMES = [
  'light', 'dark', 'cupcake', 'bumblebee', 'emerald', 'corporate', 'synthwave', 'retro',
  'cyberpunk', 'valentine', 'halloween', 'garden', 'forest', 'aqua', 'lofi', 'pastel',
  'fantasy', 'wireframe', 'black', 'luxury', 'dracula', 'cmyk', 'autumn', 'business',
  'acid', 'lemonade', 'night', 'coffee', 'winter', 'dim', 'nord', 'sunset',
  'caramellatte', 'abyss', 'silk',
] as const
export type Theme = (typeof THEMES)[number]
export const THEME_KEY = 'setu-theme'
