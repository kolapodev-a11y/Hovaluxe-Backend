const app = require('./app');
const { port, storeDefaults } = require('./config/env');
const { connectDB, registerMongoEvents } = require('./config/db');
const { ensureDefaultAdmin } = require('./controller/adminController');
const StoreConfig = require('./models/StoreConfig');

async function ensureStoreConfig() {
  const existing = await StoreConfig.findOne();
  if (!existing) {
    await StoreConfig.create(storeDefaults);
    console.log('✅ Store config seeded');
  }
}

async function bootstrap() {
  try {
    registerMongoEvents();
    await connectDB();
    await ensureDefaultAdmin();
    await ensureStoreConfig();

    app.listen(port, () => {
      console.log(`🚀 Hovaluxe backend listening on port ${port}`);
    });
  } catch (error) {
    console.error('❌ Failed to start backend:', error.message);
    process.exit(1);
  }
}

bootstrap();
