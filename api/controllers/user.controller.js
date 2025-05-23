import { errorHandler } from "../utils/error.js";
import bcryptjs from "bcryptjs";
import User from "../models/user.model.js";
import PublisherRequest from '../models/publisherRequest.model.js';
import jwt from "jsonwebtoken";
import Token from '../models/token.js';
import { sendEmail } from '../utils/sendEmail.js';
import crypto from 'crypto';
import Notification from '../models/notification.model.js';
import { createNotification } from './notification.controller.js';

export const test = (req, res) => {
  res.json({ message: "API is working" });
};

export const updateUser = async (req, res, next) => {
  if (req.user.id !== req.params.userId) {
    return next(errorHandler(403, "You are not authorized to update this user"));
  }

  try {
    const existingUser = await User.findById(req.params.userId);
    if (!existingUser) {
      return next(errorHandler(404, "User not found"));
    }

    if (req.body.password) {
      if (req.body.password.length < 6) {
        return next(errorHandler(400, "Password must be at least 6 characters long"));
      }

      // Check if new password matches the current one
      const isSamePassword = await bcryptjs.compare(req.body.password, existingUser.password);
      if (isSamePassword) {
        return next(errorHandler(400, "The new password cannot be the same as the current one"));
      }

      req.body.password = await bcryptjs.hash(req.body.password, 10);
    }

    if (req.body.username) {
      if (req.body.username.length < 3 || req.body.username.length > 20) {
        return next(errorHandler(400, "Username must be between 3 and 20 characters long"));
      }
      if (req.body.username.includes(" ")) {
        return next(errorHandler(400, "Username cannot contain spaces"));
      }
      if (req.body.username !== req.body.username.toLowerCase()) {
        return next(errorHandler(400, "Username must be lowercase"));
      }
      if (!req.body.username.match(/^[a-zA-Z0-9]+$/)) {
        return next(errorHandler(400, "Username can only contain letters and numbers"));
      }

      const existingUsername = await User.findOne({ username: req.body.username });
      if (existingUsername && existingUsername._id.toString() !== req.params.userId) {
        return next(errorHandler(400, "Username is already taken"));
      }
    }

    // Validate date of birth if provided
    if (req.body.dateOfBirth) {
      const birthDate = new Date(req.body.dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      if (age < 13) {
        return next(errorHandler(400, "You must be at least 13 years old to use this platform"));
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.userId,
      {
        $set: {
          username: req.body.username,
          email: req.body.email,
          profilePicture: req.body.profilePicture,
          password: req.body.password,
          dateOfBirth: req.body.dateOfBirth,
        },
      },
      { new: true }
    );

    const { password, ...rest } = updatedUser._doc;
    res.status(200).json(rest);
  } catch (err) {
    next(err);
  } 
  
  
};

export const deleteUser = async (req, res, next) => {
  if(!req.user.isAdmin && req.user.id !== req.params.userId) {
    return next(errorHandler(403, "You are not authorized to delete this user"));
  }
  try{
    await User.findByIdAndDelete(req.params.userId);
    res.status(200).json("User has been deleted successfully");
  } catch (err) {
    next(err);
  }
};

export const signout = (req, res, next) => {
  try {
    res.clearCookie("access_token");
    res.status(200).json("User has been signed out");
  } catch (err) {
    next(err);
  }
};

export const getUsers = async (req, res, next) => {
  if(!req.user.isAdmin) {
    return next(errorHandler(403, "You are not authorized to view all users"));
  }
  try{
    const startIndex = parseInt(req.query.startIndex) || 0;
    const limit = parseInt(req.query.limit) || 9;
    const sortDirection = req.query.sort === "asc" ? 1 : -1;
    const searchTerm = req.query.searchTerm || '';
    const roleFilter = req.query.role || 'all';
    const statusFilter = req.query.status || 'all';
    const verifiedFilter = req.query.verified || 'all';

    // Build filter object
    const filter = {};

    // Add search term filter
    if (searchTerm) {
      filter.$or = [
        { username: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } }
      ];
    }

    // Add role filter
    if (roleFilter === 'admin') {
      filter.isAdmin = true;
    } else if (roleFilter === 'publisher') {
      filter.isPublisher = true;
      filter.isAdmin = { $ne: true }; // Not admin
    } else if (roleFilter === 'user') {
      filter.isPublisher = false;
      filter.isAdmin = false;
    }

    // Add status filter
    if (statusFilter === 'active') {
      filter.isBanned = false;
    } else if (statusFilter === 'banned') {
      filter.isBanned = true;
    }
    
    // Add verification filter
    if (verifiedFilter === 'true') {
      filter.verified = true;
    } else if (verifiedFilter === 'false') {
      filter.verified = false;
    }

    const users = await User.find(filter)
      .sort({ createdAt: sortDirection })
      .skip(startIndex)
      .limit(limit);

    const usersWithoutPassword = users.map((user) => {
      const { password, ...rest } = user._doc;
      return rest;
    });

    const totalUsers = await User.countDocuments(filter);
    const now = new Date();
    const oneMonthAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      now.getDate()
    );

    const lastMonthUsers = await User.countDocuments({
      ...filter,
      createdAt: { $gte: oneMonthAgo },
    });

    res.status(200).json({
      users: usersWithoutPassword,
      totalUsers,
      lastMonthUsers,
    });

  } catch(err) {
    next(err);
  }
}

