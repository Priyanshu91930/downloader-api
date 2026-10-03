/**
 * Races a promise against a timeout, rejecting with a clear error if the
 * timeout wins. Used to bound calls to the btch-downloader library.
 * Safe against unhandled promise rejections during parallel Promise.any races.
 */
function withTimeout(promise, ms, message = "Operation timed out") {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });

  // Attach catch handlers to prevent unhandled rejection crashes in Node.js
  timeoutPromise.catch(() => {});
  if (promise && typeof promise.catch === "function") {
    promise.catch(() => {});
  }

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

module.exports = withTimeout;
