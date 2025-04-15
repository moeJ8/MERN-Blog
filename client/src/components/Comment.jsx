import { useState } from "react"
import PropTypes from 'prop-types';
import moment from 'moment';
import {FaThumbsUp} from 'react-icons/fa';
import { useSelector } from "react-redux";
import { Button, Textarea } from "flowbite-react";
import { Link } from "react-router-dom";

export default function Comment({comment, onLike, onEdit, onDelete}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState(comment.content);
    const {currentUser} = useSelector(state => state.user);

    const handleEdit = () => {
        setIsEditing(true);
        setEditedContent(comment.content);
    }

    const handleSave = async () => {
        try{
            const res = await fetch(`/api/comment/editComment/${comment._id}`,{
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: editedContent
                })
            });
            if(res.ok){
                setIsEditing(false);
                onEdit(comment, editedContent);
            }
        } catch(err){
            console.log(err.message)
        }
    }

    return (
        <div className="flex p-4 border-b dark:border-gray-600 text-sm">
            <div className="flex-shrink-0 mr-3">
                <Link to={`/profile/${comment.userId.username}`}>
                    <img 
                        src={comment.userId.profilePicture} 
                        alt={comment.userId.username} 
                        className="w-10 h-10 rounded-full bg-gray-200 hover:ring-2 hover:ring-blue-500" 
                    />
                </Link>
            </div>
            <div className="flex-1">
                <div className="flex items-center mb-1">
                    <Link to={`/profile/${comment.userId.username}`} className="hover:text-blue-500">
                        <span className="font-bold mr-1 text-xs truncate">
                            @{comment.userId.username}
                        </span>
                    </Link>
                    <span className="text-gray-500 text-xs">
                        {moment(comment.createdAt).fromNow()}
                    </span>
                </div>
                {isEditing ? (
                    <>
                        <Textarea
                            className="mb-2"
                            value={editedContent}
                            onChange={(e) => setEditedContent(e.target.value)}
                        />
                        <div className="flex justify-end gap-2 text-xs">
                            <Button
                                type="button"
                                size="sm"
                                gradientDuoTone="purpleToBlue"
                                onClick={handleSave}
                            >
                                Save
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                gradientDuoTone="purpleToBlue"
                                outline
                                onClick={() => setIsEditing(false)}
                            >
                                Cancel
                            </Button>
                        </div>
                    </>
                ) : (
                    <>
                        <p className="text-gray-500 pb-2 break-all">{comment.content}</p>
                        <div className="flex items-center pt-2 text-xs border-t dark:border-gray-700 max-w-fit gap-2">
                            <button 
                                type="button" 
                                onClick={() => onLike(comment._id)} 
                                className={`text-gray-400 hover:text-blue-500 ${currentUser && comment.likes.includes(currentUser._id) && '!text-blue-500'}`}
                            >
                                <FaThumbsUp className="text-sm"/>
                            </button>
                            <p className="text-gray-400">
                                {comment.likes.length > 0 && comment.numberOfLikes + " " + (comment.numberOfLikes === 1 ? "like" : "likes")}
                            </p>
                            {currentUser && (currentUser._id === comment.userId._id || currentUser.isAdmin) && (
                                <>
                                    <button type="button" onClick={handleEdit} className="text-gray-400 hover:text-blue-500">
                                        Edit
                                    </button>
                                    <button type="button" onClick={() => onDelete(comment._id)} className="text-gray-400 hover:text-red-500">
                                        Delete
                                    </button>
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

Comment.propTypes = {
    comment: PropTypes.shape({
        userId: PropTypes.shape({
            _id: PropTypes.string.isRequired,
            username: PropTypes.string.isRequired,
            profilePicture: PropTypes.string.isRequired,
        }).isRequired,
        content: PropTypes.string.isRequired,
        createdAt: PropTypes.string.isRequired,
        _id: PropTypes.string.isRequired,
        likes: PropTypes.arrayOf(PropTypes.string).isRequired,
        numberOfLikes: PropTypes.number,
    }).isRequired,
    onLike: PropTypes.func.isRequired, 
    onEdit: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired,
};