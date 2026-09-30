// Runs tasks that share a key one after another (per process). Website saves use it so an autosave
// and a publish for the same company can't read the document, upload photos and then both try to
// save it - the second save fails with a Mongoose VersionError ("No matching document found ... version N").
const tails = new Map();

const runExclusive = async (key, task) => {
  if (!key) return task();
  const previous = tails.get(key) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  tails.set(key, tail);
  await previous;
  try {
    return await task();
  } finally {
    release();
    if (tails.get(key) === tail) tails.delete(key);
  }
};

module.exports = { runExclusive };
