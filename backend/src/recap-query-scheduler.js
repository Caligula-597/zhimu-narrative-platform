export function createQueryScheduler({ concurrency = 4 } = {}) {
  const limit = Math.max(1, Math.floor(concurrency));
  const queue = [];
  let active = 0;

  function drain() {
    while (active < limit && queue.length) {
      const job = queue.shift();
      active += 1;
      Promise.resolve()
        .then(job.task)
        .then(job.resolve, job.reject)
        .finally(() => {
          active -= 1;
          drain();
        });
    }
  }

  return function schedule(task) {
    return new Promise((resolve, reject) => {
      queue.push({ task, resolve, reject });
      drain();
    });
  };
}
