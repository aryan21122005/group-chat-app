const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

// Store groups and users
const groups = {};
const users = {};

io.on('connection', (socket) => {
    console.log('New user connected:', socket.id);

    // Create a new group
    socket.on('create-group', ({ groupName, isPrivate, password, username }) => {
        const groupId = uuidv4();
        groups[groupId] = {
            name: groupName,
            isPrivate,
            password,
            members: {},
            messages: []
        };

        // Join the group
        joinGroup(socket, groupId, username);
        socket.emit('group-created', { groupId, groupName });
    });

    // Join an existing group
    socket.on('join-group', ({ groupId, password, username }) => {
        const group = groups[groupId];
        
        if (!group) {
            return socket.emit('error', 'Group does not exist');
        }

        if (group.isPrivate && group.password !== password) {
            return socket.emit('error', 'Incorrect password');
        }

        joinGroup(socket, groupId, username);
    });

    // Handle group joining logic
    function joinGroup(socket, groupId, username) {
        const group = groups[groupId];
        
        // Add user to group
        group.members[socket.id] = username;
        users[socket.id] = { username, groupId };

        // Join the room
        socket.join(groupId);

        // Notify group
        socket.to(groupId).emit('user-joined', username);
        io.to(groupId).emit('update-members', Object.values(group.members));

        // Send group info to the new member
        socket.emit('group-joined', {
            groupId,
            groupName: group.name,
            members: Object.values(group.members),
            messages: group.messages
        });
    }

    // Send message to group
    socket.on('send-message', ({ groupId, message }) => {
        const group = groups[groupId];
        const user = users[socket.id];

        if (group && user) {
            const messageData = {
                id: uuidv4(),
                sender: user.username,
                text: message,
                timestamp: new Date().toISOString()
            };

            // Store message
            group.messages.push(messageData);

            // Broadcast to group
            io.to(groupId).emit('new-message', messageData);
        }
    });

    // Typing indicator
    socket.on('typing', (groupId) => {
        const user = users[socket.id];
        if (user) {
            socket.to(groupId).emit('typing', user.username);
        }
    });

    // Stop typing indicator
    socket.on('stop-typing', (groupId) => {
        socket.to(groupId).emit('stop-typing');
    });

    // Disconnect handler
    socket.on('disconnect', () => {
        const user = users[socket.id];
        if (user) {
            const group = groups[user.groupId];
            if (group) {
                delete group.members[socket.id];
                io.to(user.groupId).emit('user-left', user.username);
                io.to(user.groupId).emit('update-members', Object.values(group.members));
            }
            delete users[socket.id];
        }
    });

    // List public groups
    socket.on('list-public-groups', () => {
        const publicGroups = Object.entries(groups)
            .filter(([_, group]) => !group.isPrivate)
            .map(([id, group]) => ({ id, name: group.name }));
        socket.emit('public-groups', publicGroups);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});