/**
 * Races a promise against a timeout, rejecting with a clear error if the
 * timeout wins. Used to bound calls to the btch-downloader library, which
 * doesn't accept an AbortSignal itself — this can't cancel the underlying
 * work (it may keep running in the background), but it stops the client
 * from waiting on it indefinitely, which is what actually matters for a
 * caller.
 */
function withTimeout(promise, ms, message = "Operation timed out") {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

module.exports = withTimeout;
