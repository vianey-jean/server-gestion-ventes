
const fs = require('fs');
const path = require('path');

class Message {
  constructor() {
    this.dbPath = path.join(__dirname, '../db/messages.json');
    this.ensureFileExists();
  }

  ensureFileExists() {
    if (!fs.existsSync(this.dbPath)) {
      fs.writeFileSync(this.dbPath, JSON.stringify([], null, 2));
    }
  }

  getAll() {
    try {
      const data = fs.readFileSync(this.dbPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading messages:', error);
      return [];
    }
  }

  getByUserId(userId) {
    const messages = this.getAll();
    return messages.filter(message => message.destinataireId === userId);
  }

  getUnreadCount(userId) {
    const messages = this.getByUserId(userId);
    return messages.filter(message => !message.lu).length;
  }

  create(messageData) {
    const messages = this.getAll();
    const newMessage = {
      id: Date.now().toString(),
      expediteurNom: messageData.expediteurNom,
      expediteurEmail: messageData.expediteurEmail,
      expediteurTelephone: messageData.expediteurTelephone || '',
      sujet: messageData.sujet,
      contenu: messageData.contenu,
      destinataireId: messageData.destinataireId,
      dateEnvoi: new Date().toISOString(),
      lu: false
    };

    messages.push(newMessage);
    this.saveAll(messages);
    return newMessage;
  }

  markAsRead(messageId, userId) {
    const messages = this.getAll();
    const messageIndex = messages.findIndex(
      msg => msg.id === messageId && msg.destinataireId === userId
    );

    if (messageIndex !== -1) {
      messages[messageIndex].lu = true;
      this.saveAll(messages);
      return messages[messageIndex];
    }
    return null;
  }

  markAsUnread(messageId, userId) {
    const messages = this.getAll();
    const messageIndex = messages.findIndex(
      msg => msg.id === messageId && msg.destinataireId === userId
    );

    if (messageIndex !== -1) {
      messages[messageIndex].lu = false;
      this.saveAll(messages);
      return messages[messageIndex];
    }
    return null;
  }

  delete(messageId, userId) {
    const messages = this.getAll();
    const filteredMessages = messages.filter(
      msg => !(msg.id === messageId && msg.destinataireId === userId)
    );

    if (filteredMessages.length !== messages.length) {
      this.saveAll(filteredMessages);
      return true;
    }
    return false;
  }

  saveAll(messages) {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(messages, null, 2));
    } catch (error) {
      console.error('Error saving messages:', error);
      throw error;
    }
  }
}

module.exports = new Message();
