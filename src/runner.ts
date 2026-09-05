let logCount = 0;

const logInterval = setInterval(() => {
  logCount += 1;
  console.log(`hello world ${logCount}`);

  if (logCount === 5) {
    clearInterval(logInterval);
  }
}, 1000);
