const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Store groups and their data
const groups = {};

// Socket.io connection
io.on('connection', (socket) => {
    console.log('New user connected');

    // Handle group creation
    socket.on('create-group', ({ groupName, isPrivate, password, username }) => {
        const groupId = generateId();
        groups[groupId] = {
            name: groupName,
            isPrivate,
            password,
            members: [username],
            messages: []
        };

        socket.join(groupId);
        socket.emit('group-created', { groupId, groupName, isPrivate });
        console.log(`Group created: ${groupName} (${groupId})`);
    });

    // Handle joining a group
    socket.on('join-group', ({ groupId, password, username }) => {
        const group = groups[groupId];
        if (!group) {
            socket.emit('error', 'Group not found');
            return;
        }

        if (group.isPrivate && group.password !== password) {
            socket.emit('error', 'Incorrect password');
            return;
        }

        if (!group.members.includes(username)) {
            group.members.push(username);
        }

        socket.join(groupId);
        socket.emit('group-joined', {
            groupId,
            groupName: group.name,
            isPrivate: group.isPrivate,
            members: group.members,
            messages: group.messages
        });

        socket.to(groupId).emit('user-joined', username);
        io.to(groupId).emit('update-members', group.members);
        console.log(`${username} joined ${group.name}`);
    });

    // Handle sending messages
    socket.on('send-message', ({ groupId, message }) => {
        const group = groups[groupId];
        if (!group) return;

        const msg = {
            sender: socket.username,
            text: message,
            timestamp: new Date().toISOString()
        };

        group.messages.push(msg);
        io.to(groupId).emit('new-message', msg);
    });

    // Handle typing indicators
    socket.on('typing', (groupId) => {
        socket.to(groupId).emit('typing', socket.username);
    });

    socket.on('stop-typing', (groupId) => {
        socket.to(groupId).emit('stop-typing');
    });

    // Handle leaving a group
    socket.on('leave-group', (groupId) => {
        const group = groups[groupId];
        if (!group) return;

        socket.leave(groupId);
        if (socket.username && group.members.includes(socket.username)) {
            group.members = group.members.filter(member => member !== socket.username);
            socket.to(groupId).emit('user-left', socket.username);
            io.to(groupId).emit('update-members', group.members);
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });

    // List public groups
    socket.on('list-public-groups', () => {
        const publicGroups = Object.entries(groups)
            .filter(([id, group]) => !group.isPrivate)
            .map(([id, group]) => ({
                id,
                name: group.name,
                memberCount: group.members.length,
                messageCount: group.messages.length
            }));
        socket.emit('public-groups', publicGroups);
    });
});

// Helper function to generate random ID
function generateId() {
    return Math.random().toString(36).substring(2, 8);
}

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});