import jwt from 'jsonwebtoken';

const secret = 'super-secret-jwt-token-with-at-least-32-characters-long';

// Anon key
const anonToken = jwt.sign(
  {
    role: 'anon',
    iss: 'supabase',
  },
  secret,
  { expiresIn: '10y' }
);

// Service role key
const serviceToken = jwt.sign(
  {
    role: 'service_role',
    iss: 'supabase',
  },
  secret,
  { expiresIn: '10y' }
);

console.log('ANON KEY:', anonToken);
console.log('SERVICE ROLE KEY:', serviceToken);
