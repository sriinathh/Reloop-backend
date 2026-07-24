import { Server as SocketServer } from 'socket.io';
let io;
export const initSocket = (server) => {
    io = new SocketServer(server, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });
    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id}`);
        // Partners and Admins can join specific rooms to receive filtered events
        socket.on('joinPartnerRoom', (partnerId) => {
            socket.join(`partner_${partnerId}`);
            console.log(`Socket ${socket.id} joined room partner_${partnerId}`);
        });
        socket.on('joinAdminRoom', () => {
            socket.join('admin_room');
        });
        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });
    return io;
};
export const getSocketIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};
