import mongoose from 'mongoose'

export const conn = async () => {
  const uri =
    process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/Suits-app'

  await mongoose.connect(uri)
  console.log('Connected to MongoDB')
}
