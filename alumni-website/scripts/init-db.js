/**
 * init-db.js - Database bootstrap & demo seed
 *
 * Creates the MongoDB collections used by the app and, when the database
 * is empty, seeds a small realistic demo dataset so every major feature
 * (profiles, events, jobs, donations, stories, groups, messaging) can be
 * exercised immediately.
 *
 * Usage:
 *   npm run seed
 *
 * The seed is idempotent: if any user already exists, seeding is skipped.
 *
 * Demo login (after seeding):
 *   admin@alumni.com  / Demo@1234   (admin)
 *   aarav.sharma@alumni.dev / Demo@1234
 *   sneha.verma@alumni.dev  / Demo@1234
 * Override the demo password with the DEMO_PASSWORD environment variable.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../models/User');
const Event = require('../models/Event');
const Job = require('../models/Job');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Campaign = require('../models/Campaign');
const Donation = require('../models/Donation');
const Group = require('../models/Group');
const ForumPost = require('../models/ForumPost');
const Story = require('../models/Story');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/alumni-website';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo@1234';

const COLLECTIONS = [
  User, Event, Job, Conversation, Message,
  Campaign, Donation, Group, ForumPost, Story
];

async function createCollections() {
  const existing = await mongoose.connection.db.listCollections().toArray();
  const existingNames = new Set(existing.map(c => c.name));

  for (const model of COLLECTIONS) {
    const name = model.collection.collectionName;
    if (!existingNames.has(name)) {
      await model.createCollection();
      console.log(`Created collection: ${name}`);
    } else {
      console.log(`Collection already exists: ${name}`);
    }
  }
}

async function seed() {
  const userCount = await User.countDocuments();
  if (userCount > 0) {
    console.log(`Database already contains ${userCount} users - skipping seed.`);
    return;
  }

  console.log('Empty database detected - seeding demo data...');

  // ---------- Users ----------
  const admin = await User.create({
    name: 'Super Admin',
    email: 'admin@alumni.com',
    password: DEMO_PASSWORD,
    role: 'admin',
    isActive: true,
    emailVerified: true,
    profile: {
      title: 'Alumni Relations Officer',
      company: 'Patel Group of Institutions',
      location: 'Bhopal, Madhya Pradesh',
      department: 'Administration',
      degree: 'MBA',
      graduationYear: 2005,
      bio: 'Coordinating the alumni network, events and mentorship programs.',
      verificationBadge: true
    }
  });

  const aarav = await User.create({
    name: 'Aarav Sharma',
    email: 'aarav.sharma@alumni.dev',
    password: DEMO_PASSWORD,
    role: 'alumni',
    isActive: true,
    emailVerified: true,
    profile: {
      title: 'Senior Software Engineer',
      company: 'Infosys',
      location: 'Bengaluru, Karnataka',
      phone: '+91 9820011234',
      graduationYear: 2018,
      department: 'Computer Science & Engineering',
      degree: 'B.Tech',
      bio: 'B.Tech in Computer Science (2018). Building distributed systems at Infosys and mentoring juniors from campus.',
      linkedin: 'https://linkedin.com/in/aarav-sharma-demo',
      github: 'https://github.com/aarav-sharma-demo',
      seeking: ['Networking', 'Mentorship'],
      skills: [
        { name: 'JavaScript', level: 'Expert', endorsements: [] },
        { name: 'Node.js', level: 'Expert', endorsements: [] },
        { name: 'Cloud Architecture', level: 'Intermediate', endorsements: [] }
      ],
      workHistory: [{
        company: 'Infosys',
        position: 'Senior Software Engineer',
        employmentType: 'Full-time',
        startDate: new Date('2021-06-01'),
        current: true,
        description: 'Leading a team of 5 on a logistics platform serving 2M+ monthly users.'
      }],
      education: [{
        institution: 'Patel Group of Institutions',
        degree: 'B.Tech',
        fieldOfStudy: 'Computer Science & Engineering',
        graduationYear: 2018,
        achievements: ['Department topper 2016-17', 'Smart India Hackathon finalist']
      }],
      verificationBadge: true
    }
  });

  const sneha = await User.create({
    name: 'Sneha Verma',
    email: 'sneha.verma@alumni.dev',
    password: DEMO_PASSWORD,
    role: 'alumni',
    isActive: true,
    emailVerified: true,
    profile: {
      title: 'Product Manager',
      company: 'Zomato',
      location: 'Gurugram, Haryana',
      phone: '+91 9910022345',
      graduationYear: 2019,
      department: 'Electronics & Communication',
      degree: 'B.Tech',
      bio: 'ECE graduate turned product manager. Love building consumer products and giving back to the campus community.',
      linkedin: 'https://linkedin.com/in/sneha-verma-demo',
      seeking: ['Job Opportunities', 'Collaboration'],
      skills: [
        { name: 'Product Strategy', level: 'Expert', endorsements: [] },
        { name: 'Data Analysis', level: 'Intermediate', endorsements: [] }
      ],
      workHistory: [{
        company: 'Zomato',
        position: 'Product Manager',
        employmentType: 'Full-time',
        startDate: new Date('2022-03-01'),
        current: true,
        description: 'Own the delivery-partner experience used by 300k+ partners.'
      }],
      education: [{
        institution: 'Patel Group of Institutions',
        degree: 'B.Tech',
        fieldOfStudy: 'Electronics & Communication',
        graduationYear: 2019
      }]
    }
  });

  const rahul = await User.create({
    name: 'Rahul Patel',
    email: 'rahul.patel@alumni.dev',
    password: DEMO_PASSWORD,
    role: 'student',
    isActive: true,
    emailVerified: true,
    profile: {
      title: 'Final Year Student',
      location: 'Bhopal, Madhya Pradesh',
      graduationYear: 2026,
      department: 'Computer Science & Engineering',
      degree: 'B.Tech',
      bio: 'Final-year CSE student looking for mentorship in software engineering.',
      seeking: ['Mentorship', 'Job Opportunities'],
      skills: [{ name: 'Python', level: 'Intermediate', endorsements: [] }]
    }
  });

  // Additional directory alumni (varied companies, locations, years, departments)
  const moreAlumni = [
    {
      name: 'Priya Sharma',
      email: 'priya.sharma@alumni.dev',
      role: 'alumni',
      profile: {
        title: 'Software Engineer',
        company: 'Google',
        location: 'Bengaluru, Karnataka',
        graduationYear: 2020,
        department: 'Computer Science & Engineering',
        degree: 'B.Tech',
        bio: 'Working on search infrastructure. Happy to refer alumni for engineering roles.',
        linkedin: 'https://linkedin.com/in/priya-sharma-demo',
        skills: [
          { name: 'Java', level: 'Expert', endorsements: [] },
          { name: 'React', level: 'Intermediate', endorsements: [] },
          { name: 'AWS', level: 'Intermediate', endorsements: [] }
        ]
      }
    },
    {
      name: 'Arjun Mehta',
      email: 'arjun.mehta@alumni.dev',
      role: 'alumni',
      profile: {
        title: 'Data Scientist',
        company: 'Flipkart',
        location: 'Bengaluru, Karnataka',
        graduationYear: 2017,
        department: 'Information Technology',
        degree: 'B.Tech',
        bio: 'Recommendation systems and demand forecasting at scale.',
        linkedin: 'https://linkedin.com/in/arjun-mehta-demo',
        skills: [
          { name: 'Python', level: 'Expert', endorsements: [] },
          { name: 'Machine Learning', level: 'Expert', endorsements: [] },
          { name: 'SQL', level: 'Intermediate', endorsements: [] }
        ]
      }
    },
    {
      name: 'Neha Gupta',
      email: 'neha.gupta@alumni.dev',
      role: 'alumni',
      profile: {
        title: 'Civil Engineer (Assistant Manager)',
        company: 'L&T Construction',
        location: 'Mumbai, Maharashtra',
        graduationYear: 2015,
        department: 'Civil Engineering',
        degree: 'B.Tech',
        bio: 'Site management for metro rail projects across Maharashtra.',
        linkedin: 'https://linkedin.com/in/neha-gupta-demo',
        skills: [
          { name: 'AutoCAD', level: 'Expert', endorsements: [] },
          { name: 'Project Management', level: 'Intermediate', endorsements: [] }
        ]
      }
    },
    {
      name: 'Vikram Singh Rathore',
      email: 'vikram.rathore@alumni.dev',
      role: 'alumni',
      profile: {
        title: 'Founder & CEO',
        company: 'Bhopal Bytes',
        location: 'Bhopal, Madhya Pradesh',
        graduationYear: 2013,
        department: 'Mechanical Engineering',
        degree: 'B.Tech',
        bio: 'Run a product studio in Bhopal employing 20 people, mostly campus graduates. Always open to collaboration.',
        linkedin: 'https://linkedin.com/in/vikram-rathore-demo',
        seeking: ['Collaboration', 'Networking'],
        skills: [
          { name: 'Entrepreneurship', level: 'Expert', endorsements: [] },
          { name: 'Product Strategy', level: 'Intermediate', endorsements: [] }
        ]
      }
    },
    {
      name: 'Ananya Iyer',
      email: 'ananya.iyer@alumni.dev',
      role: 'alumni',
      profile: {
        title: 'HR Business Partner',
        company: 'Tata Consultancy Services',
        location: 'Pune, Maharashtra',
        graduationYear: 2016,
        department: 'Business Administration',
        degree: 'MBA',
        bio: 'Recruiting for TCS digital across India. Reach out for resume reviews and referrals.',
        linkedin: 'https://linkedin.com/in/ananya-iyer-demo',
        seeking: ['Networking'],
        skills: [
          { name: 'Recruitment', level: 'Expert', endorsements: [] },
          { name: 'People Operations', level: 'Intermediate', endorsements: [] }
        ]
      }
    },
    {
      name: 'Karan Malhotra',
      email: 'karan.malhotra@alumni.dev',
      role: 'alumni',
      profile: {
        title: 'Embedded Systems Engineer',
        company: 'Bosch',
        location: 'Hyderabad, Telangana',
        graduationYear: 2019,
        department: 'Electronics & Communication',
        degree: 'B.Tech',
        bio: 'Automotive embedded software - ECU firmware and testing.',
        linkedin: 'https://linkedin.com/in/karan-malhotra-demo',
        skills: [
          { name: 'C++', level: 'Expert', endorsements: [] },
          { name: 'Embedded C', level: 'Expert', endorsements: [] }
        ]
      }
    }
  ];

  for (const alum of moreAlumni) {
    await User.create({
      ...alum,
      password: DEMO_PASSWORD,
      isActive: true,
      emailVerified: true
    });
  }

  // ---------- Events ----------
  const now = new Date();
  const upcoming = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
  const upcomingEnd = new Date(upcoming.getTime() + 4 * 60 * 60 * 1000);
  const past = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);

  await Event.create({
    title: 'Annual Alumni Meet 2026',
    description: 'Join fellow graduates for the annual homecoming: campus tour, panel discussion with distinguished alumni, dinner and networking. Bring your batchmates along!',
    type: 'reunion',
    category: 'social',
    startDate: upcoming,
    endDate: upcomingEnd,
    location: { venue: 'PGOI Main Auditorium', address: 'Ratibad', city: 'Bhopal', state: 'Madhya Pradesh', country: 'India' },
    maxAttendees: 300,
    registrationRequired: true,
    registrationDeadline: new Date(upcoming.getTime() - 3 * 24 * 60 * 60 * 1000),
    price: 0,
    currency: 'INR',
    organizer: admin._id,
    tags: ['homecoming', 'networking'],
    speakers: [
      { name: 'Aarav Sharma', title: 'Senior Software Engineer', company: 'Infosys' },
      { name: 'Sneha Verma', title: 'Product Manager', company: 'Zomato' }
    ],
    status: 'published',
    featured: true
  });

  await Event.create({
    title: 'Resume & Interview Prep Workshop',
    description: 'Alumni from product and engineering roles review your resume and run mock interviews. Limited seats - register early.',
    type: 'workshop',
    category: 'career',
    startDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    endDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000),
    location: { city: 'Bhopal', state: 'Madhya Pradesh', country: 'India' },
    isVirtual: true,
    virtualLink: 'https://meet.google.com/demo-alumni-workshop',
    maxAttendees: 50,
    registrationRequired: true,
    price: 0,
    currency: 'INR',
    organizer: admin._id,
    tags: ['career', 'mentorship'],
    status: 'published'
  });

  await Event.create({
    title: 'Tech Talk: Careers in AI & Data',
    description: 'Alumni working in AI/ML share how they moved from campus to careers in data science and machine learning.',
    type: 'seminar',
    category: 'technology',
    startDate: past,
    endDate: new Date(past.getTime() + 2 * 60 * 60 * 1000),
    location: { venue: 'Seminar Hall B', city: 'Bhopal', state: 'Madhya Pradesh', country: 'India' },
    maxAttendees: 120,
    registrationRequired: true,
    price: 0,
    currency: 'INR',
    organizer: admin._id,
    tags: ['ai', 'careers'],
    attendees: [
      { user: aarav._id, registeredAt: past, status: 'attended' },
      { user: sneha._id, registeredAt: past, status: 'attended' }
    ],
    status: 'completed'
  });

  // ---------- Jobs ----------
  const job1 = await Job.create({
    title: 'Backend Engineer (Node.js)',
    company: { name: 'Infosys', location: { city: 'Bengaluru', state: 'Karnataka', country: 'India' }, industry: 'IT Services', size: 'enterprise' },
    description: 'Join the logistics platform team building high-throughput Node.js services. You will design APIs, own services end to end and mentor junior engineers.',
    requirements: '2+ years with Node.js, strong grasp of REST and SQL/NoSQL databases, exposure to cloud deployment (AWS/GCP).',
    responsibilities: 'Design and ship backend services, participate in code reviews, collaborate with product managers.',
    type: 'full-time',
    experience: { minimum: 2, level: 'mid' },
    salary: { min: 1200000, max: 1800000, currency: 'INR', period: 'yearly' },
    skills: { required: ['Node.js', 'REST APIs'], preferred: ['AWS', 'Docker'] },
    postedBy: aarav._id,
    deadline: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    isFeatured: true
  });

  const job2 = await Job.create({
    title: 'Associate Product Manager',
    company: { name: 'Zomato', location: { city: 'Gurugram', state: 'Haryana', country: 'India' }, industry: 'Consumer Tech', size: 'large' },
    description: 'Work with the delivery-partner team to improve the experience of 300k+ partners. Heavy focus on data-driven decisions and experimentation.',
    requirements: '1-3 years in product/analytics roles, strong SQL and communication skills, bias for action.',
    responsibilities: 'Own feature funnels end to end, run A/B tests, partner with design and engineering.',
    type: 'full-time',
    experience: { minimum: 1, maximum: 3, level: 'entry' },
    salary: { min: 1400000, max: 2000000, currency: 'INR', period: 'yearly' },
    skills: { required: ['Product Management', 'SQL'], preferred: ['A/B Testing'] },
    postedBy: sneha._id,
    deadline: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000)
  });

  await Job.create({
    title: 'Full Stack Developer Intern',
    company: { name: 'Freshworks', location: { city: 'Chennai', state: 'Tamil Nadu', country: 'India' }, industry: 'SaaS', size: 'large' },
    description: 'Six-month internship building features across our CRM product with React and Node.js. Strong mentorship and pre-placement offer potential.',
    requirements: 'Final-year student, solid JavaScript fundamentals, familiarity with React or Node.js.',
    type: 'internship',
    experience: { minimum: 0, level: 'entry' },
    salary: { min: 40000, currency: 'INR', period: 'monthly' },
    skills: { required: ['JavaScript'], preferred: ['React', 'Node.js'] },
    postedBy: admin._id,
    deadline: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  });

  await Job.findByIdAndUpdate(job1._id, {
    $push: {
      applications: {
        applicant: rahul._id,
        status: 'pending',
        coverLetter: 'As a final-year CSE student with two Node.js projects (a campus event portal and a chat app), I would love to join the logistics platform team.',
        resume: 'https://drive.google.com/file/d/demo-rahul-resume/view'
      }
    },
    $inc: { views: 42 }
  });

  // ---------- Donation campaign ----------
  const campaign = await Campaign.create({
    title: 'Library Modernization Fund',
    description: 'Help us modernize the central library with new computers, e-journal subscriptions and a digital catalog for 5000+ students.',
    goalAmount: 500000,
    currentAmount: 125000,
    endDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
    category: 'infrastructure',
    status: 'active',
    isFeatured: true,
    createdBy: admin._id
  });

  await Donation.create({
    donor: aarav._id,
    campaign: campaign._id,
    amount: 25000,
    currency: 'INR',
    paymentStatus: 'completed',
    paymentMethod: 'card',
    message: 'The library was my second home on campus. Happy to give back!',
    isAnonymous: false
  });

  await Donation.create({
    donor: sneha._id,
    campaign: campaign._id,
    amount: 100000,
    currency: 'INR',
    paymentStatus: 'completed',
    paymentMethod: 'bank_transfer',
    isAnonymous: true
  });

  // ---------- Groups & forum ----------
  const group = await Group.create({
    name: 'CSE Alumni Network',
    description: 'Computer Science graduates from all batches - job referrals, interview prep and tech discussions.',
    category: 'department',
    members: [
      { user: aarav._id, role: 'admin' },
      { user: sneha._id, role: 'member' },
      { user: rahul._id, role: 'member' }
    ],
    isPrivate: false,
    createdBy: aarav._id
  });

  await ForumPost.create({
    group: group._id,
    author: aarav._id,
    title: 'Referral thread - September 2026',
    content: 'Post your resume and target companies below. Several alumni across Infosys, Walmart and Adobe have agreed to refer strong candidates this month.',
    isPinned: true
  });

  await ForumPost.create({
    group: group._id,
    author: sneha._id,
    title: 'AMA: Moving from engineering to product management',
    content: 'I switched from an ECE service-company job to product management at Zomato in two years. Ask me anything about the transition, interviews or the day-to-day job.',
    isPinned: false
  });

  // ---------- Stories ----------
  await Story.create({
    title: 'From Campus Labs to Cloud Architecture',
    content: 'I joined PGOI in 2014 with zero coding experience. The turning point was the college coding club, where seniors ran weekend sessions on web development. By third year I had built the department event portal, and that project got me my first internship. After graduating in 2018 I joined a service company, moved into a product engineering team, and today I design cloud systems handling millions of requests a day. My advice: build real projects early, contribute to open source, and never underestimate the alumni network - my second job came through a senior from this very college.',
    excerpt: 'How the campus coding club and the alumni network shaped my journey from a novice first-year student to a cloud architect.',
    author: aarav._id,
    category: 'Career',
    tags: ['cloud', 'career-growth'],
    isPublished: true,
    isFeatured: true,
    views: 128
  });

  await Story.create({
    title: 'Switching to Product Management: My Two-Year Plan',
    content: 'Graduating from ECE in 2019, I started in a service company support role. I wanted to build products, not just maintain them. I spent evenings learning SQL and analytics, volunteered for every internal tool project, and documented three case studies of features I improved. Those case studies landed me an APM interview, and I have been a product manager at a consumer tech company since 2022. The lesson: you do not need permission to start doing the job you want - start doing fragments of it where you are.',
    excerpt: 'An ECE graduate explains the exact steps that took her from a support role to product management at a consumer tech company.',
    author: sneha._id,
    category: 'Personal Growth',
    tags: ['product-management', 'career-switch'],
    isPublished: true,
    views: 86
  });

  // ---------- Messaging ----------
  const conversation = await Conversation.create({
    participants: [rahul._id, aarav._id]
  });

  await Message.create({
    conversationId: conversation._id,
    sender: rahul._id,
    recipient: aarav._id,
    content: 'Hi Aarav! I am in my final year at PGOI and saw your referral post in the CSE group. Could I ask you a couple of questions about backend roles?'
  });

  await Message.create({
    conversationId: conversation._id,
    sender: aarav._id,
    recipient: rahul._id,
    content: 'Hi Rahul, sure! Ask away - and do share your resume, I will take a look this weekend.'
  });

  console.log('Seed complete:');
  console.log(`  Users: admin@alumni.com, aarav.sharma@alumni.dev, sneha.verma@alumni.dev, rahul.patel@alumni.dev (password: ${DEMO_PASSWORD})`);
  console.log('  Events: 2 published (1 upcoming, 1 workshop), 1 completed');
  console.log('  Jobs: 3 published (1 with application)');
  console.log('  Donations: 1 active campaign with 2 donations');
  console.log('  Groups: 1 group with 2 forum posts');
  console.log('  Stories: 2 published');
  console.log('  Messaging: 1 conversation with 2 messages');
}

async function init() {
  console.log('Connecting to MongoDB:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);

  try {
    await createCollections();
    await seed();

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\nCollections in database:');
    collections.forEach(c => console.log(' -', c.name));
  } catch (err) {
    console.error('Initialization error:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

init();
