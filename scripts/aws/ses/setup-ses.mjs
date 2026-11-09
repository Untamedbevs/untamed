#!/usr/bin/env node
/**
 * Sets up Amazon SES for the Untamed email system. Safe to re-run: every step
 * checks what exists first. Without --apply it only prints what it would do.
 *
 * Usage (from the repo root, with AWS credentials that can manage SES and SNS):
 *   node --env-file=.env.local scripts/aws/ses/setup-ses.mjs            # dry run
 *   node --env-file=.env.local scripts/aws/ses/setup-ses.mjs --apply    # create resources
 *   WEBHOOK_BASE_URL=https://untamedbeverages.com \
 *     node --env-file=.env.local scripts/aws/ses/setup-ses.mjs --apply --subscribe
 *
 * Creates:
 *   1. The untamedbeverages.com sending identity with Easy DKIM, and prints the
 *      three DKIM CNAME records to add in DNS.
 *   2. Account-level suppression for bounces and complaints.
 *   3. SNS topic `ses-events-untamed`, publishable by SES from this account only.
 *   4. Configuration sets `untamed-blasts` for marketing (bounce, complaint,
 *      delivery, reject, open, click, rendering failure) and
 *      `untamed-transactional` (no open/click tracking, so sign-in links are
 *      never rewritten), both publishing to the topic.
 *
 * The topic, `untamed-blasts`, and the webhook subscription already existed in
 * the Untamed AWS account (Nov 2026); the script reuses them and updates the
 * existing event destination rather than adding a second one, which would
 * deliver every event twice.
 *   5. With --subscribe: the HTTPS subscription to /api/webhooks/ses. Do this
 *      only after the deployed site has SES_SNS_TOPIC_ARNS set to the topic ARN,
 *      or the webhook will reject SNS's confirmation request.
 *
 * Env: SES_REGION or AWS_REGION; SES_ACCESS_KEY_ID/SES_SECRET_ACCESS_KEY or
 * AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY; WEBHOOK_BASE_URL for --subscribe.
 */

import {
  SESv2Client,
  GetEmailIdentityCommand,
  CreateEmailIdentityCommand,
  PutAccountSuppressionAttributesCommand,
  GetConfigurationSetCommand,
  CreateConfigurationSetCommand,
  GetConfigurationSetEventDestinationsCommand,
  CreateConfigurationSetEventDestinationCommand,
  UpdateConfigurationSetEventDestinationCommand,
} from '@aws-sdk/client-sesv2'
import {
  SNSClient,
  CreateTopicCommand,
  ListTopicsCommand,
  SetTopicAttributesCommand,
  ListSubscriptionsByTopicCommand,
  SubscribeCommand,
} from '@aws-sdk/client-sns'

const APPLY = process.argv.includes('--apply')
const SUBSCRIBE = process.argv.includes('--subscribe')

const DOMAIN = 'untamedbeverages.com'
const TOPIC_NAME = 'ses-events-untamed'
const DESTINATION_NAME = 'sns-all-events'
const MARKETING_SET = 'untamed-blasts'
const TRANSACTIONAL_SET = 'untamed-transactional'
const CONFIG_SETS = {
  [MARKETING_SET]: ['REJECT', 'BOUNCE', 'COMPLAINT', 'DELIVERY', 'OPEN', 'CLICK', 'RENDERING_FAILURE'],
  [TRANSACTIONAL_SET]: ['REJECT', 'BOUNCE', 'COMPLAINT', 'DELIVERY'],
}

const region = process.env.SES_REGION || process.env.AWS_REGION || 'us-east-1'
const credentials =
  process.env.SES_ACCESS_KEY_ID && process.env.SES_SECRET_ACCESS_KEY
    ? { accessKeyId: process.env.SES_ACCESS_KEY_ID, secretAccessKey: process.env.SES_SECRET_ACCESS_KEY }
    : undefined
const ses = new SESv2Client({ region, credentials })
const sns = new SNSClient({ region, credentials })

