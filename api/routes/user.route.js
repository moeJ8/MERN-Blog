import express from 'express';
import { verifyToken } from '../utils/verifyUser.js';
import { deleteUser, signout, updateUser, test, getUsers, getUser } from '../controllers/user.controller.js';


const router = express.Router();

router.get('/test', test);
router.put('/update/:userId', verifyToken, updateUser);
router.delete('/delete/:userId', verifyToken, deleteUser);
router.post('/signout', signout);
router.get('/getusers',verifyToken, getUsers);
router.get('/:userId', getUser);

export default router;