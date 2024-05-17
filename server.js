const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Xx: moved this unchaught exception handler to the top to make sure it applies to the entire code
process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! 🧨 Shutting down...');
  console.log(err.name, err.message);
  // console.log(err) //Xx: if you need more details, but it is kinda hard to read..;
  process.exit(1); // Xx: 0 code is success and 1 is generally "uncalled exception"
});

dotenv.config({ path: './config.env' });
const appmode = process.env.NODE_ENV;
const app = require('./app');

const DB = process.env.DATABASE.replace('<PASSWORD>', process.env.DATABASE_PASSWORD);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  })
  .then(() => console.log('DB connection successful!'));

const port = process.env.port || 3000;
const server = app.listen(port, () => {
  console.log(`App running on ${appmode} mode on port ${port}.`);
});

process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 🧨 Shutting down...');
  console.log(err, err.name, err.message);
  // console.log(err) //Xx: if you need more details, but it is kinda hard to read..;
  server.close(() => {
    process.exit(1); // Xx: 0 code is success and 1 is generally "uncalled exception"
  });
});
