import { Facebook, Instagram, Youtube, Twitter, Music2 as Music2Icon } from 'lucide-react'

export interface Platform {
  id: string
  name: string
  handle: string
  url: string
  icon: typeof Facebook
  color: string
}

export const PLATFORMS: Platform[] = [
  {
    id: 'facebook',
    name: 'Facebook',
    handle: '@untamedbevs',
    url: 'https://www.facebook.com/untamedbevs',
    icon: Facebook,
    color: '#1877F2',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    handle: '@untamedbevs',
    url: 'https://www.instagram.com/untamedbevs',
    icon: Instagram,
    color: '#E4405F',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    handle: '@untamedbevs',
    url: 'https://www.tiktok.com/@untamedbevs',
    icon: Music2Icon,
    color: '#000000',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    handle: '@untamedbevs',
    url: 'https://www.youtube.com/@untamedbevs',
    icon: Youtube,
    color: '#FF0000',
  },
  {
    id: 'x',
    name: 'X (Twitter)',
    handle: '@untamedbevs',
    url: 'https://x.com/untamedbevs',
    icon: Twitter,
    color: '#000000',
  },
]

export const PLATFORMS_MAP = Object.fromEntries(
  PLATFORMS.map((p) => [p.id, p])
) as Record<string, Platform>
