const express = require('express');
const app = express();
const cors = require('cors');
const authController = require('./controllers/authController');
const userRoutes = require('./routes/userRoutes');
const siteRoutes = require('./routes/siteRoutes');
const keyRoutes = require('./routes/keyRoutes');

app.use(cors());

app.use(express.json());

// Authentication route
app.post('/login', authController.login);

// Routes for CRUD operations
app.use('/users', userRoutes);
app.use('/sites', siteRoutes);
app.use('/requests', keyRoutes);

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
