import { handleLinksSocket } from "./handleLinksSocket.js";

export default function handleSocketsIndex(socket, io) {
  handleLinksSocket(socket, io);
}