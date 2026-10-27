import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { isUsingMemoryStore } from '../config/db.js';

// --- Mongoose Schema Definition ---
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long']
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        'Please provide a valid email address'
      ]
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters long']
    },
    role: {
      type: String,
      enum: {
        values: ['user', 'admin'],
        message: 'Role must be either "user" or "admin"'
      },
      default: 'user'
    }
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.password; // Never expose password hash in JSON output
        return ret;
      }
    }
  }
);

// Pre-save Hook: Secure Password Hashing with bcrypt
userSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    const saltRounds = 10;
    const salt = await bcrypt.genSalt(saltRounds);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance Method: Secure Password Comparison
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Compile Mongoose Model
let MongooseUserModel;
try {
  MongooseUserModel = mongoose.model('User');
} catch {
  MongooseUserModel = mongoose.model('User', userSchema);
}

// --- In-Memory Store Adapter for resilient offline testing and execution ---
class InMemoryUserStore {
  constructor() {
    this.users = [];
  }

  _toUserDoc(data) {
    if (!data) return null;
    const doc = {
      ...data,
      _id: data.id || data._id,
      id: data.id || data._id,
      async comparePassword(candidatePassword) {
        return bcrypt.compare(candidatePassword, data.password);
      },
      toSafeObject() {
        const { password, ...safe } = doc;
        return safe;
      },
      toJSON() {
        const { password, ...safe } = doc;
        return safe;
      }
    };
    return doc;
  }

  async findOne(query = {}) {
    let match = null;
    if (query.email) {
      const targetEmail = query.email.toLowerCase().trim();
      match = this.users.find((u) => u.email.toLowerCase() === targetEmail);
    } else if (query._id || query.id) {
      const targetId = String(query._id || query.id);
      match = this.users.find((u) => String(u.id) === targetId);
    }
    return match ? this._toUserDoc(match) : null;
  }

  async findById(id) {
    const targetId = String(id);
    const match = this.users.find((u) => String(u.id) === targetId);
    return match ? this._toUserDoc(match) : null;
  }

  async find(query = {}) {
    let result = [...this.users];
    if (query.role) {
      result = result.filter((u) => u.role === query.role);
    }
    return {
      select: () => result.map((u) => this._toUserDoc(u)),
      sort: () => result.map((u) => this._toUserDoc(u)),
      then: (resolve) => resolve(result.map((u) => this._toUserDoc(u)))
    };
  }

  async create(userData) {
    const normalizedEmail = userData.email.toLowerCase().trim();
    const existing = await this.findOne({ email: normalizedEmail });
    if (existing) {
      const error = new Error('Duplicate key: email already registered');
      error.code = 11000;
      throw error;
    }

    // Apply bcrypt hashing if not already hashed
    let hashedPassword = userData.password;
    if (!hashedPassword.startsWith('$2a$') && !hashedPassword.startsWith('$2b$')) {
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(userData.password, salt);
    }

    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      name: userData.name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: userData.role || 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.users.push(newUser);
    return this._toUserDoc(newUser);
  }

  async findByIdAndUpdate(id, update) {
    const userIndex = this.users.findIndex((u) => String(u.id) === String(id));
    if (userIndex === -1) return null;

    const fieldsToUpdate = update.$set ? update.$set : update;
    this.users[userIndex] = {
      ...this.users[userIndex],
      ...fieldsToUpdate,
      updatedAt: new Date().toISOString()
    };
    return this._toUserDoc(this.users[userIndex]);
  }

  async findByIdAndDelete(id) {
    const userIndex = this.users.findIndex((u) => String(u.id) === String(id));
    if (userIndex === -1) return null;
    const deleted = this.users.splice(userIndex, 1)[0];
    return this._toUserDoc(deleted);
  }

  async countDocuments() {
    return this.users.length;
  }

  async deleteMany() {
    const count = this.users.length;
    this.users = [];
    return { deletedCount: count };
  }
}

const memoryStore = new InMemoryUserStore();

// Dynamic User proxy to automatically route calls to Mongoose or MemoryStore
const User = new Proxy(MongooseUserModel, {
  get(target, prop) {
    if (isUsingMemoryStore()) {
      if (typeof memoryStore[prop] === 'function') {
        return memoryStore[prop].bind(memoryStore);
      }
      return memoryStore[prop];
    }
    return target[prop];
  }
});

export default User;
