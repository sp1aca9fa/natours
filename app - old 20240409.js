const fs = require('fs');
const express = require('express');

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  console.log('Hello from the middleware! 😁');
  next();
});

app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// Initial code

// app.get('/', (req, res) => {
//   res
//     .status(200)
//     .json({ message: 'Hello from the server side!', app: 'Natours' });
// });

// app.post('/', (req, res) => {
//   res.send('You can post to this endpoint.');
// });

// Code v1 - until Section 6, video 56

// const tours = JSON.parse(fs.readFileSync(`${__dirname}/dev-data/data/tours-simple.json`));

// // GET TOURS
// app.get('/api/v1/tours', (req, res) => {
//   res.status(200).json({
//     status: 'success',
//     results: tours.length,
//     data: {
//       tours,
//     },
//   });
// });

// // GET TOUR
// app.get('/api/v1/tours/:id', (req, res) => {
//   const id = req.params.id * 1;
//   const tour = tours.find((el) => el.id === id);

//   // if (id > tours.length) {
//   if (!tour) {
//     return res.status(404).json({
//       status: 'fail',
//       message: 'Invalid ID',
//     });
//   }

//   res.status(200).json({
//     status: 'success',
//     data: {
//       tour,
//     },
//     // results: tours.length,
//     // data: {
//     //   tours,
//     // },
//   });
// });

// // POST
// app.post('/api/v1/tours', (req, res) => {
//   // console.log(req.body);

//   const newId = tours[tours.length - 1].id + 1;
//   const newTour = Object.assign({ id: newId }, req.body);

//   tours.push(newTour);

//   fs.writeFile(`${__dirname}/dev-data/data/tours-simple.json`, JSON.stringify(tours), (err) => {
//     res.status(201).json({
//       status: 'success',
//       data: {
//         tour: newTour,
//       },
//     });
//   });
// });

// // UPDATE TOUR
// app.patch('/api/v1/tours/:id', (req, res) => {
//   const id = req.params.id * 1;

//   if (id > tours.length) {
//     return res.status(404).json({
//       status: 'fail',
//       message: 'Invalid ID',
//     });
//   }

//   const tour = tours.find((el) => el.id === id);

//   // R: from https://stackoverflow.com/questions/65316870/how-to-use-patch-with-node-js-and-express and some changes by myself
//   // Just an example of PATCH request, using specifically "duration".
//   if (req.body.duration !== undefined) {
//     tour.duration = req.body.duration;
//   }

//   res.status(200).json({
//     status: 'success',
//     data: {
//       tour,
//     },
//   });
// });

// app.delete('/api/v1/tours/:id', (req, res) => {
//   if (req.params.id * 1 > tours.length) {
//     return res.status(404).json({
//       status: 'fail',
//       message: 'Invalid ID',
//     });
//   }

//   res.status(204).json({
//     status: 'success',
//     data: null,
//   });
// });

// const port = 3000;
// app.listen(port, () => {
//   console.log(`App running on port ${port}.`);
// });

// Code from section 7, video 57
const tours = JSON.parse(fs.readFileSync(`${__dirname}/dev-data/data/tours-simple.json`));

// GET ALL TOURS - function
const getAllTours = (req, res) => {
  console.log(req.requestTime);
  res.status(200).json({
    status: 'success',
    requestedAt: req.requestTime,
    results: tours.length,
    data: {
      tours,
    },
  });
};

// GET TOUR - function
const getTour = (req, res) => {
  const id = req.params.id * 1;
  const tour = tours.find((el) => el.id === id);

  // if (id > tours.length) {
  if (!tour) {
    return res.status(404).json({
      status: 'fail',
      message: 'Invalid ID',
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      tour,
    },
    // results: tours.length,
    // data: {
    //   tours,
    // },
  });
};

// CREATE TOUR - function
const createTour = (req, res) => {
  // console.log(req.body);

  const newId = tours[tours.length - 1].id + 1;
  const newTour = Object.assign({ id: newId }, req.body);

  tours.push(newTour);

  fs.writeFile(`${__dirname}/dev-data/data/tours-simple.json`, JSON.stringify(tours), (err) => {
    res.status(201).json({
      status: 'success',
      data: {
        tour: newTour,
      },
    });
  });
};

// UPDATE TOUR - function
const updateTour = (req, res) => {
  // Comment out - codigo que eu escrevi, so atualizava duration especificamente
  // const id = req.params.id * 1;

  // if (id > tours.length) {
  //   return res.status(404).json({
  //     status: 'fail',
  //     message: 'Invalid ID',
  //   });
  // }

  // const tour = tours.find((el) => el.id === id);

  // // R: from https://stackoverflow.com/questions/65316870/how-to-use-patch-with-node-js-and-express and some changes by myself
  // // Just an example of PATCH request, using specifically "duration".
  // if (req.body.duration !== undefined) {
  //   tour.duration = req.body.duration;
  // }

  // fs.writeFile(`${__dirname}/dev-data/data/tours-simple.json`, JSON.stringify(tours), (err) => {
  //   res.status(201).json({
  //     status: 'success',
  //     data: {
  //       tour,
  //     },
  //   });
  // });

  // codigo abaixo veio das questions do video 55, atualiza qualquer field especificado no patch
  const id = req.params.id * 1;
  const tour = tours.find((tour) => tour.id === id);

  if (!tour) {
    return res.status(404).send({
      status: 'fail',
      message: 'Invalid ID',
    });
  }

  const updatedTour = { ...tour, ...req.body };
  const updatedTours = tours.map((tour) => (tour.id === updatedTour.id ? updatedTour : tour));

  fs.writeFile(`${__dirname}/dev-data/data/tours-simple.json`, JSON.stringify(updatedTours), (err) => {
    res.status(200).send({
      status: 'success',
      data: updatedTour,
    });
  });
};

// DELETE TOUR - function (peguei o codigo em uma das questions do video 56)
const deleteTour = (req, res) => {
  const tour = tours[parseInt(req.params.id)];
  if (tour) {
    tours.splice(tour.id, 1);
    fs.writeFile(`${__dirname}/dev-data/data/tours-simple.json`, JSON.stringify(tours), (err) => {
      res.status(204).json({
        status: 'succes',
        data: null,
      });
    });
  } else {
    res.status(404).json({
      status: 'failed',
      message: 'Tour does not exist. Use a valid path.',
    });
  }
};

// GET ALL TOURS - call function
// app.get('/api/v1/tours', getAllTours);

// POST - call function
// app.post('/api/v1/tours', createTour);

// GET TOUR - call function
// app.get('/api/v1/tours/:id', getTour);

// UPDATE TOUR - call function
// app.patch('/api/v1/tours/:id', updateTour);

// DELETE TOUR - call function
// app.delete('/api/v1/tours/:id', deleteTour);

app.route('/api/v1/tours').get(getAllTours).post(createTour);

app.route('/api/v1/tours/:id').get(getTour).patch(updateTour).delete(deleteTour);

const port = 3000;
app.listen(port, () => {
  console.log(`App running on port ${port}.`);
});
