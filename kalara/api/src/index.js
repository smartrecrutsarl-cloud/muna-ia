const app = require('./app');
const config = require('./config');

app.listen(config.port, () => console.log(`Kalara API sur le port ${config.port}`));
