import { handleLinksSocket } from "./handleLinksSocket.js";
import { handleMessageSocket } from "./handleMessagesSocket.js";

export default async function handleSocketsIndex(socket, io) {
  handleLinksSocket(socket, io);
  handleMessageSocket(socket, io);
}