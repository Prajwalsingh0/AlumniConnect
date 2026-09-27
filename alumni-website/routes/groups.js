/**
 * Groups.
 *
 * A group has members with roles (member/moderator/admin) and an owner
 * (createdBy). Private groups are unlisted: they never appear in the public
 * listing and are only readable by members, so they are shared by link.
 *
 * Request bodies are whitelisted field by field - nothing is spread straight
 * into the model, so a client cannot set members, roles or pin flags.
 */
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Group = require('../models/Group');
const ForumPost = require('../models/ForumPost');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const CATEGORIES = ['department', 'industry', 'hobby', 'location', 'other'];
const NAME_MIN = 2;
const NAME_MAX = 80;
const DESCRIPTION_MAX = 500;
const POST_TITLE_MIN = 3;
const POST_TITLE_MAX = 120;
const POST_CONTENT_MAX = 2000;
const MAX_IMAGES = 5;

const isValidObjectId = (id) => typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);

const memberEntry = (group, userId) =>
  (group.members || []).find((m) => m.user && m.user.toString() === userId);

const isMember = (group, userId) => !!memberEntry(group, userId);

// The owner and group admins can edit, delete and moderate
const canManage = (group, userId) =>
  group.createdBy.toString() === userId ||
  (() => {
    const entry = memberEntry(group, userId);
    return !!entry && entry.role === 'admin';
  })();

function readText(value, { field, min = 0, max }) {
  if (value === undefined || value === null) return { value: undefined };
  if (typeof value !== 'string') return { error: `${field} must be text` };
  const trimmed = value.trim();
  if (trimmed.length < min) return { error: `${field} must be at least ${min} characters` };
  if (trimmed.length > max) return { error: `${field} cannot exceed ${max} characters` };
  return { value: trimmed };
}

function readBoolean(value, field) {
  if (value === undefined) return { value: undefined };
  if (typeof value !== 'boolean') return { error: `${field} must be true or false` };
  return { value };
}

function readImages(value) {
  if (value === undefined) return { value: undefined };
  if (!Array.isArray(value)) return { error: 'images must be a list' };
  if (value.length > MAX_IMAGES) return { error: `A post can have at most ${MAX_IMAGES} images` };
  const cleaned = [];
  for (const item of value) {
    if (typeof item !== 'string') return { error: 'Each image must be a URL or path' };
    const trimmed = item.trim();
    if (!trimmed || trimmed.length > 300) return { error: 'Each image must be between 1 and 300 characters' };
    cleaned.push(trimmed);
  }
  return { value: cleaned };
}

