// socket.io-client 2.5.0 (the EIO=3 client the Ola server needs) ships no types.
// Only the factory is used; its sockets are typed by the core's SocketLike.
declare module 'socket.io-client' {
  const io: import('@ola/core/chat.ts').IoFactory;
  export default io;
}