const isNotFound = (err) => err?.name === 'NotFoundException' || err?.$metadata?.httpStatusCode === 404
const step = (msg) => console.log(`\n== ${msg}`)
const act = async (description, fn) => {
  if (!APPLY) {
    console.log(`  would: ${description}`)
    return undefined
  }
  console.log(`  doing: ${description}`)
  return fn()
}

console.log(`SES setup for ${DOMAIN} in ${region}${APPLY ? '' : ' (dry run; pass --apply to make changes)'}`)

// 1. Sending identity + DKIM ---------------------------------------------------
step(`Sending identity ${DOMAIN}`)
let identity
try {
  identity = await ses.send(new GetEmailIdentityCommand({ EmailIdentity: DOMAIN }))
  console.log(`  exists; verified for sending: ${identity.VerifiedForSendingStatus}, DKIM: ${identity.DkimAttributes?.Status}`)
} catch (err) {
  if (!isNotFound(err)) throw err
  const created = await act(`create identity ${DOMAIN} with Easy DKIM (RSA 2048)`, () =>
    ses.send(new CreateEmailIdentityCommand({
      EmailIdentity: DOMAIN,
      DkimSigningAttributes: { NextSigningKeyLength: 'RSA_2048_BIT' },
    }))
  )
  if (created) identity = { DkimAttributes: { Tokens: created.DkimAttributes?.Tokens, Status: created.DkimAttributes?.Status } }
}
const tokens = identity?.DkimAttributes?.Tokens || []
if (tokens.length) {
  console.log('  DKIM DNS records (CNAME):')
  for (const t of tokens) console.log(`    ${t}._domainkey.${DOMAIN}  CNAME  ${t}.dkim.amazonses.com`)
}

// 2. Account-level suppression -------------------------------------------------
step('Account-level suppression list (bounces and complaints)')
await act('suppress addresses that bounce or complain, account-wide', () =>
  ses.send(new PutAccountSuppressionAttributesCommand({ SuppressedReasons: ['BOUNCE', 'COMPLAINT'] }))
)

// 3. SNS topic ------------------------------------------------------------------
step(`SNS topic ${TOPIC_NAME}`)
let topicArn
let topicCreated = false
{
  let next
  do {
    const page = await sns.send(new ListTopicsCommand({ NextToken: next }))
    topicArn = page.Topics?.map((t) => t.TopicArn).find((arn) => arn?.endsWith(`:${TOPIC_NAME}`)) || topicArn
    next = page.NextToken
  } while (next && !topicArn)
}
if (topicArn) {
  console.log(`  exists: ${topicArn}`)
} else {
  const created = await act(`create topic ${TOPIC_NAME}`, () => sns.send(new CreateTopicCommand({ Name: TOPIC_NAME })))
  topicArn = created?.TopicArn
  topicCreated = Boolean(topicArn)
}
// SetTopicAttributes replaces the whole policy, so only set it on a topic this
// script created; an existing topic keeps the policy it already publishes with.
if (topicArn && !topicCreated) {
  console.log('  keeping the existing topic policy')
} else if (topicArn || !APPLY) {
  const accountId = topicArn ? topicArn.split(':')[4] : '<account>'
  const policy = {
    Version: '2012-10-17',
    Statement: [{
      Sid: 'AllowSesPublishFromThisAccount',
      Effect: 'Allow',
      Principal: { Service: 'ses.amazonaws.com' },
      Action: 'SNS:Publish',
      Resource: topicArn || `arn:aws:sns:${region}:<account>:${TOPIC_NAME}`,
      Condition: { StringEquals: { 'AWS:SourceAccount': accountId } },
    }],
  }
  await act('allow SES (this account only) to publish to the topic', () =>
    sns.send(new SetTopicAttributesCommand({ TopicArn: topicArn, AttributeName: 'Policy', AttributeValue: JSON.stringify(policy) }))
  )
}