export const getUser = async (req, res, next) => {
  try{
    const user = await User.findById(req.params.userId);
    if(!user) return next(errorHandler(404, "User not found"));

    const { password, ...rest } = user._doc;
    res.status(200).json(rest);
  } catch(err) {
    next(err);
  }
}

export const updateUserRole = async (req, res, next) => {
  const { userId, isPublisher } = req.body;
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: "Access denied." });
  }
  try {
    const user = await User.findById(userId);
    if(!user) return next(errorHandler(404, "User not found"));

    user.isPublisher = isPublisher;
    await user.save();
    
    // Get the admin ID and target user ID for comparison
    const adminId = req.user.id;
    const targetUserId = userId.toString();
    
    // Generate a new token with updated role
    const token = jwt.sign(
      {
        id: user._id,
        isAdmin: user.isAdmin,
        isPublisher: user.isPublisher
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
    
    // ONLY set the token cookie if the admin is updating their OWN role
    // This prevents overwriting the admin's token when updating someone else
    if (targetUserId === adminId) {
      res.cookie("access_token", token, { httpOnly: true });
    }
    
    res.status(200).json({ 
      message: "User updated successfully.",
      user: {
        _id: user._id,
        username: user.username,
        isAdmin: user.isAdmin,
        isPublisher: user.isPublisher
      }
    });
  }catch(err) {
    next(err);
  }
}

export const requestPublisher = async (req, res, next) => {
  const { userId, reason } = req.body;
  
  if (!reason || reason.trim() === '') {
    return res.status(400).json({ message: "Please provide a reason for your publisher request." });
  }
  
  try {
    const existingRequest = await PublisherRequest.findOne({ userId, status: "pending" });
    if (existingRequest) {
      return res.status(400).json({ message: "You already have a pending request." });
    }

    // Get the user who made the request to include their username in notification
    const requestingUser = await User.findById(userId);
    if (!requestingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Create the publisher request
    await PublisherRequest.create({ userId, reason });

    // Find all admin users to notify them
    const adminUsers = await User.find({ isAdmin: true });
    
    // Create notifications for all admins
    for (const admin of adminUsers) {
      try {
        await createNotification(req, {
          recipient: admin._id,
          title: 'New Publisher Request',
          message: `${requestingUser.username} has requested to become a publisher`,
          type: 'publisher_request',
          triggeredBy: userId
        });
      } catch (error) {
        console.error('Error creating notification:', error);
        // Continue with other admins even if one notification fails
      }
    }

    res.status(200).json({ message: "Request sent successfully." });
  } catch(err) {
    next(err);
  }
}

export const getPublisherRequests = async (req, res, next) => {
  if (!req.user.isAdmin) {
    return next(errorHandler(403, "You are not authorized to view publisher requests"));
  }
  try {
    const startIndex = parseInt(req.query.startIndex) || 0;
    const limit = parseInt(req.query.limit) || 9;
    const sortDirection = req.query.sort === "asc" ? 1 : -1;
    const status = req.query.status || 'pending';

    const requests = await PublisherRequest.find({ status })
      .sort({ createdAt: sortDirection })
      .skip(startIndex)
      .limit(limit)
      .populate('userId', 'username email profilePicture');

    const totalRequests = await PublisherRequest.countDocuments({ status });

    res.status(200).json({
      requests,
      totalRequests,
    });
  } catch (err) {
    next(err);
  }
}

export const updatePublisherRequest = async (req, res, next) => {
  if (!req.user.isAdmin) {
    return next(errorHandler(403, "You are not authorized to update publisher requests"));
  }
  const { requestId, status } = req.body;
  try {
    const request = await PublisherRequest.findById(requestId);
    if (!request) {
      return next(errorHandler(404, "Request not found"));
    }

    request.status = status;
    await request.save();

    // Get the user ID strings for comparison
    const requestUserId = request.userId.toString();
    const adminId = req.user.id;

    // Get admin user info for notification
    const admin = await User.findById(adminId);
    if (!admin) {
      return next(errorHandler(404, "Admin not found"));
    }

    if (status === 'approved') {
      const updatedUser = await User.findByIdAndUpdate(
        request.userId, 
        { isPublisher: true },
        { new: true }
      );
      
      if (updatedUser) {
        // Create notification for user about approval
        try {
          await createNotification(req, {
            recipient: updatedUser._id,
            title: 'Publisher Request Approved',
            message: `Your request to become a publisher has been approved`,
            type: 'publisher_approved',
            triggeredBy: adminId
          });
        } catch (error) {
          console.error('Error creating approval notification:', error);
          // Continue even if notification fails
        }

        const token = jwt.sign(
          {
            id: updatedUser._id,
            isAdmin: updatedUser.isAdmin,
            isPublisher: true
          },
          process.env.JWT_SECRET,
          { expiresIn: "1d" }
        );
        
        // ONLY update the token cookie if the admin is approving their OWN request
        // This prevents overwriting the admin's token when they approve someone else's request
        if (requestUserId === adminId) {
          res.cookie("access_token", token, { httpOnly: true });
        }
        // Otherwise, don't touch the admin's token
      }
    } else if (status === 'rejected') {
      // Create notification for user about rejection
      try {
        await createNotification(req, {
          recipient: request.userId,
          title: 'Publisher Request Rejected',
          message: `Your request to become a publisher has been rejected`,
          type: 'publisher_rejected',
          triggeredBy: adminId
        });
      } catch (error) {
        console.error('Error creating rejection notification:', error);
        // Continue even if notification fails
      }
    }

    res.status(200).json({ message: "Request updated successfully" });
  } catch (err) {
    next(err);
  }
}

export const getUserByUsername = async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return next(errorHandler(404, "User not found"));

    const { password, ...rest } = user._doc;
    res.status(200).json(rest);
  } catch (err) {
    next(err);
  }
};

