require('dotenv').config();
const express = require('express');
const cors = require('cors');

const resourcesRouter = require('./routes/resources');
const weatherRouter = require('./routes/weather');

const app = express();
const PORT = process.env.PORT || 3001;

// Allow your frontend domain to call this API. Update the origin list
// once you know your deployed frontend URL / www.lifelineconnectionsnj.com
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map(s => s.trim());

app.use(cors({
  origin: allowedOrigins,
}));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'lifeline-connections-nj-api' }));

app.use('/api/resources', resourcesRouter);
app.use('/api/weather', weatherRouter);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
});

app.listen(PORT, () => {
  console.log(`Lifeline Connections NJ API listening on port ${PORT}`);
});
