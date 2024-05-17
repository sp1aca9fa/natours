class AppError extends Error {
  constructor(message, statusCode) {
    // Xx: constructor method is called each time we create a new obbject out of this class
    super(message); // Xx: call super to call the parent constructor

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error'; // Xx: Ternary (?) evaluates a condition and executes a block of code based on the condition. Its syntax is: condition ? expression1 : expression2
    this.isOperational = true; // Xx: means it's an operational error (as opposed to developer/code/library/etc error); the client should only see the errors from its own operations

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
