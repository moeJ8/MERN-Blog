import { errorHandler } from "../utils/error.js";
import Comment from "../models/comment.model.js";
export const createComment = async (req, res, next) => {
    try {
        const {content, postId, userId} = req.body;

        const now = new Date();
        const startOfDay = new Date(now.setHours(0, 0, 0, 0)); 
        const endOfDay = new Date(now.setHours(23, 59, 59, 999)); 
        
        
        const commentsToday = await Comment.countDocuments({
            userId,
            postId, 
            createdAt: { $gte: startOfDay, $lte: endOfDay } 
        });

        if (commentsToday >= 4) {
            return next(errorHandler(403, "You can only comment 4 times per post per 24 hours"));
        }

        if(userId !== req.user.id){
            return next(errorHandler(403, "You are not allowed to create a comment on this post"))
        }
        if (!content || content.trim() === "") {
            return next(errorHandler(400, "Comment cannot be empty"));
        }
        const newComment = new Comment({
            content,
            postId,
            userId
        })
        await newComment.save();

        res.status(200).json(newComment);

    } catch(err){
        next(err)
    }
}
export const getPostComments = async (req, res, next) => {
    try {
        const comments = await Comment.find({postId: req.params.postId}).sort({createdAt: -1});
        res.status(200).json(comments);
    }catch(err){
        next(err)
    }
}
export const likeComment = async (req, res, next) => {
    try{
        const comment = await Comment.findById(req.params.commentId);
        if(!comment){
            return next(errorHandler(404, "Comment not found"))
        }
        const userIndex = comment.likes.indexOf(req.user.id);
        if(userIndex === -1){
            comment.numberOfLikes += 1;
            comment.likes.push(req.user.id);
        } else{
            comment.numberOfLikes -= 1;
            comment.likes.splice(userIndex, 1);
        }
        await comment.save();
        res.status(200).json(comment);
    } catch(err){
        next(err)
    }
}

export const editComment = async (req, res, next) => {
    try{
        const comment = await Comment.findById(req.params.commentId);
        if(!comment){
            return next(errorHandler(404, "Comment not found"))
        }
        if(comment.userId !== req.user.id && !req.user.isAdmin){
            return next(errorHandler(403, "You are not allowed to edit this comment"))
        }
        const editedComment = await Comment.findByIdAndUpdate(
            req.params.commentId,
            {
                content: req.body.content,
            },
            {new: true}
        );
        res.status(200).json(editedComment);
    }catch(err){
        next(err)
    }
}

export const deleteComment = async (req, res, next) => {
    try{
        const comment = await Comment.findById(req.params.commentId);
        if(!comment){
            return next(errorHandler(404, "Comment not found"))
        }
        if(comment.userId !== req.user.id && !req.user.isAdmin){
            return next(errorHandler(403, "You are not allowed to delete this comment"))
        }
        await Comment.findByIdAndDelete(req.params.commentId);
        res.status(200).json("Comment has been deleted");
    } catch(err){
        next(err)
    }
}