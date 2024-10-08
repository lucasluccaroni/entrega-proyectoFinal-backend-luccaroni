const mongoose = require("mongoose")
const mongoosePaginate = require("mongoose-paginate-v2")

const schema = new mongoose.Schema({

    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    age: {
        type: Number,
        required: true
    },
    password: {
        type: String,
    },
    email: {
        type: String,
        required: true
    },
    cart: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Cart"
    },
    role: {
        type: String,
        default: "user"
    },
    documents: [
        {
            docName: { type: String },
            docReference: { type: String }
        }
    ],
    last_connection: {
        type: Date
    }
})

schema.plugin(mongoosePaginate)

module.exports = mongoose.model("User", schema, "users")