export const searchUsers = async (req, res, next) => {
  try {
    const username = req.query.username;
    const limit = parseInt(req.query.limit) || 6;
    
    if (!username) {
      return res.status(200).json({ users: [] });
    }
    
    // case-insensitive regex pattern for the username
    const usernameRegex = new RegExp(username, 'i');
    
    // Find users that match the search term
    const users = await User.find({ 
      username: usernameRegex 
    })
    .limit(limit)
    .select('-password -email'); // Exclude sensitive data
    
    res.status(200).json({ users });
  } catch (err) {
    next(err);
  }
};

export const resendVerificationLink = async (req, res, next) => {
  try {
    // Check if user is requesting for themselves
    if (req.user.id !== req.params.userId) {
      return next(errorHandler(403, "You can only request verification for your own account"));
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }

    if (user.verified) {
      return res.status(400).json({ message: "This account is already verified" });
    }

    // Delete any existing tokens
    await Token.deleteMany({ userId: user._id });

    // Create new verification token
    const token = await new Token({
      userId: user._id,
      token: crypto.randomBytes(32).toString("hex")
    }).save();

    // Create verification URL
    const url = `${process.env.BASE_URL}/users/${user._id}/verify/${token.token}`;

    // Send verification email
    await sendEmail(
      user.email,
      "Verify Your Email",
      `Please click the link to verify your email: ${url}`
    );

    res.status(200).json({ message: "Verification link has been sent to your email" });
  } catch (err) {
    next(err);
  }
};

export const followUser = async (req, res, next) => {
  try {
    const userToFollow = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user.id);

    if (!userToFollow) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!userToFollow.isAdmin && !userToFollow.isPublisher) {
      return res.status(400).json({ 
        success: false, 
        message: 'You can only follow publishers and admins' 
      });
    }

    if (currentUser.following.includes(userToFollow._id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'You are already following this user' 
      });
    }

    if (userToFollow._id.toString() === currentUser._id.toString()) {
      return res.status(400).json({ 
        success: false, 
        message: 'You cannot follow yourself' 
      });
    }

    // Update following list for current user
    await User.findByIdAndUpdate(currentUser._id, {
      $push: { following: userToFollow._id }
    });

    // Update followers list for target user
    await User.findByIdAndUpdate(userToFollow._id, {
      $push: { followers: currentUser._id }
    });

    // Create a notification for the followed user
    const notification = new Notification({
      recipient: userToFollow._id,
      title: 'New Follower',
      message: `${currentUser.username} started following you`,
      type: 'follow',
      triggeredBy: currentUser._id
    });
    await notification.save();

    res.status(200).json({ 
      success: true, 
      message: `You are now following ${userToFollow.username}` 
    });
  } catch (error) {
    next(error);
  }
};

