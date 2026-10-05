import pg from 'pg';

const { Client } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL não configurada.');
  process.exit(1);
}

const client = new Client({
  connectionString,
  connectionTimeoutMillis: 10000,
});

try {
  await client.connect();
  const result = await client.query(
    'select current_database() as database, current_user as user_name, now() as server_time'
  );
  console.log('PostgreSQL conectado com sucesso.');
  console.log(result.rows[0]);
} catch (error) {
  console.error('Falha ao conectar ao PostgreSQL:', error.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
