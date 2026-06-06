import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

/**
 * Atomically increments the named counter and returns the NEW value.
 * Uses findOneAndUpdate with $inc + upsert so it is safe under any level
 * of parallelism — MongoDB guarantees the increment is atomic.
 */
counterSchema.statics.getNextSequence = async function (name) {
  const result = await this.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return result.seq;
};

/**
 * Seed (or raise) the counter to at least `minValue`.
 * Uses $max so the update only takes effect when minValue > current seq.
 * Safe to call multiple times with any value.
 */
counterSchema.statics.ensureMinimum = async function (name, minValue) {
  await this.findOneAndUpdate(
    { _id: name },
    { $max: { seq: minValue } },
    { upsert: true }
  );
};

const Counter = mongoose.model('Counter', counterSchema);

export default Counter;
