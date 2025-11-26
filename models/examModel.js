import mongoose from 'mongoose';

const examSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    duration: { type: Number, required: true }, // duration in minutes
    totalMarks: { type: Number, required: true },
    proctor: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    questions: [
        {
            questionText: { type: String, required: true },
            options: [{ type: String, required: true }],
            correctOptionIndex: { type: Number, required: true },
            marks: { type: Number, required: true }
        }
    ]
},
{
    timestamps: true
}); 

const examModel = mongoose.model('Exam', examSchema);

export default examModel;