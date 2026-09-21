/**
 * Account removal.
 *
 * The account row is anonymised instead of hard-deleted: conversations,
 * donations and job applications that belong to other people reference it and
 * must keep working. Personal data is scrubbed, private relations are removed
 * or cancelled, and the email address is released so the same person can
 * register again later. Every record that stays behind reads as "Former Member".
 */
const crypto = require('crypto');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Mentorship = require('../models/Mentorship');
const Event = require('../models/Event');
const Group = require('../models/Group');
const Job = require('../models/Job');
const Review = require('../models/Review');

const PLACEHOLDER_NAME = 'Former Member';
const OPEN_MENTORSHIP_STATUSES = ['pending', 'accepted'];

async function deactivateAccount(user) {
  const id = user._id;
  const now = new Date();

  // Keep the row, lose the person
  user.name = PLACEHOLDER_NAME;
  user.email = `deleted.${id.toString()}@removed.com`;
  user.password = crypto.randomBytes(32).toString('hex'); // hashed by the model's pre-save hook
  user.isActive = false;
  user.deletedAt = now;
  user.emailVerified = false;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  if (user.profile) {
    // Graduation facts are kept so cohort statistics stay meaningful;
    // everything identifying or personal is dropped.
    const { graduationYear, department, degree } = user.profile;
    user.profile = { graduationYear, department, degree };
  }

  await user.save();

  // Private relations go away; shared records stay and read as "Former Member"
  await Promise.all([
    Notification.deleteMany({ $or: [{ recipient: id }, { actor: id }] }),
    Review.deleteMany({ $or: [{ reviewer: id }, { reviewee: id }] }),
    Mentorship.updateMany(
      { $or: [{ mentor: id }, { mentee: id }], status: { $in: OPEN_MENTORSHIP_STATUSES } },
      { $set: { status: 'cancelled' } }
    ),
    Event.updateMany({ 'attendees.user': id }, { $pull: { attendees: { user: id } } }),
    Group.updateMany({ 'members.user': id }, { $pull: { members: { user: id } } }),
    Job.updateMany({ postedBy: id }, { $set: { status: 'closed' } }),
    User.updateMany(
      { 'profile.skills.endorsements': id },
      { $pull: { 'profile.skills.$[].endorsements': id } }
    )
  ]);

  return user;
}

module.exports = { deactivateAccount, PLACEHOLDER_NAME };
