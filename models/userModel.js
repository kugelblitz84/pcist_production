import mongoose from 'mongoose'


// role : 1 - member, 2 - admin

const userSchema = new mongoose.Schema({
	classroll: { type: Number, required: true, unique: true },
	email: { type: String, required: true, unique: true },
	verificationCode: {type: String},
	is_email_verified: { type: Boolean, default: false },
	forgotPasswordCode: {type: String},
	password: { type: String, required: true },
	phone: { type: String },
	profileimage: { type: String },
	name: { type: String },
	gender: { type: String },
	tshirt: { type: String },
	batch: { type: Number },
	dept: { type: String },
	role: { type: Number, required: true, default: 1 },
	membership: { type: Boolean, default: false },
	cfhandle: { type: String, unique: true },
	atchandle: { type: String, unique: true },
	cchandle: { type: String, unique: true },
	is_cfhandle_verified: { type: Boolean },
	is_atchandle_verified: { type: Boolean },
	is_cchandle_verified: { type: Boolean },
	badges: [{ type: String}],
	certificates: [{ type: String }],
	slug: { type: String, unique: true }
}, {
	minimize: false,
	timestamps: true
})

const userModel = mongoose.models.user || mongoose.model('user', userSchema);

export default userModel