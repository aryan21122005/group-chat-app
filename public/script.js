document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const authScreen = document.getElementById('auth-screen');
    const chatScreen = document.getElementById('chat-screen');
    const createGroupBtn = document.getElementById('create-group-btn');
    const joinGroupBtn = document.getElementById('join-group-btn');
    const createGroupForm = document.getElementById('create-group-form');
    const joinGroupForm = document.getElementById('join-group-form');
    const groupNameInput = document.getElementById('create-group-name');
    const passwordContainer = document.getElementById('password-container');
    const groupPasswordInput = document.getElementById('group-password');
    const createUsernameInput = document.getElementById('create-username');
    const createSubmitBtn = document.getElementById('create-submit');
    const joinUsernameInput = document.getElementById('join-username');
    const joinSubmitBtn = document.getElementById('join-submit');
    const publicGroupsList = document.getElementById('public-groups-list');
    const privateGroupJoin = document.getElementById('private-group-join');
    const privateGroupIdInput = document.getElementById('private-group-id');
    const privateGroupPasswordInput = document.getElementById('private-group-password');
    const groupNameDisplay = document.getElementById('group-name');
    const chatMessages = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const membersList = document.getElementById('members-list');
    const typingIndicator = document.getElementById('typing-indicator');

    let currentGroupId = null;
    let currentUsername = null;

    // Show create group form
    createGroupBtn.addEventListener('click', () => {
        createGroupForm.classList.remove('hidden');
        joinGroupForm.classList.add('hidden');
    });

    // Show join group form
    joinGroupBtn.addEventListener('click', () => {
        joinGroupForm.classList.remove('hidden');
        createGroupForm.classList.add('hidden');
        socket.emit('list-public-groups');
    });

    // Toggle password field for private groups
    document.querySelectorAll('input[name="group-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'private') {
                passwordContainer.classList.remove('hidden');
            } else {
                passwordContainer.classList.add('hidden');
            }
        });
    });

    // Toggle between public and private join options
    document.querySelectorAll('input[name="join-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'public') {
                privateGroupJoin.classList.add('hidden');
                socket.emit('list-public-groups');
            } else {
                privateGroupJoin.classList.remove('hidden');
            }
        });
    });

    // Create group submission
    createSubmitBtn.addEventListener('click', () => {
        const groupName = groupNameInput.value.trim();
        const username = createUsernameInput.value.trim();
        const isPrivate = document.querySelector('input[name="group-type"]:checked').value === 'private';
        const password = isPrivate ? groupPasswordInput.value.trim() : null;

        if (!groupName || !username) {
            alert('Please fill in all fields');
            return;
        }

        if (isPrivate && !password) {
            alert('Please enter a password for private group');
            return;
        }

        currentUsername = username;
        socket.emit('create-group', { groupName, isPrivate, password, username });
    });

    // Join group submission
    joinSubmitBtn.addEventListener('click', () => {
        const joinType = document.querySelector('input[name="join-type"]:checked').value;
        const username = joinUsernameInput.value.trim();

        if (!username) {
            alert('Please enter your name');
            return;
        }

        currentUsername = username;

        if (joinType === 'public') {
            // Public group joining is handled by clicking on group in list
            alert('Please select a group from the list');
        } else {
            const groupId = privateGroupIdInput.value.trim();
            const password = privateGroupPasswordInput.value.trim();

            if (!groupId) {
                alert('Please enter group ID');
                return;
            }

            socket.emit('join-group', { groupId, password, username });
        }
    });

    // Handle clicking on public group
    publicGroupsList.addEventListener('click', (e) => {
        if (e.target.tagName === 'LI') {
            const groupId = e.target.dataset.groupId;
            const username = joinUsernameInput.value.trim();

            if (!username) {
                alert('Please enter your name first');
                return;
            }

            currentUsername = username;
            socket.emit('join-group', { groupId, password: null, username });
        }
    });

    // Send message
    function sendMessage() {
        const message = messageInput.value.trim();
        if (message && currentGroupId) {
            socket.emit('send-message', { groupId: currentGroupId, message });
            messageInput.value = '';
        }
    }

    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Typing indicators
    messageInput.addEventListener('input', () => {
        if (currentGroupId) {
            if (messageInput.value.trim()) {
                socket.emit('typing', currentGroupId);
            } else {
                socket.emit('stop-typing', currentGroupId);
            }
        }
    });

    // Socket event handlers
    socket.on('group-created', ({ groupId, groupName }) => {
        currentGroupId = groupId;
        groupNameDisplay.textContent = groupName;
        authScreen.classList.add('hidden');
        chatScreen.classList.remove('hidden');
        updateMembersList([currentUsername]);
    });

    socket.on('group-joined', ({ groupId, groupName, members, messages }) => {
        currentGroupId = groupId;
        groupNameDisplay.textContent = groupName;
        authScreen.classList.add('hidden');
        chatScreen.classList.remove('hidden');
        
        updateMembersList(members);
        
        // Load previous messages
        chatMessages.innerHTML = '';
        messages.forEach(msg => {
            displayMessage(msg, msg.sender === currentUsername);
        });
    });

    socket.on('error', (message) => {
        alert(message);
    });

    socket.on('public-groups', (groups) => {
        publicGroupsList.innerHTML = '';
        groups.forEach(group => {
            const li = document.createElement('li');
            li.textContent = group.name;
            li.dataset.groupId = group.id;
            publicGroupsList.appendChild(li);
        });
    });

    socket.on('new-message', (message) => {
        displayMessage(message, message.sender === currentUsername);
    });

    socket.on('user-joined', (username) => {
        displayNotification(`${username} joined the group`);
    });

    socket.on('user-left', (username) => {
        displayNotification(`${username} left the group`);
    });

    socket.on('update-members', (members) => {
        updateMembersList(members);
    });

    socket.on('typing', (username) => {
        typingIndicator.textContent = `${username} is typing...`;
    });

    socket.on('stop-typing', () => {
        typingIndicator.textContent = '';
    });

    // Helper functions
    function displayMessage(message, isCurrentUser) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        if (isCurrentUser) {
            messageElement.classList.add('sent');
        }
        
        const senderElement = document.createElement('div');
        senderElement.classList.add('sender');
        senderElement.textContent = message.sender;
        
        const textElement = document.createElement('div');
        textElement.textContent = message.text;
        
        const timestampElement = document.createElement('div');
        timestampElement.classList.add('timestamp');
        timestampElement.textContent = new Date(message.timestamp).toLocaleTimeString();
        
        messageElement.appendChild(senderElement);
        messageElement.appendChild(textElement);
        messageElement.appendChild(timestampElement);
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function displayNotification(text) {
        const notificationElement = document.createElement('div');
        notificationElement.classList.add('notification');
        notificationElement.textContent = text;
        chatMessages.appendChild(notificationElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function updateMembersList(members) {
        membersList.innerHTML = '';
        members.forEach(member => {
            const li = document.createElement('li');
            li.textContent = member;
            membersList.appendChild(li);
        });
    }
});