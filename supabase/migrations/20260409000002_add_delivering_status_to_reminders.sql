-- Add 'delivering' and 'delivered' to the reminders status check constraint
-- Required by the atomic get_due_reminders function which transitions: pending/snoozed -> delivering -> delivered

ALTER TABLE public.reminders DROP CONSTRAINT IF EXISTS reminders_status_check;

ALTER TABLE public.reminders ADD CONSTRAINT reminders_status_check
  CHECK (status IN ('pending', 'snoozed', 'delivering', 'delivered', 'dismissed', 'failed'));
