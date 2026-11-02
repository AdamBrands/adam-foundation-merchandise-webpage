import postgres from 'postgres';

// Supabase pooler in transaction mode, signed in as connect_writer.
// Prepared statements must be off for the transaction pooler.
export const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,
  max: 3,
  idle_timeout: 20,
  connect_timeout: 10,
});
