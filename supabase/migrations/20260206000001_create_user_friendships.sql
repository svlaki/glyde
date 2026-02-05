-- Migration: Create user friendships system
-- Enables user-to-user connections with request/accept workflow

-- Create user_friendships table
CREATE TABLE IF NOT EXISTS public.user_friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate friendships (either direction)
  CONSTRAINT no_duplicate_friendships UNIQUE (requester_id, addressee_id),
  -- Prevent self-friendship
  CONSTRAINT no_self_friendship CHECK (requester_id != addressee_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON public.user_friendships(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON public.user_friendships(addressee_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_lookup ON public.user_friendships(requester_id, addressee_id);

-- Enable RLS
ALTER TABLE public.user_friendships ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view friendships they're part of
DROP POLICY IF EXISTS "Users can view own friendships" ON public.user_friendships;
CREATE POLICY "Users can view own friendships" ON public.user_friendships
  FOR SELECT USING (
    auth.uid() = requester_id OR auth.uid() = addressee_id
  );

-- RLS Policy: Users can create friend requests
DROP POLICY IF EXISTS "Users can create friend requests" ON public.user_friendships;
CREATE POLICY "Users can create friend requests" ON public.user_friendships
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

-- RLS Policy: Users can respond to friend requests (accept/block)
DROP POLICY IF EXISTS "Users can respond to friend requests" ON public.user_friendships;
CREATE POLICY "Users can respond to friend requests" ON public.user_friendships
  FOR UPDATE USING (auth.uid() = addressee_id);

-- RLS Policy: Service role full access
DROP POLICY IF EXISTS "Service role full access to friendships" ON public.user_friendships;
CREATE POLICY "Service role full access to friendships" ON public.user_friendships
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Helper function: Get user's accepted friends with bi-directional lookup
CREATE OR REPLACE FUNCTION get_user_friends(p_user_id UUID)
RETURNS TABLE (
  friend_id UUID,
  friend_email TEXT,
  friend_display_name TEXT,
  friendship_status TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN uf.requester_id = p_user_id THEN uf.addressee_id
      ELSE uf.requester_id
    END as friend_id,
    p.email,
    p.display_name,
    uf.status,
    uf.created_at
  FROM public.user_friendships uf
  JOIN public.profile p ON p.id = CASE
    WHEN uf.requester_id = p_user_id THEN uf.addressee_id
    ELSE uf.requester_id
  END
  WHERE (uf.requester_id = p_user_id OR uf.addressee_id = p_user_id)
    AND uf.status = 'accepted'
  ORDER BY uf.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Check if two users are friends (bi-directional)
CREATE OR REPLACE FUNCTION are_users_friends(p_user_id_1 UUID, p_user_id_2 UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM public.user_friendships
    WHERE (
      (requester_id = p_user_id_1 AND addressee_id = p_user_id_2)
      OR (requester_id = p_user_id_2 AND addressee_id = p_user_id_1)
    )
    AND status = 'accepted'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Check if user is blocked from another user
CREATE OR REPLACE FUNCTION is_user_blocked(p_requester_id UUID, p_addressee_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM public.user_friendships
    WHERE requester_id = p_addressee_id
      AND addressee_id = p_requester_id
      AND status = 'blocked'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
