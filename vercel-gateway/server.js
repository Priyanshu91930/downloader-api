const app = require("./src/app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Gateway API running at: http://localhost:${PORT}`);
  console.log(`📡 Endpoints available:`);
  console.log(`   - GET /api/download?url=... (Auto-detect platform)`);
  console.log(`   - GET /api/download/:platform?url=...`);
  console.log(`   - GET /api/config (Platforms & Remote config)`);
  console.log(`   - GET /api/health`);
});
