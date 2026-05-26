export const CRM_SENDERS = [
  {
    id: 'support',
    label: 'Support',
    email: 'support@untamedbeverages.com',
    from: '"Untamed Beverages" <support@untamedbeverages.com>',
  },
  {
    id: 'loyalty',
    label: 'Loyalty',
    email: 'loyalty@untamedbeverages.com',
    from: '"Untamed Beverages" <loyalty@untamedbeverages.com>',
  },
  {
    id: 'orders',
    label: 'Orders',
    email: 'orders@untamedbeverages.com',
    from: '"Untamed Beverages" <orders@untamedbeverages.com>',
  },
] as const

export type CrmSenderId = (typeof CRM_SENDERS)[number]['id']

export const DEFAULT_CRM_SENDER = CRM_SENDERS[0]

export function getSenderById(id: string) {
  return CRM_SENDERS.find((s) => s.id === id) ?? DEFAULT_CRM_SENDER
}
