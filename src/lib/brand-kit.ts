export const BRAND_KIT = {
  name: 'Untamed Beverages',
  tagline: 'Premium Vodka Martinis. Unleash Your Nature.',
  handles: '@untamedbevs',

  drinks: [
    {
      name: 'Black Panther',
      personality: 'Dark, mysterious, powerful',
      flavor: 'Black cherry & activated charcoal',
      color: '#1A0A2E',
      accent: '#9B30FF',
    },
    {
      name: 'Cheetah',
      personality: 'Bold, fast, electric',
      flavor: 'Blood orange & ginger',
      color: '#FF6B00',
      accent: '#FFD700',
    },
    {
      name: 'Cougar',
      personality: 'Smooth, sophisticated, alluring',
      flavor: 'Lavender & vanilla',
      color: '#6B4C8A',
      accent: '#D4A0FF',
    },
    {
      name: 'Lioness',
      personality: 'Fierce, tropical, commanding',
      flavor: 'Passion fruit & mango',
      color: '#C8102E',
      accent: '#FF6B9D',
    },
  ],

  aesthetic: {
    mood: 'Dark luxury, nightlife energy, predatory elegance',
    palette: 'Deep blacks (#0A0A0A), rich purples (#9B30FF), neon accents, metallic gold',
    typography: 'Bold uppercase sans-serif, condensed tracking, Oswald-style display type',
    photography: 'High-contrast, dramatic lighting, deep shadows with neon rim light, wet/reflective surfaces, smoke/mist elements',
    composition: 'Center-weighted hero shots, negative space for text, moody depth of field',
  },

  voice: {
    tone: 'Confident, provocative, premium — never try-hard',
    doUse: ['short punchy lines', 'double entendres', 'animal/predator metaphors', 'nightlife language'],
    doNotUse: ['exclamation marks', 'generic "cheers" language', 'discount/sale language', 'emojis'],
    hashtagCore: ['#Untamed', '#UntamedBevs', '#UnleashYourNature'],
    hashtagSecondary: ['#PremiumVodka', '#MartiniCulture', '#NightlifeEssential', '#CocktailArt'],
  },
} as const

export function getBrandPromptContext(): string {
  const d = BRAND_KIT.drinks.map((d) => `${d.name}: ${d.personality} — ${d.flavor}`).join('\n    ')

  return `BRAND: ${BRAND_KIT.name}
  Tagline: "${BRAND_KIT.tagline}"
  Social: ${BRAND_KIT.handles}

  PRODUCTS:
    ${d}

  VISUAL IDENTITY:
    Mood: ${BRAND_KIT.aesthetic.mood}
    Palette: ${BRAND_KIT.aesthetic.palette}
    Typography: ${BRAND_KIT.aesthetic.typography}
    Photography style: ${BRAND_KIT.aesthetic.photography}
    Composition: ${BRAND_KIT.aesthetic.composition}

  BRAND VOICE:
    Tone: ${BRAND_KIT.voice.tone}
    Do use: ${BRAND_KIT.voice.doUse.join(', ')}
    Do NOT use: ${BRAND_KIT.voice.doNotUse.join(', ')}
    Core hashtags: ${BRAND_KIT.voice.hashtagCore.join(' ')}
    Secondary hashtags: ${BRAND_KIT.voice.hashtagSecondary.join(' ')}`
}
