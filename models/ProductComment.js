const path = require('path');
const { readJsonDecrypted, writeJsonEncrypted } = require('../middleware/encryption');

const commentsPath = path.join(__dirname, '../db/productComments.json');

const readComments = () => {
  const data = readJsonDecrypted(commentsPath);
  return Array.isArray(data) ? data : [];
};

const writeComments = (comments) => {
  writeJsonEncrypted(commentsPath, Array.isArray(comments) ? comments : []);
};

module.exports = {
  getAll() {
    return readComments();
  },

  getByProductId(productId) {
    return readComments().filter(c => c.productId === productId);
  },

  create(data) {
    const comments = readComments();
    const newComment = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      productId: data.productId,
      comment: data.comment,
      rating: Math.min(5, Math.max(1, Number(data.rating) || 5)),
      clientName: data.clientName || '',
      createdAt: new Date().toISOString(),
    };
    comments.push(newComment);
    writeComments(comments);
    return newComment;
  },

  update(id, data) {
    const comments = readComments();
    const idx = comments.findIndex(c => c.id === id);
    if (idx === -1) return null;

    comments[idx] = {
      ...comments[idx],
      comment: data.comment,
      rating: Math.min(5, Math.max(1, Number(data.rating) || comments[idx].rating || 5)),
      clientName: data.clientName || '',
    };

    writeComments(comments);
    return comments[idx];
  },

  delete(id) {
    const comments = readComments();
    const idx = comments.findIndex(c => c.id === id);
    if (idx === -1) return false;
    comments.splice(idx, 1);
    writeComments(comments);
    return true;
  },

  deleteMany(ids) {
    const comments = readComments();
    const idsSet = new Set(ids);
    const filtered = comments.filter(c => !idsSet.has(c.id));
    writeComments(filtered);
    return comments.length - filtered.length;
  },

  deleteByProductId(productId) {
    const comments = readComments();
    const filtered = comments.filter(c => c.productId !== productId);
    writeComments(filtered);
    return comments.length - filtered.length;
  },

  getAverageRating(productId) {
    const comments = readComments().filter(c => c.productId === productId);
    if (comments.length === 0) return { average: 0, count: 0 };
    const sum = comments.reduce((acc, c) => acc + c.rating, 0);
    return { average: Math.round((sum / comments.length) * 10) / 10, count: comments.length };
  },

  getAllRatings() {
    const comments = readComments();
    const map = {};
    comments.forEach(c => {
      if (!map[c.productId]) map[c.productId] = { sum: 0, count: 0, comments: [] };
      map[c.productId].sum += c.rating;
      map[c.productId].count += 1;
      map[c.productId].comments.push(c);
    });
    const result = {};
    Object.keys(map).forEach(pid => {
      result[pid] = {
        average: Math.round((map[pid].sum / map[pid].count) * 10) / 10,
        count: map[pid].count,
        comments: map[pid].comments,
      };
    });
    return result;
  }
};
