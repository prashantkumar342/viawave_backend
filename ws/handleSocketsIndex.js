import { handleLinksSocket } from "./handleLinksSocket.js";

export default async function handleSocketsIndex(socket, io) {
  handleLinksSocket(socket, io);
}