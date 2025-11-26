import userModel from '../models/userModel.js';
import examModel from '../models/examModel.js';
const setProctor = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    user.role = 3; // Set role to proctor
    await user.save();
    res.status(200).json({ message: 'User role updated to proctor' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

const setExam = async (req, res) => {
  try {
    const { title, description, date, time, duration, totalMarks, questions } = req.body;
    const proctor = req.user; // Assuming req.user contains the authenticated user
    if (!proctor || proctor.role !== 3) {
      return res.status(400).json({ message: 'Invalid proctor' });
    }
    
    const newExam = new examModel({
      title,
      description,
      date,
      time,
      duration,
      totalMarks,
      proctor: proctor._id,
      questions
    });
    await newExam.save();
    res.status(201).json({ message: 'Exam created successfully', exam: newExam });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export { setProctor , setExam };