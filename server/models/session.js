import mongoose from 'mongoose'

const SessionSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    shop: {
        type: String,
        required: true
    }
})

const Session =
    mongoose.models.Session || mongoose.model('Session', SessionSchema)

export default Session