export const unfollowUser = async (req, res, next) => {
  try {
    const userToUnfollow = await User.findById(req.params.id);
    const currentUser = await User.findById(req.user.id);

    if (!userToUnfollow) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!currentUser.following.includes(userToUnfollow._id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'You are not following this user' 
      });
    }

    // Update following list for current user
    await User.findByIdAndUpdate(currentUser._id, {
      $pull: { following: userToUnfollow._id }
    });

    // Update followers list for target user
    await User.findByIdAndUpdate(userToUnfollow._id, {
      $pull: { followers: currentUser._id }
    });

    res.status(200).json({ 
      success: true, 
      message: `You have unfollowed ${userToUnfollow.username}` 
    });
  } catch (error) {
    next(error);
  }
};

export const getUserFollowers = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const followers = await User.find({ _id: { $in: user.followers } })
      .select('username profilePicture isAdmin isPublisher');

    res.status(200).json(followers);
  } catch (error) {
    next(error);
  }
};

export const getUserFollowing = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const following = await User.find({ _id: { $in: user.following } })
      .select('username profilePicture isAdmin isPublisher');

    res.status(200).json(following);
  } catch (error) {
    next(error);
  }
};

export const banUser = async (req, res, next) => {
  try {
    if (!req.user.isAdmin) {
      return next(errorHandler(403, "You don't have permission to ban users"));
    }

    const { userId, duration, reason } = req.body;
    
    if (!userId || !duration) {
      return next(errorHandler(400, "User ID and ban duration are required"));
    }

    const userToBan = await User.findById(userId);
    if (!userToBan) {
      return next(errorHandler(404, "User not found"));
    }

    if (userToBan.isAdmin) {
      return next(errorHandler(403, "Cannot ban another admin"));
    }

    let banExpiresAt = new Date();
    switch (duration) {
      case '30m':
        banExpiresAt.setMinutes(banExpiresAt.getMinutes() + 30);
        break;
      case '1h':
        banExpiresAt.setHours(banExpiresAt.getHours() + 1);
        break;
      case '12h':
        banExpiresAt.setHours(banExpiresAt.getHours() + 12);
        break;
      case '1d':
        banExpiresAt.setDate(banExpiresAt.getDate() + 1);
        break;
      case '3d':
        banExpiresAt.setDate(banExpiresAt.getDate() + 3);
        break;
      case '1w':
        banExpiresAt.setDate(banExpiresAt.getDate() + 7);
        break;
      case '2w':
        banExpiresAt.setDate(banExpiresAt.getDate() + 14);
        break;
      case '1m':
        banExpiresAt.setMonth(banExpiresAt.getMonth() + 1);
        break;
      case '3m':
        banExpiresAt.setMonth(banExpiresAt.getMonth() + 3);
        break;
      case '6m':
        banExpiresAt.setMonth(banExpiresAt.getMonth() + 6);
        break;
      case '1y':
        banExpiresAt.setFullYear(banExpiresAt.getFullYear() + 1);
        break;
      case '2y':
        banExpiresAt.setFullYear(banExpiresAt.getFullYear() + 2);
        break;
      case 'permanent':
        // Set to a date far in the future
        banExpiresAt = new Date(2100, 0, 1);
        break;
      default:
        return next(errorHandler(400, "Invalid ban duration"));
    }

    await User.findByIdAndUpdate(userId, {
      isBanned: true,
      banExpiresAt,
      banReason: reason || "Violation of terms of service"
    });

    res.status(200).json({
      success: true,
      message: `User banned successfully until ${banExpiresAt.toLocaleString()}`,
    });
  } catch (err) {
    next(err);
  }
};

export const unbanUser = async (req, res, next) => {
  try {
    if (!req.user.isAdmin) {
      return next(errorHandler(403, "You don't have permission to unban users"));
    }

    const { userId } = req.params;
    
    if (!userId) {
      return next(errorHandler(400, "User ID is required"));
    }

    const userToUnban = await User.findById(userId);
    if (!userToUnban) {
      return next(errorHandler(404, "User not found"));
    }

    await User.findByIdAndUpdate(userId, {
      isBanned: false,
      banExpiresAt: null,
      banReason: null
    });
    res.status(200).json({
      success: true,
      message: "User unbanned successfully",
    });
  } catch (err) {
    next(err);
  }
};

export const refreshUserData = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Get the latest user data from database to ensure roles are up-to-date
    const user = await User.findById(userId);
    
    if (!user) {
      return next(errorHandler(404, "User not found"));
    }
    
    // Generate a new token with current permissions from database
    const token = jwt.sign(
      {
        id: user._id,
        isAdmin: user.isAdmin,
        isPublisher: user.isPublisher
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
    
    // Set the token in cookies
    res.cookie("access_token", token, { 
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    
    // Return user data without password
    const { password, ...userData } = user._doc;
    
    res.status(200).json({
      ...userData,
      token
    });
  } catch (err) {
    next(err);
  }
};