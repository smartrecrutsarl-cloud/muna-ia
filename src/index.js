require('dotenv').config();
const app = require('./app');
const { startScheduler } = require('./jobs/scorer');
const config = require('./config');

// Vérifie les variables d'environnement critiques
const requiredEnv = [
  'SUPABASE_URL', 'SUPABASE_SERVICE_KEY',
  'WATI_API_URL', 'WATI_API_TOKEN',
  'ANTHROPIC_API_KEY',
];

const missing = requiredEnv.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error('❌ Variables d\'environnement manquantes:', missing.join(', '));
  console.error('   Copiez .env.example en .env et remplissez les valeurs.');
  process.exit(1);
}

// Démarrage serveur
const PORT = config.port;
app.listen(PORT, () => {
  console.log('');
  console.log('  🤖 MUNA IA — Backend démarré');
  console.log('  ─────────────────────────────────────');
  console.log(`  ✅ Serveur     : http://localhost:${PORT}`);
  console.log(`  ✅ Dashboard   : http://localhost:${PORT}/dashboard`);
  console.log(`  ✅ Webhook     : http://localhost:${PORT}/webhook/wati`);
  console.log(`  ✅ CinetPay    : http://localhost:${PORT}/webhook/cinetpay`);
  console.log(`  ✅ Health      : http://localhost:${PORT}/health`);
  console.log('  ─────────────────────────────────────');
  console.log(`  🌍 Env: ${config.nodeEnv}`);
  console.log('');

  // Démarre le scheduler de scoring (toutes les 30 min)
  startScheduler();
});

// Gestion propre de l'arrêt
process.on('SIGTERM', () => {
  console.log('[SERVER] Arrêt propre...');
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  console.error('[SERVER] Promise non gérée:', reason);
});