// Get the groups a visitor may see
router.get('/', optionalAuth, async (req, res) => {
  try {
    // Signed-in members also see the private groups they belong to
    const filter = req.user
      ? { $or: [{ isPrivate: { $ne: true } }, { 'members.user': req.user.userId }] }
      : { isPrivate: { $ne: true } };

    const groups = await Group.find(filter).sort({ name: 1 });
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a group
router.post('/', authenticateToken, async (req, res) => {
  try {
    const body = req.body || {};

    const name = readText(body.name, { field: 'Name', min: NAME_MIN, max: NAME_MAX });
    if (name.error) return res.status(400).json({ error: name.error });
    if (name.value === undefined) return res.status(400).json({ error: 'Name is required' });

    const description = readText(body.description, { field: 'Description', max: DESCRIPTION_MAX });
    if (description.error) return res.status(400).json({ error: description.error });

    const image = readText(body.image, { field: 'Image', max: 300 });
    if (image.error) return res.status(400).json({ error: image.error });

    if (body.category !== undefined && !CATEGORIES.includes(body.category)) {
      return res.status(400).json({ error: `Category must be one of: ${CATEGORIES.join(', ')}` });
    }

    const isPrivate = readBoolean(body.isPrivate, 'Private setting');
    if (isPrivate.error) return res.status(400).json({ error: isPrivate.error });

    const existing = await Group.findOne({ name: name.value }).select('_id');
    if (existing) return res.status(409).json({ error: 'A group with that name already exists' });

    const group = new Group({
      name: name.value,
      description: description.value,
      image: image.value,
      category: body.category || 'other',
      isPrivate: isPrivate.value === true,
      createdBy: req.user.userId,
      members: [{ user: req.user.userId, role: 'admin' }]
    });

    await group.save();
    res.status(201).json(group);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Join a group
router.post('/:id/join', authenticateToken, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid group id' });
    }

    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    if (isMember(group, req.user.userId)) {
      return res.status(400).json({ error: 'Already a member' });
    }

    group.members.push({ user: req.user.userId });
    await group.save();
    res.json({ message: 'Joined group successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Leave a group
router.post('/:id/leave', authenticateToken, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid group id' });
    }

    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    if (!isMember(group, req.user.userId)) {
      return res.status(403).json({ error: 'You are not a member of this group' });
    }

    if (group.createdBy.toString() === req.user.userId) {
      return res.status(409).json({ error: 'You created this group - delete it instead of leaving' });
    }

    group.members = group.members.filter((m) => !m.user || m.user.toString() !== req.user.userId);

    if (group.members.length === 0) {
      await ForumPost.deleteMany({ group: group._id });
      await group.deleteOne();
      return res.json({ message: 'You left the group. It had no members left, so it was removed.' });
    }

    await group.save();
    res.json({ message: 'Left the group' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a group (owner or group admin)
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid group id' });
    }

    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    if (!canManage(group, req.user.userId)) {
      return res.status(403).json({ error: 'Only the group owner or an admin can change this group' });
    }

    const body = req.body || {};
    const update = {};

    const name = readText(body.name, { field: 'Name', min: NAME_MIN, max: NAME_MAX });
    if (name.error) return res.status(400).json({ error: name.error });
    if (name.value !== undefined) {
      const clash = await Group.findOne({ name: name.value, _id: { $ne: group._id } }).select('_id');
      if (clash) return res.status(409).json({ error: 'A group with that name already exists' });
      update.name = name.value;
    }

    const description = readText(body.description, { field: 'Description', max: DESCRIPTION_MAX });
    if (description.error) return res.status(400).json({ error: description.error });
    if (description.value !== undefined) update.description = description.value;

    const image = readText(body.image, { field: 'Image', max: 300 });
    if (image.error) return res.status(400).json({ error: image.error });
    if (image.value !== undefined) update.image = image.value;

    if (body.category !== undefined) {
      if (!CATEGORIES.includes(body.category)) {
        return res.status(400).json({ error: `Category must be one of: ${CATEGORIES.join(', ')}` });
      }
      update.category = body.category;
    }

    const isPrivate = readBoolean(body.isPrivate, 'Private setting');
    if (isPrivate.error) return res.status(400).json({ error: isPrivate.error });
    if (isPrivate.value !== undefined) update.isPrivate = isPrivate.value;

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    Object.assign(group, update);
    await group.save();
    res.json(group);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a group and its posts (owner or group admin)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid group id' });
    }

    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    if (!canManage(group, req.user.userId)) {
      return res.status(403).json({ error: 'Only the group owner or an admin can delete this group' });
    }

    const { deletedCount } = await ForumPost.deleteMany({ group: group._id });
    await group.deleteOne();

    res.json({ message: 'Group deleted', deletedPosts: deletedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get posts in a group
router.get('/:id/posts', optionalAuth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid group id' });
    }

    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // A private group's content is never shown to outsiders
    if (group.isPrivate && !(req.user && isMember(group, req.user.userId))) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const posts = await ForumPost.find({ group: group._id })
      .populate('author', 'name profile.profileImage')
      .sort({ isPinned: -1, createdAt: -1 });

    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a post in a group
router.post('/:id/posts', authenticateToken, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid group id' });
    }

    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    if (!isMember(group, req.user.userId)) {
      return res.status(403).json({ error: 'Must be a member to post' });
    }

    const body = req.body || {};

    const title = readText(body.title, { field: 'Title', min: POST_TITLE_MIN, max: POST_TITLE_MAX });
    if (title.error) return res.status(400).json({ error: title.error });
    if (title.value === undefined) return res.status(400).json({ error: 'Title is required' });

    const content = readText(body.content, { field: 'Content', min: 1, max: POST_CONTENT_MAX });
    if (content.error) return res.status(400).json({ error: content.error });
    if (content.value === undefined) return res.status(400).json({ error: 'Content is required' });

    const images = readImages(body.images);
    if (images.error) return res.status(400).json({ error: images.error });

    const post = new ForumPost({
      group: group._id,
      author: req.user.userId,
      title: title.value,
      content: content.value,
      images: images.value || []
    });

    await post.save();
    await post.populate('author', 'name profile.profileImage');
    res.status(201).json(post);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a post (its author, or the group owner/admin)
router.delete('/:id/posts/:postId', authenticateToken, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id) || !isValidObjectId(req.params.postId)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const post = await ForumPost.findOne({ _id: req.params.postId, group: group._id });
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const mine = post.author.toString() === req.user.userId;
    if (!mine && !canManage(group, req.user.userId)) {
      return res.status(403).json({ error: 'You can only delete your own posts' });
    }

    await post.deleteOne();
    res.json({ message: 'Post deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Pin or unpin a post (owner or group admin)
router.patch('/:id/posts/:postId/pin', authenticateToken, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id) || !isValidObjectId(req.params.postId)) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    if (!canManage(group, req.user.userId)) {
      return res.status(403).json({ error: 'Only the group owner or an admin can pin posts' });
    }

    const post = await ForumPost.findOne({ _id: req.params.postId, group: group._id });
    if (!post) return res.status(404).json({ error: 'Post not found' });

    post.isPinned = req.body && req.body.isPinned === false ? false : true;
    await post.save();

    res.json({ message: post.isPinned ? 'Post pinned' : 'Post unpinned', isPinned: post.isPinned });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
