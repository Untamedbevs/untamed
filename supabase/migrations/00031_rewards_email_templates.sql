-- ============================================================================
-- Untamed Beverages - Pack Rewards member emails
--
-- Transactional templates sent when staff review a Hunt submission or fulfill
-- a milestone reward (src/lib/rewards/notify.ts). Staff can edit the copy in
-- Admin > CRM > Templates; every merge tag used here is always supplied.
-- ============================================================================

BEGIN;

INSERT INTO email_templates (slug, name, kind, subject, body, sender_id) VALUES
(
  'hunt-approved',
  'Pack Rewards: Hunt approved',
  'transactional',
  'Hunt complete: +{{points}} points',
  E'Nice work, {{first_name}}.\n\nWe checked your **{{hunt_title}}** proof and it''s approved. **{{points}} points** just landed on your trail.\n\n{{note}}\n\nSee how close you are to your next reward:\n{{rewards_url}}\n\nStay wild,\nThe Untamed crew',
  'loyalty'
),
(
  'hunt-needs-changes',
  'Pack Rewards: Hunt not approved',
  'transactional',
  'About your {{hunt_title}} submission',
  E'Hey {{first_name}},\n\nWe looked at your **{{hunt_title}}** proof and couldn''t approve it this time.\n\n{{note}}\n\nYou can check the rules and try again here:\n{{hunts_url}}\n\nStay wild,\nThe Untamed crew',
  'loyalty'
),
(
  'reward-on-its-way',
  'Pack Rewards: reward fulfilled',
  'transactional',
  'Your {{reward_name}} is on its way',
  E'{{first_name}},\n\nYou reached **{{milestone_title}}** on your trail, and your **{{reward_name}}** is on its way.\n\n{{note}}\n\nKeep climbing:\n{{rewards_url}}\n\nStay wild,\nThe Untamed crew',
  'loyalty'
);

COMMIT;
