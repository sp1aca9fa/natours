// Xx: catchAsync is called when a function is called (instead of doing the function directly). catchAsync will then go back to function from which it was called returning the parameters for the function, but then catching errors through the catch block, if any. this is so we can eliminate having repeated catch blocks in each function.
// Xx: old implementation of catchsync only accepting 3 arguments
// module.exports = (fn) => {
//   return (req, res, next) => {
//     fn(req, res, next).catch(next);
//   };
// };
// Xx: new implementation of catchasync proposed by perplexity AI to accept 34879012380291809 arguments and catch using the last argument, which is usually the error handler
module.exports = (fn) => {
  return (...args) => fn(...args).catch(args[args.length - 1]);
};