// 4. Configuration sets + event destinations ------------------------------------
for (const [name, eventTypes] of Object.entries(CONFIG_SETS)) {
  step(`Configuration set ${name}`)
  let exists = true
  try {
    await ses.send(new GetConfigurationSetCommand({ ConfigurationSetName: name }))
    console.log('  exists')
  } catch (err) {
    if (!isNotFound(err)) throw err
    exists = false
    await act(`create ${name} with reputation metrics and bounce/complaint suppression`, () =>
      ses.send(new CreateConfigurationSetCommand({
        ConfigurationSetName: name,
        ReputationOptions: { ReputationMetricsEnabled: true },
        SendingOptions: { SendingEnabled: true },
        SuppressionOptions: { SuppressedReasons: ['BOUNCE', 'COMPLAINT'] },
      }))
    )
  }

  if (!topicArn) {
    console.log('  skip event destination until the topic exists (rerun with --apply)')
    continue
  }
  const EventDestination = {
    Enabled: true,
    MatchingEventTypes: eventTypes,
    SnsDestination: { TopicArn: topicArn },
  }
  let current
  if (exists) {
    const { EventDestinations = [] } = await ses.send(new GetConfigurationSetEventDestinationsCommand({ ConfigurationSetName: name }))
    // Reuse whichever destination already feeds this topic, whatever its name.
    current =
      EventDestinations.find((d) => d.SnsDestination?.TopicArn === topicArn) ||
      EventDestinations.find((d) => d.Name === DESTINATION_NAME)
  }
  if (current) {
    await act(`update event destination ${current.Name}: ${eventTypes.join(', ')}`, () =>
      ses.send(new UpdateConfigurationSetEventDestinationCommand({ ConfigurationSetName: name, EventDestinationName: current.Name, EventDestination }))
    )
  } else {
    await act(`add event destination ${DESTINATION_NAME}: ${eventTypes.join(', ')}`, () =>
      ses.send(new CreateConfigurationSetEventDestinationCommand({ ConfigurationSetName: name, EventDestinationName: DESTINATION_NAME, EventDestination }))
    )
  }
}

// 5. Webhook subscription ---------------------------------------------------------
step('Webhook subscription')
if (!SUBSCRIBE) {
  console.log('  skipped. After the site is deployed with SES_SNS_TOPIC_ARNS set, rerun with --apply --subscribe.')
} else if (!topicArn) {
  console.log('  topic does not exist yet')
} else {
  const base = (process.env.WEBHOOK_BASE_URL || '').replace(/\/$/, '')
  if (!/^https:\/\//.test(base)) {
    console.error('  WEBHOOK_BASE_URL must be the public https:// site origin')
    process.exitCode = 1
  } else {
    const endpoint = `${base}/api/webhooks/ses`
    const { Subscriptions = [] } = await sns.send(new ListSubscriptionsByTopicCommand({ TopicArn: topicArn }))
    const existing = Subscriptions.find((s) => s.Endpoint === endpoint)
    if (existing) {
      console.log(`  exists: ${existing.SubscriptionArn}`)
    } else {
      await act(`subscribe ${endpoint} (SNS sends a confirmation the webhook verifies and accepts)`, () =>
        sns.send(new SubscribeCommand({ TopicArn: topicArn, Protocol: 'https', Endpoint: endpoint }))
      )
    }
  }
}

// Summary --------------------------------------------------------------------------
console.log('\nSet these in the deployment environment:')
console.log(`  SES_REGION=${region}`)
console.log(`  SES_CONFIGURATION_SET_MARKETING=${MARKETING_SET}`)
console.log(`  SES_CONFIGURATION_SET_TRANSACTIONAL=${TRANSACTIONAL_SET}`)
console.log(`  SES_SNS_TOPIC_ARNS=${topicArn || '<topic ARN after --apply>'}`)
console.log('\nThen verify with: npm run services:check   and   node scripts/email/check-email-dns.mjs')
ses.destroy()
sns.destroy()
