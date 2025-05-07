import jwt from 'jsonwebtoken';

const auth = (req, res, next) => {

    try {
        const { token } = req.headers;
        const { email } = req.body;

        if(!token){
            return res.json({success:false, message:"Not Authorized Login Again"})
        }
        const token_decode = jwt.verify(token,process.env.JWT_SECRET);
        if(token_decode.email !== email){
            return res.json({success:false, message:"Not Authorized Login Again"})
        }
        next();
    } catch (error) {
        return res.json({success:false, message:error.message})
    }
}

export default auth;