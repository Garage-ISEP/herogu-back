import { ConnectedSocket, MessageBody, NspParam, OnConnect, OnDisconnect, OnMessage, SocketController, SocketRequest } from "socket.io-ts-controllers";
import { Socket} from "socket.io";
import { Logger } from "../../Utils/Logger.service";
import dockerService from "../../Services/Docker.service";

@SocketController("/logs/:name")
export class LogsController {

  private readonly _logger = new Logger(this);

  @OnConnect()
  connect(@ConnectedSocket() socket: Socket, @NspParam("name") name: string) {
    this._logger.log("New connexion");
    try {
      dockerService.listenContainerLogs(name, data => this._onLog(socket, data));
    } catch (e) {
      socket.emit("error", 400, "Bad Request");
      socket.disconnect(true);
    }
  }

  @OnDisconnect()
  disconnect(@ConnectedSocket() socket: Socket) {
    this._logger.log("Connexion stopped");
  }

  private _onLog(socket: Socket, message: string) {
    socket.emit("logs", message);
  }
}