export interface Drink {
  slug: string
  name: string
  animal: string
  flavor: string
  subtitle: string
  tagline: string
  color: string
  colorLight: string
  colorDark: string
  colorGlow: string
  cssVar: string
  abv: string
  size: string
  servings: string
  personality: string
  personalityQuestion: string
  story: string
  whatsInside: string
  canImage: string
  animalImage: string
  scratchBackground: string
}

export const drinks: Drink[] = [
  {
    slug: 'black-panther',
    name: 'Black Panther',
    animal: 'Black Panther',
    flavor: 'Espresso Martini',
    subtitle: 'With Caramel & Vanilla',
    tagline: 'Mystery & shadow power \u2014 strength that moves unseen.',
    color: '#7B2D8E',
    colorLight: '#9B30FF',
    colorDark: '#5A1F6A',
    colorGlow: 'rgba(155, 48, 255, 0.3)',
    cssVar: 'panther',
    abv: '15%',
    size: '12 FL OZ / 355mL',
    servings: '2 Vodka Martinis Per Can',
    personality:
      'Mystery & shadow power \u2013 strength that moves unseen. Protection \u2013 a guardian energy, especially of loved ones or inner truth. Rebellion & sovereignty \u2013 refusing to be controlled or defined. A black panther often means owning your shadow \u2014 embracing your depth, intuition, and power without needing the spotlight.',
    personalityQuestion: 'Are You a Black Panther?',
    story:
      'The Black Panther moves through the shadows \u2014 unseen, unbothered, unstoppable. This isn\u2019t a cocktail for the loud. It\u2019s for the ones who own every room without saying a word. Rich espresso, smooth caramel, a hint of vanilla \u2014 dark, layered, and impossible to forget. Just like you.',
    whatsInside:
      'Deep, bold espresso meets velvety caramel and a whisper of vanilla, all carried by premium vodka. Every sip is smooth, dark, and layered \u2014 like the shadows the panther moves through. This isn\u2019t just a martini. It\u2019s midnight in a can.',
    canImage: '/images/can-black-panther.png',
    animalImage: '/images/animal-black-panther.png',
    scratchBackground: '/images/scratch-panther.png',
  },
  {
    slug: 'cheetah',
    name: 'Cheetah',
    animal: 'Cheetah',
    flavor: 'Lemon Drop Martini',
    subtitle: 'Bright & Bold',
    tagline: 'Speed & decisiveness \u2014 trust your timing.',
    color: '#D4D700',
    colorLight: '#E6D800',
    colorDark: '#9E9E00',
    colorGlow: 'rgba(212, 215, 0, 0.3)',
    cssVar: 'cheetah',
    abv: '15%',
    size: '12 FL OZ / 355mL',
    servings: '2 Vodka Martinis Per Can',
    personality:
      'Speed & decisiveness \u2013 acting fast when the moment is right. Focus \u2013 locking onto a goal and committing fully. Efficiency \u2013 no wasted energy; doing things the smart way. Confidence without aggression \u2013 power that doesn\u2019t need to dominate. Living in bursts \u2013 knowing when to rest and when to go all-in. A cheetah often means \u201Ctrust your timing.\u201D',
    personalityQuestion: 'Are You a Cheetah?',
    story:
      'The Cheetah doesn\u2019t hesitate. When the moment is right, it strikes \u2014 fast, focused, and fearless. This is a cocktail built for people who trust their instincts and move with precision. Bright lemon, clean citrus, pure energy in a can. No wasted motion. No second-guessing. Just go.',
    whatsInside:
      'Bright, electric citrus hits first \u2014 sharp lemon balanced with just enough sweetness to keep you locked in. Premium vodka gives it a clean, crisp backbone that finishes fast and leaves you wanting more. Pure energy, zero hesitation.',
    canImage: '/images/can-cheetah.png',
    animalImage: '/images/animal-cheetah.png',
    scratchBackground: '/images/scratch-cheetah.png',
  },
  {
    slug: 'cougar',
    name: 'Cougar',
    animal: 'Cougar',
    flavor: 'Classic Dirty Martini',
    subtitle: 'Bold & Savory',
    tagline: 'Quiet power \u2014 strength that doesn\u2019t need to announce itself.',
    color: '#4A7C0F',
    colorLight: '#6B8E23',
    colorDark: '#355E0A',
    colorGlow: 'rgba(107, 142, 35, 0.3)',
    cssVar: 'cougar',
    abv: '15%',
    size: '12 FL OZ / 355mL',
    servings: '2 Vodka Martinis Per Can',
    personality:
      'Quiet power \u2013 Strength that doesn\u2019t need to announce itself. Patience \u2013 waiting calmly, then acting with precision. Leadership \u2013 natural authority without force. Fearlessness \u2013 standing your ground when it matters. A cougar often means mastery of your territory \u2014 knowing who you are, what you want, and not needing approval to claim it.',
    personalityQuestion: 'Are You a Cougar?',
    story:
      'The Cougar doesn\u2019t chase \u2014 it commands. Quiet power, earned authority, and the patience to wait for exactly the right moment. This classic dirty martini is bold, savory, and unapologetically strong. It\u2019s for those who\u2019ve already proven themselves and don\u2019t need anyone\u2019s permission to own it.',
    whatsInside:
      'Briny, savory, and unapologetically bold \u2014 olive brine meets premium vodka in a classic dirty martini that doesn\u2019t hold back. There\u2019s nothing sweet about this one. Just clean spirit, sharp salt, and a finish that commands respect.',
    canImage: '/images/can-cougar.png',
    animalImage: '/images/animal-cougar.png',
    scratchBackground: '/images/scratch-cougar.png',
  },
  {
    slug: 'lioness',
    name: 'Lioness',
    animal: 'Lioness',
    flavor: 'Peach & Rosemary Martini',
    subtitle: 'Sweet & Herbal',
    tagline: 'Power balanced with compassion, authority guided by love.',
    color: '#E87511',
    colorLight: '#FF8C2A',
    colorDark: '#D4680F',
    colorGlow: 'rgba(232, 117, 17, 0.3)',
    cssVar: 'lioness',
    abv: '15%',
    size: '12 FL OZ / 355mL',
    servings: '2 Vodka Martinis Per Can',
    personality:
      'Loyalty and Family \u2013 A lioness symbolizes loyalty, unity, and deep bonds with family and community. Independence and Confidence \u2013 A lioness moves with self-assurance. Someone who knows their worth and stands strong. A lioness often means power balanced with compassion, authority guided by love, and confidence rooted in purpose.',
    personalityQuestion: 'Are You a Lioness?',
    story:
      'The Lioness leads with heart and fights with fire. Loyalty runs deep, compassion runs deeper, but make no mistake \u2014 she will protect what\u2019s hers. Sweet peach, aromatic rosemary, and a finish that lingers. This is for the ones who hold it all together and make it look effortless.',
    whatsInside:
      'Lush, sun-ripened peach meets aromatic rosemary and premium vodka for a cocktail that\u2019s equal parts sweet and sophisticated. The herbal notes ground the fruit with warmth, and the finish lingers long after the last sip \u2014 effortless and unforgettable.',
    canImage: '/images/can-lioness.png',
    animalImage: '/images/animal-lioness.png',
    scratchBackground: '/images/scratch-lioness.png',
  },
]

export function getDrinkBySlug(slug: string): Drink | undefined {
  return drinks.find((d) => d.slug === slug)
}

/** Build an absolute URL for site assets (can / animal images). Fal and other APIs need a public URL. */
export function drinkAssetAbsoluteUrl(siteBase: string, assetPath: string): string {
  const trimmed = assetPath.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  const base = siteBase.replace(/\/$/, '')
  return `${base}${path}`
}
